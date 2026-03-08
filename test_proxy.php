<?php
$url = "http://localhost:8000/proxy.php";
$payload = [
    'action' => 'generate_video',
    'model' => 'veo-3.1-generate-preview',
    'prompt' => 'Test cinematic video',
    'aspectRatio' => '9:16'
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
