<?php
$API_KEY = getenv('GEMINI_API_KEY');
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

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        "Content-Type: application/json",
        "x-goog-api-key: {$API_KEY}"
    ],
    CURLOPT_POSTFIELDS => json_encode($payload)
]);
$res = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
echo "HTTP $code\n";
echo $res . "\n";
