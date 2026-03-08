<?php
$API_KEY = getenv('GEMINI_API_KEY') ?: getenv('A');

$models = ['veo-3.1-fast-generate-preview', 'veo-3.1-fast-generate-001'];
foreach ($models as $model) {
    $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:predictLongRunning";
    $payload = [
        'instances' => [['prompt' => 'A test prompt']],
        'parameters' => ['aspectRatio' => '9:16']
    ];

    $opts = [
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\n" .
            "x-goog-api-key: {$API_KEY}\r\n",
            'content' => json_encode($payload),
            'ignore_errors' => true
        ]
    ];

    $context = stream_context_create($opts);
    $res = file_get_contents($url, false, $context);
    echo "Model $model -> HTTP " . $http_response_header[0] . "\n";
    if (strpos($res, 'error') !== false) {
        echo "Error detail: " . json_decode($res)->error->message . "\n";
    }
}
