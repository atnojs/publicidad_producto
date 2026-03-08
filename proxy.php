<?php
// Proxy para Google Gemini + Veo — PHP 8+, sin cURL (usa stream contexts)
declare(strict_types = 1)
;
ini_set('display_errors', '0');
error_reporting(E_ALL);
header('Content-Type: application/json; charset=utf-8');

// CORS básico
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization, x-goog-api-key');
header('Access-Control-Allow-Methods: POST, OPTIONS, GET');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

register_shutdown_function(function () {
    $e = error_get_last();
    if ($e && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        http_response_code(500);
        echo json_encode(['error' => 'Fallo interno en PHP', 'details' => $e['message']]);
    }
});

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido. Usa POST.']);
    exit;
}

// API Key
$API_KEY = getenv('A') ?: getenv('GEMINI_API_KEY');
if (!$API_KEY) {
    http_response_code(500);
    echo json_encode(['error' => 'Falta la API key en el servidor.']);
    exit;
}

$raw = file_get_contents('php://input') ?: '';
$req = json_decode($raw, true);
if (!is_array($req)) {
    http_response_code(400);
    echo json_encode(['error' => 'JSON inválido.', 'raw' => $raw]);
    exit;
}

$BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
$action = (string)($req['action'] ?? 'generate_image');

/**
 * Función auxiliar para hacer peticiones HTTP sin cURL
 */
function make_request($url, $method = 'GET', $headers = [], $body = null)
{
    if ($body !== null && !in_array('Content-Type: application/json', $headers)) {
        $headers[] = 'Content-Type: application/json';
    }

    $opts = [
        'http' => [
            'method' => $method,
            'header' => implode("\r\n", $headers),
            'ignore_errors' => true,
            'timeout' => 120
        ]
    ];

    if ($body !== null) {
        $opts['http']['content'] = is_string($body) ? $body : json_encode($body);
    }

    $context = stream_context_create($opts);
    $response = file_get_contents($url, false, $context);

    $status_line = $http_response_header[0];
    preg_match('{HTTP\/\S*\s(\d{3})}', $status_line, $match);
    $status = $match[1];

    // Devolver formato de los headers igual a cURL
    $contentType = 'application/json';
    foreach ($http_response_header as $h) {
        if (stripos($h, 'Content-Type:') === 0) {
            $contentType = trim(substr($h, 13));
        }
    }

    return [
        'status' => (int)$status,
        'body' => $response,
        'contentType' => $contentType
    ];
}

// ─── ACCIÓN: Generar imagen con Gemini ───────────────────────
if ($action === 'generate_image') {
    $model = (string)($req['model'] ?? 'gemini-3.1-flash-image-preview');
    $endpoint = "{$BASE_URL}/models/{$model}:generateContent?key={$API_KEY}";

    if (isset($req['contents'])) {
        $payload = ['contents' => $req['contents']];
        if (isset($req['generationConfig']))
            $payload['generationConfig'] = $req['generationConfig'];
    }
    else {
        $prompt = trim((string)($req['prompt'] ?? ''));
        $imageB64 = (string)($req['base64ImageData'] ?? '');
        $mime = (string)($req['mimeType'] ?? 'image/jpeg');

        $payload = [
            'contents' => [[
                    'parts' => [
                        ['text' => $prompt],
                        ['inlineData' => [
                                'mimeType' => $mime,
                                'data' => $imageB64
                            ]]
                    ]
                ]],
            'generationConfig' => ['responseModalities' => ['TEXT', 'IMAGE']]
        ];
    }

    $res = make_request($endpoint, 'POST', [], $payload);
    http_response_code($res['status']);
    header('Content-Type: ' . $res['contentType']);
    echo $res['body'];
    exit;
}

// ─── ACCIÓN: Iniciar generación de vídeo con Veo ────────────
if ($action === 'generate_video') {
    $model = (string)($req['model'] ?? 'veo-3.1-generate-preview');
    $prompt = trim((string)($req['prompt'] ?? 'Cinematic product video'));
    $imageB64 = (string)($req['base64ImageData'] ?? '');
    $mime = (string)($req['mimeType'] ?? 'image/png');
    $aspectRatio = (string)($req['aspectRatio'] ?? '9:16');

    $endpoint = "{$BASE_URL}/models/{$model}:predictLongRunning";

    $instance = ['prompt' => $prompt];

    // Si hay imagen, hacemos image-to-video
    if ($imageB64 !== '') {
        $instance['image'] = [
            'inlineData' => [
                'mimeType' => $mime,
                'data' => $imageB64
            ]
        ];
    }

    $payload = [
        'instances' => [$instance],
        'parameters' => [
            'aspectRatio' => $aspectRatio
        ]
    ];

    $res = make_request($endpoint, 'POST', ["x-goog-api-key: {$API_KEY}"], $payload);
    http_response_code($res['status']);
    header('Content-Type: ' . $res['contentType']);
    echo $res['body'];
    exit;
}

// ─── ACCIÓN: Poll estado de operación Veo ────────────────────
if ($action === 'poll_video') {
    $operationName = (string)($req['operationName'] ?? '');
    if ($operationName === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Falta operationName.']);
        exit;
    }

    $endpoint = "{$BASE_URL}/{$operationName}";
    $res = make_request($endpoint, 'GET', ["x-goog-api-key: {$API_KEY}"]);

    http_response_code($res['status']);
    header('Content-Type: ' . $res['contentType']);
    echo $res['body'];
    exit;
}

// ─── ACCIÓN: Descargar vídeo generado ────────────────────────
if ($action === 'download_video') {
    $videoUri = (string)($req['videoUri'] ?? '');
    if ($videoUri === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Falta videoUri.']);
        exit;
    }

    $separator = (strpos($videoUri, '?') === false) ? '?' : '&';
    $downloadUrl = $videoUri . $separator . "key={$API_KEY}";

    $opts = [
        'http' => [
            'method' => 'GET',
            'ignore_errors' => true,
            'timeout' => 120
        ]
    ];
    $context = stream_context_create($opts);
    $videoBytes = file_get_contents($downloadUrl, false, $context);

    $status_line = $http_response_header[0];
    preg_match('{HTTP\/\S*\s(\d{3})}', $status_line, $match);
    $status = (int)$match[1];

    $contentType = 'video/mp4';
    foreach ($http_response_header as $h) {
        if (stripos($h, 'Content-Type:') === 0) {
            $contentType = trim(substr($h, 13));
        }
    }

    if ($status >= 200 && $status < 300 && $videoBytes !== false) {
        $b64 = base64_encode($videoBytes);
        echo json_encode([
            'videoBase64' => $b64,
            'mimeType' => $contentType
        ]);
    }
    else {
        http_response_code($status ?: 500);
        echo json_encode(['error' => 'No se pudo descargar el vídeo.', 'httpCode' => $status, 'body' => $videoBytes]);
    }
    exit;
}

// Acción no reconocida
http_response_code(400);
echo json_encode(['error' => "Acción no reconocida: {$action}"]);
