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

    // Ensure designs table exists with new columns
    $pdo->exec("CREATE TABLE IF NOT EXISTS `designs` (
      `id` INT AUTO_INCREMENT PRIMARY KEY,
      `tailor_id` INT NOT NULL,
      `title` VARCHAR(150) NOT NULL,
      `category` VARCHAR(100) DEFAULT 'General',
      `gender` VARCHAR(20) DEFAULT 'Unisex',
      `target_group` VARCHAR(20) DEFAULT 'Adults',
      `description` TEXT DEFAULT NULL,
      `price_estimate` DECIMAL(10,2) DEFAULT NULL,
      `image_url` VARCHAR(255) NOT NULL,
      `is_global` TINYINT(1) DEFAULT 0,
      `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT `fk_designs_tailor` FOREIGN KEY (`tailor_id`) REFERENCES `tailors` (`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

    // Add new columns if missing
    try { $pdo->exec("ALTER TABLE `designs` ADD COLUMN `gender` VARCHAR(20) DEFAULT 'Unisex' AFTER `category`"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE `designs` ADD COLUMN `target_group` VARCHAR(20) DEFAULT 'Adults' AFTER `gender`"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE `designs` ADD COLUMN `is_global` TINYINT(1) DEFAULT 0 AFTER `price_estimate`"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE `tailors` ADD COLUMN `is_admin` TINYINT(1) DEFAULT 0 AFTER `phone`"); } catch (Exception $e) {}

    // Ensure at least one admin exists (make the first tailor admin)
    try {
        $checkAdmin = $pdo->query("SELECT COUNT(*) FROM `tailors` WHERE `is_admin` = 1")->fetchColumn();
        if ((int)$checkAdmin === 0) {
            $pdo->exec("UPDATE `tailors` SET `is_admin` = 1 ORDER BY id ASC LIMIT 1");
        }
    } catch (Exception $e) {}

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
    $stmt = $pdo->prepare('SELECT id, shop_name, full_name, email, phone, COALESCE(is_admin, 0) AS is_admin FROM tailors WHERE id = ?');
    $stmt->execute([$payload['uid']]);
    $u = $stmt->fetch();
    if ($u) {
        $u['is_admin'] = (int)$u['is_admin'] === 1;
        return $u;
    }
    return null;
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];
if (!empty($_POST)) {
    $input = array_merge($input, $_POST);
}
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

        // Check if this is the first user
        $totalUsers = (int)$pdo->query("SELECT COUNT(*) FROM tailors")->fetchColumn();
        $isAdmin = ($totalUsers === 0) ? 1 : 0;

        $hash = password_hash($password, PASSWORD_DEFAULT);
        $insert = $pdo->prepare('INSERT INTO tailors (shop_name, full_name, email, phone, password_hash, is_admin) VALUES (?, ?, ?, ?, ?, ?)');
        $insert->execute([$shop, $name, $email, $phone, $hash, $isAdmin]);
        $userId = $pdo->lastInsertId();

        $token = generateToken($userId, $email, $jwt_secret);
        $user = ['id' => (int)$userId, 'shop_name' => $shop, 'full_name' => $name, 'email' => $email, 'phone' => $phone, 'is_admin' => ($isAdmin === 1)];
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
            'id' => (int)$tailor['id'],
            'shop_name' => $tailor['shop_name'],
            'full_name' => $tailor['full_name'],
            'email' => $tailor['email'],
            'phone' => $tailor['phone'],
            'is_admin' => ((int)($tailor['is_admin'] ?? 0) === 1)
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

    case 'designs':
        $user = getAuthUser($pdo, $jwt_secret);
        if (!$user) {
            http_response_code(401);
            echo json_encode(['error' => 'Unauthorized']);
            exit;
        }
        // Return both custom tailor designs AND global preloaded designs
        $stmt = $pdo->prepare('SELECT id, tailor_id, title, category, gender, target_group, description, price_estimate, image_url, is_global, created_at FROM designs WHERE tailor_id = ? OR is_global = 1 ORDER BY is_global DESC, created_at DESC');
        $stmt->execute([$user['id']]);
        $rows = $stmt->fetchAll();
        foreach ($rows as &$r) {
            $r['id'] = (int)$r['id'];
            $r['price_estimate'] = $r['price_estimate'] !== null ? (float)$r['price_estimate'] : null;
            $r['is_global'] = (int)$r['is_global'] === 1;
            $r['is_owner'] = ((int)$r['tailor_id'] === (int)$user['id']) || $user['is_admin'];
            $r['gender'] = $r['gender'] ?: 'Unisex';
            $r['target_group'] = $r['target_group'] ?: 'Adults';
        }
        echo json_encode(['designs' => $rows]);
        break;

    case 'save_design':
        $user = getAuthUser($pdo, $jwt_secret);
        if (!$user) {
            http_response_code(401);
            echo json_encode(['error' => 'Unauthorized']);
            exit;
        }
        $title = trim($input['title'] ?? '');
        $category = trim($input['category'] ?? 'General');
        $gender = trim($input['gender'] ?? 'Unisex');
        $target_group = trim($input['target_group'] ?? 'Adults');
        $description = trim($input['description'] ?? '');
        $price = !empty($input['price_estimate']) ? floatval($input['price_estimate']) : null;
        $is_global = (!empty($input['is_global']) && !empty($user['is_admin'])) ? 1 : 0;
        $imageUrl = '';

        $uploadDir = __DIR__ . '/uploads/designs/';
        if (!file_exists($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        // Handle file upload
        if (!empty($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
            $tmpName = $_FILES['image']['tmp_name'];
            $origName = $_FILES['image']['name'];
            $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
            if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif'])) {
                $ext = 'jpg';
            }
            $fileName = 'design_' . $user['id'] . '_' . uniqid() . '.' . $ext;
            if (move_uploaded_file($tmpName, $uploadDir . $fileName)) {
                $imageUrl = 'uploads/designs/' . $fileName;
            }
        } elseif (!empty($input['image_data'])) {
            // Base64 data URL support
            if (preg_match('/^data:image\/(\w+);base64,/', $input['image_data'], $type)) {
                $data = substr($input['image_data'], strpos($input['image_data'], ',') + 1);
                $ext = strtolower($type[1]);
                if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif'])) {
                    $ext = 'jpg';
                }
                $data = base64_decode($data);
                if ($data !== false) {
                    $fileName = 'design_' . $user['id'] . '_' . uniqid() . '.' . $ext;
                    if (file_put_contents($uploadDir . $fileName, $data)) {
                        $imageUrl = 'uploads/designs/' . $fileName;
                    }
                }
            }
        }

        if (!$title) {
            $title = 'Design Style';
        }

        if (!$imageUrl) {
            http_response_code(400);
            echo json_encode(['error' => 'Please provide an image for the design.']);
            exit;
        }

        $stmt = $pdo->prepare('INSERT INTO designs (tailor_id, title, category, gender, target_group, description, price_estimate, image_url, is_global) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([$user['id'], $title, $category, $gender, $target_group, $description, $price, $imageUrl, $is_global]);
        $designId = $pdo->lastInsertId();

        echo json_encode([
            'success' => true,
            'design' => [
                'id' => (int)$designId,
                'tailor_id' => (int)$user['id'],
                'title' => $title,
                'category' => $category,
                'gender' => $gender,
                'target_group' => $target_group,
                'description' => $description,
                'price_estimate' => $price,
                'image_url' => $imageUrl,
                'is_global' => ($is_global === 1),
                'is_owner' => true,
                'created_at' => date('Y-m-d H:i:s')
            ]
        ]);
        break;

    case 'delete_design':
        $user = getAuthUser($pdo, $jwt_secret);
        if (!$user) {
            http_response_code(401);
            echo json_encode(['error' => 'Unauthorized']);
            exit;
        }
        $id = (int)($input['id'] ?? 0);
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'Design ID required']);
            exit;
        }
        
        // Admins can delete any design; regular tailors can only delete their own
        if ($user['is_admin']) {
            $stmt = $pdo->prepare('SELECT image_url FROM designs WHERE id = ?');
            $stmt->execute([$id]);
        } else {
            $stmt = $pdo->prepare('SELECT image_url FROM designs WHERE id = ? AND tailor_id = ?');
            $stmt->execute([$id, $user['id']]);
        }
        $design = $stmt->fetch();
        if ($design) {
            if ($design['image_url'] && file_exists(__DIR__ . '/' . $design['image_url'])) {
                @unlink(__DIR__ . '/' . $design['image_url']);
            }
            $del = $pdo->prepare('DELETE FROM designs WHERE id = ?');
            $del->execute([$id]);
        }
        echo json_encode(['success' => true]);
        break;

    case 'admin_stats':
        $user = getAuthUser($pdo, $jwt_secret);
        if (!$user || empty($user['is_admin'])) {
            http_response_code(403);
            echo json_encode(['error' => 'Admin access required.']);
            exit;
        }

        $totalTailors = (int)$pdo->query('SELECT COUNT(*) FROM tailors')->fetchColumn();
        $totalCustomers = (int)$pdo->query('SELECT COUNT(*) FROM customers')->fetchColumn();
        $totalDesigns = (int)$pdo->query('SELECT COUNT(*) FROM designs')->fetchColumn();
        $globalDesigns = (int)$pdo->query('SELECT COUNT(*) FROM designs WHERE is_global = 1')->fetchColumn();

        echo json_encode([
            'stats' => [
                'total_tailors' => $totalTailors,
                'total_customers' => $totalCustomers,
                'total_designs' => $totalDesigns,
                'global_designs' => $globalDesigns
            ]
        ]);
        break;

    case 'admin_tailors':
        $user = getAuthUser($pdo, $jwt_secret);
        if (!$user || empty($user['is_admin'])) {
            http_response_code(403);
            echo json_encode(['error' => 'Admin access required.']);
            exit;
        }

        $stmt = $pdo->query('
            SELECT t.id, t.shop_name, t.full_name, t.email, t.phone, t.is_admin, t.created_at, 
                   COUNT(c.id) AS client_count,
                   (SELECT COUNT(*) FROM designs d WHERE d.tailor_id = t.id AND d.is_global = 0) AS custom_designs
            FROM tailors t
            LEFT JOIN customers c ON c.tailor_id = t.id
            GROUP BY t.id
            ORDER BY t.created_at DESC
        ');
        $tailors = $stmt->fetchAll();
        foreach ($tailors as &$t) {
            $t['id'] = (int)$t['id'];
            $t['is_admin'] = (int)$t['is_admin'] === 1;
            $t['client_count'] = (int)$t['client_count'];
            $t['custom_designs'] = (int)$t['custom_designs'];
        }
        echo json_encode(['tailors' => $tailors]);
        break;

    default:
        echo json_encode(['status' => 'Adepam API Online', 'version' => '2.1.0']);
        break;
}
