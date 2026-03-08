<?php
// Proxy para Google Gemini + Veo — PHP 8+, cURL habilitado.
declare(strict_types = 1)
;
ini_set('display_errors', '0');
error_reporting(E_ALL);
header('Content-Type: application/json; charset=utf-8');

// CORS básico
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: POST, OPTIONS');

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

if (!function_exists('curl_init')) {
    http_response_code(500);
    echo json_encode(['error' => 'cURL no está habilitado en el servidor.']);
    exit;
}

// API Key
$API_KEY = getenv('A') ?: getenv('GEMINI_API_KEY');
if (!$API_KEY) {
    http_response_code(500);
    echo json_encode(['error' => 'Falta la API key.']);
    exit;
}

$raw = file_get_contents('php://input') ?: '';
$req = json_decode($raw, true);
if (!is_array($req)) {
    http_response_code(400);
    echo json_encode(['error' => 'JSON inválido.']);
    exit;
}

$BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
$action = (string)($req['action'] ?? 'generate_image');

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

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_TIMEOUT => 120,
    ]);
    $response = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    http_response_code($code ?: 200);
    echo $response;
    exit;
}

// ─── ACCIÓN: Iniciar generación de vídeo con Veo ────────────
if ($action === 'generate_video') {
    $model = (string)($req['model'] ?? 'veo-2.0-generate-001');
    $prompt = trim((string)($req['prompt'] ?? 'Cinematic product video with smooth motion'));
    $imageB64 = (string)($req['base64ImageData'] ?? '');
    $mime = (string)($req['mimeType'] ?? 'image/png');
    $aspectRatio = (string)($req['aspectRatio'] ?? '9:16');
    $duration = (int)($req['durationSeconds'] ?? 5);

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
            'aspectRatio' => $aspectRatio,
            'durationSeconds' => $duration,
            'sampleCount' => 1,
            'personGeneration' => 'allow_adult'
        ]
    ];

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            "x-goog-api-key: {$API_KEY}"
        ],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_TIMEOUT => 30,
    ]);
    $response = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        http_response_code(500);
        echo json_encode(['error' => 'cURL Error: ' . $curlError]);
        exit;
    }

    http_response_code($code ?: 200);
    echo $response;
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

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPGET => true,
        CURLOPT_HTTPHEADER => [
            "x-goog-api-key: {$API_KEY}"
        ],
        CURLOPT_TIMEOUT => 15,
    ]);
    $response = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    http_response_code($code ?: 200);
    echo $response;
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

    // Descargar el vídeo y devolver como base64
    $separator = (strpos($videoUri, '?') === false) ? '?' : '&';
    $downloadUrl = $videoUri . $separator . "key={$API_KEY}";

    $ch = curl_init($downloadUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTPHEADER => [
            "x-goog-api-key: {$API_KEY}"
        ],
        CURLOPT_TIMEOUT => 120,
    ]);
    $videoBytes = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE) ?: 'video/mp4';
    curl_close($ch);

    if ($code >= 200 && $code < 300 && $videoBytes !== false) {
        $b64 = base64_encode($videoBytes);
        echo json_encode([
            'videoBase64' => $b64,
            'mimeType' => $contentType
        ]);
    }
    else {
        http_response_code($code ?: 500);
        echo json_encode(['error' => 'No se pudo descargar el vídeo.', 'httpCode' => $code]);
    }
    exit;
}

// Acción no reconocida
http_response_code(400);
echo json_encode(['error' => "Acción no reconocida: {$action}"]);
