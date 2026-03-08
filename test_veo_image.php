<?php
$API_KEY = getenv('GEMINI_API_KEY') ?: getenv('A');
if (!$API_KEY)
    die("No API KEY\n");

$url = "https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning";

$tinyPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

$payload = [
    'instances' => [
        [
            'prompt' => 'A short cinematic test video',
            'image' => [
                'bytesBase64Encoded' => $tinyPngBase64
            ]
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
echo "Test 1: bytesBase64Encoded\n";
echo "HTTP Status: $status_line\n";
echo "Response Body:\n";
echo $res . "\n\n";

// Test 2: Reference Image
$payload2 = [
    'instances' => [
        [
            'prompt' => 'A short cinematic test video',
            'referenceImages' => [
                [
                    'image' => [
                        'bytesBase64Encoded' => $tinyPngBase64
                        // or inlineData?
                    ],
                    'referenceType' => 'asset'
                ]
            ]
        ]
    ]
];

$opts['http']['content'] = json_encode($payload2);
$context2 = stream_context_create($opts);
$res2 = file_get_contents($url, false, $context2);

echo "Test 2: referenceImages (bytesBase64Encoded)\n";
echo "HTTP Status: " . $http_response_header[0] . "\n";
echo "Response Body:\n";
echo $res2 . "\n";
