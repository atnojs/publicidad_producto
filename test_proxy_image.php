<?php
$url = "http://localhost:8000/proxy.php";

// A minimal 1x1 PNG base64
$tinyPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

$payload = [
    'action' => 'generate_video',
    'model' => 'veo-3.1-generate-preview',
    'prompt' => 'Test cinematic video',
    'aspectRatio' => '9:16',
    'base64ImageData' => $tinyPngBase64,
    'mimeType' => 'image/png'
];

$opts = [
    'http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/json\r\n",
        'content' => json_encode($payload),
        'ignore_errors' => true
    ]
];

$context = stream_context_create($opts);
$res = file_get_contents($url, false, $context);

echo "HTTP Code: " . $http_response_header[0] . "\n";
echo "Body:\n" . $res . "\n";
