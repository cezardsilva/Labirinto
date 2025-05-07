<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Permite CORS

$data = json_decode(file_get_contents('php://input'), true);
$file = 'highscore.json';

// Cria arquivo se não existir
if (!file_exists($file)) {
    file_put_contents($file, json_encode([
        'name' => 'Anônimo',
        'score' => 0,
        'level' => 1
    ]));
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Força leitura fresca do arquivo
    clearstatcache();
    $content = file_get_contents($file);
    echo $content ? $content : json_encode([
        'name' => 'Anônimo',
        'score' => 0,
        'level' => 1
    ]);
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!empty($data['name']) && isset($data['score']) && isset($data['level'])) {
        $newRecord = [
            'name' => trim($data['name']),
            'score' => (int)$data['score'],
            'level' => (int)$data['level']
        ];
        file_put_contents($file, json_encode($newRecord));
        echo json_encode(['success' => true, 'record' => $newRecord]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Dados inválidos']);
    }
}
?>