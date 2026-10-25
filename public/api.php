<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Database configuration
$db_host = 'localhost';
$db_name = 'codecast_codecastic_adepam';
$db_user = 'codecast_adepam';
$db_pass = 'dx@;hWlse&x~bb-A';

$jwt_secret = 'c0decastic_adepam_secure_jwt_key_2026';

try {
    $pdo = new PDO("mysql:host={$db_host};dbname={$db_name};charset=utf8mb4", $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

function base64UrlEncode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64UrlDecode($data) {
    return base64_decode(strtr($data, '-_', '+/'));
}

function generateToken($userId, $email, $secret) {
    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    $payload = json_encode([
        'uid' => $userId,
        'email' => $email,
        'exp' => time() + (86400 * 60) // 60 days
    ]);
    $base64Header = base64UrlEncode($header);
    $base64Payload = base64UrlEncode($payload);
    $signature = hash_hmac('sha256', $base64Header . '.' . $base64Payload, $secret, true);
    $base64Signature = base64UrlEncode($signature);
    return $base64Header . '.' . $base64Payload . '.' . $base64Signature;
}

function getAuthUser($pdo, $secret) {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (!preg_match('/Bearer\s+(\S+)/', $authHeader, $matches)) {
        return null;
    }
    $token = $matches[1];
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    list($base64Header, $base64Payload, $base64Signature) = $parts;
    $validSignature = base64UrlEncode(hash_hmac('sha256', $base64Header . '.' . $base64Payload, $secret, true));
    if (!hash_equals($validSignature, $base64Signature)) {
        return null;
    }
    $payload = json_decode(base64UrlDecode($base64Payload), true);
    if (!$payload || !isset($payload['uid']) || $payload['exp'] < time()) {
        return null;
    }
    $stmt = $pdo->prepare('SELECT id, shop_name, full_name, email, phone FROM tailors WHERE id = ?');
    $stmt->execute([$payload['uid']]);
    return $stmt->fetch() ?: null;
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $_GET['action'] ?? ($input['action'] ?? '');

switch ($action) {
    case 'signup':
        $shop = trim($input['shop_name'] ?? '');
        $name = trim($input['full_name'] ?? '');
        $email = strtolower(trim($input['email'] ?? ''));
        $phone = trim($input['phone'] ?? '');
        $password = $input['password'] ?? '';

        if (!$email || !$password || !$shop || !$name) {
            http_response_code(400);
            echo json_encode(['error' => 'Please fill in all required fields.']);
            exit;
        }

        $check = $pdo->prepare('SELECT id FROM tailors WHERE email = ?');
        $check->execute([$email]);
        if ($check->fetch()) {
            http_response_code(400);
            echo json_encode(['error' => 'An account with this email already exists.']);
            exit;
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);
        $insert = $pdo->prepare('INSERT INTO tailors (shop_name, full_name, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)');
        $insert->execute([$shop, $name, $email, $phone, $hash]);
        $userId = $pdo->lastInsertId();

        $token = generateToken($userId, $email, $jwt_secret);
        $user = ['id' => $userId, 'shop_name' => $shop, 'full_name' => $name, 'email' => $email, 'phone' => $phone];
        echo json_encode(['success' => true, 'token' => $token, 'user' => $user]);
        break;

    case 'login':
        $email = strtolower(trim($input['email'] ?? ''));
        $password = $input['password'] ?? '';

        if (!$email || !$password) {
            http_response_code(400);
            echo json_encode(['error' => 'Please enter email and password.']);
            exit;
        }

        $stmt = $pdo->prepare('SELECT * FROM tailors WHERE email = ?');
        $stmt->execute([$email]);
        $tailor = $stmt->fetch();

        if (!$tailor || !password_verify($password, $tailor['password_hash'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid email or password.']);
            exit;
        }

        $token = generateToken($tailor['id'], $tailor['email'], $jwt_secret);
        $user = [
            'id' => $tailor['id'],
            'shop_name' => $tailor['shop_name'],
            'full_name' => $tailor['full_name'],
            'email' => $tailor['email'],
            'phone' => $tailor['phone']
        ];
        echo json_encode(['success' => true, 'token' => $token, 'user' => $user]);
        break;

    case 'me':
        $user = getAuthUser($pdo, $jwt_secret);
        if (!$user) {
            http_response_code(401);
            echo json_encode(['error' => 'Unauthorized']);
            exit;
        }
        echo json_encode(['user' => $user]);
        break;

    case 'update_profile':
        $user = getAuthUser($pdo, $jwt_secret);
        if (!$user) {
            http_response_code(401);
            echo json_encode(['error' => 'Unauthorized']);
            exit;
        }
        $shop = trim($input['shop_name'] ?? $user['shop_name']);
        $name = trim($input['full_name'] ?? $user['full_name']);
        $phone = trim($input['phone'] ?? $user['phone']);

        $stmt = $pdo->prepare('UPDATE tailors SET shop_name = ?, full_name = ?, phone = ? WHERE id = ?');
        $stmt->execute([$shop, $name, $phone, $user['id']]);

        $user['shop_name'] = $shop;
        $user['full_name'] = $name;
        $user['phone'] = $phone;
        echo json_encode(['success' => true, 'user' => $user]);
        break;

    case 'update_password':
        $user = getAuthUser($pdo, $jwt_secret);
        if (!$user) {
            http_response_code(401);
            echo json_encode(['error' => 'Unauthorized']);
            exit;
        }
        $password = $input['password'] ?? '';
        if (strlen($password) < 6) {
            http_response_code(400);
            echo json_encode(['error' => 'Password must be at least 6 characters.']);
            exit;
        }
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare('UPDATE tailors SET password_hash = ? WHERE id = ?');
        $stmt->execute([$hash, $user['id']]);
        echo json_encode(['success' => true, 'message' => 'Password updated.']);
        break;

    case 'customers':
        $user = getAuthUser($pdo, $jwt_secret);
        if (!$user) {
            http_response_code(401);
            echo json_encode(['error' => 'Unauthorized']);
            exit;
        }
        $stmt = $pdo->prepare('SELECT id, name, contact, date, charge, unit, m, material, notes, created_at, updated_at FROM customers WHERE tailor_id = ? ORDER BY created_at DESC');
        $stmt->execute([$user['id']]);
        $rows = $stmt->fetchAll();

        foreach ($rows as &$r) {
            $r['m'] = $r['m'] ? json_decode($r['m'], true) : [];
            $r['charge'] = (float)$r['charge'];
        }
        echo json_encode(['customers' => $rows]);
        break;

    case 'save_customer':
        $user = getAuthUser($pdo, $jwt_secret);
        if (!$user) {
            http_response_code(401);
            echo json_encode(['error' => 'Unauthorized']);
            exit;
        }
        $c = $input['customer'] ?? null;
        if (!$c || !isset($c['id']) || !isset($c['name'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid customer data.']);
            exit;
        }

        $id = $c['id'];
        $name = trim($c['name']);
        $contact = trim($c['contact'] ?? '');
        $date = trim($c['date'] ?? '');
        $charge = floatval($c['charge'] ?? 0);
        $unit = $c['unit'] ?? 'in';
        $m = json_encode($c['m'] ?? []);
        $material = $c['material'] ?? '';
        $notes = $c['notes'] ?? '';

        $sql = "INSERT INTO customers (id, tailor_id, name, contact, date, charge, unit, m, material, notes) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                name = VALUES(name), contact = VALUES(contact), date = VALUES(date), 
                charge = VALUES(charge), unit = VALUES(unit), m = VALUES(m), 
                material = VALUES(material), notes = VALUES(notes), updated_at = NOW()";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([$id, $user['id'], $name, $contact, $date, $charge, $unit, $m, $material, $notes]);
        echo json_encode(['success' => true]);
        break;

    case 'delete_customer':
        $user = getAuthUser($pdo, $jwt_secret);
        if (!$user) {
            http_response_code(401);
            echo json_encode(['error' => 'Unauthorized']);
            exit;
        }
        $id = $input['id'] ?? '';
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'Customer ID required']);
            exit;
        }
        $stmt = $pdo->prepare('DELETE FROM customers WHERE id = ? AND tailor_id = ?');
        $stmt->execute([$id, $user['id']]);
        echo json_encode(['success' => true]);
        break;

    default:
        echo json_encode(['status' => 'Adepam API Online', 'version' => '2.0.0']);
        break;
}
