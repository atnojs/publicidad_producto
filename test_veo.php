<?php
$API_KEY = getenv('GEMINI_API_KEY') ?: getenv('A');
if (!$API_KEY)
    die("No API KEY\n");

$url = "https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning";

$payload = [
    'instances' => [
        [
            'prompt' => 'A short cinematic test video'
        ]
    ],
    'parameters' => [
        'aspectRatio' => '9:16'
    ]
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

$status_line = $http_response_header[0];
echo "HTTP Status: $status_line\n";
echo "Response Body:\n";
echo $res . "\n";
