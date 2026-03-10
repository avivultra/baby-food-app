<?php
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

require_once "db.php";

$action = isset($_GET["action"]) ? $_GET["action"] : "";

if ($_SERVER["REQUEST_METHOD"] === "GET") {
    if ($action === "get_dashboard_data") {
        $data = [
            "last_feeding" => null,
            "last_pumping" => null,
            "today_pumped_ml" => 0,
            "today_bottle_ml" => 0, "today_nursing_count" => 0, "today_nursing_avg_time" => "00:00", "recent_history" => []
        ];

        // 1. ׳§׳‘׳׳× ׳”׳׳›׳׳” ׳׳—׳¨׳•׳ ׳”
        $res = $conn->query("SELECT * FROM feedings ORDER BY start_time DESC LIMIT 1");
        if ($res && $row = $res->fetch_assoc()) {
            $data["last_feeding"] = $row;
        }

        // 2. ׳§׳‘׳׳× ׳©׳׳™׳‘׳” ׳׳—׳¨׳•׳ ׳”
        $res = $conn->query("SELECT * FROM pumpings ORDER BY start_time DESC LIMIT 1");
        if ($res && $row = $res->fetch_assoc()) {
            $data["last_pumping"] = $row;
        }

        // 3. ׳›׳׳•׳× ׳©׳׳•׳‘׳” ׳”׳™׳•׳
        $res = $conn->query("SELECT SUM(amount_ml) as total FROM pumpings WHERE DATE(start_time) = CURDATE()");
        if ($res && $row = $res->fetch_assoc()) {
            $data["today_pumped_ml"] = (int)$row["total"];
        }

        // 4. ׳›׳׳•׳× ׳×׳"׳/׳‘׳§׳‘׳•׳§ ׳”׳™׳•׳
        $res = $conn->query("SELECT SUM(amount_ml) as total FROM feedings WHERE type='bottle' AND DATE(start_time) = CURDATE()");
        if ($res && $row = $res->fetch_assoc()) {
            $data["today_bottle_ml"] = (int)$row["total"];
        }

        
        
        // Nursing average time and count today
        $res = $conn->query("SELECT notes FROM feedings WHERE type='nursing' AND DATE(start_time) = CURDATE()");
        $total_seconds = 0;
        $count = 0;
        if($res) {
            while($row = $res->fetch_assoc()) {
                // Parse "משך: MM:SS"
                if(preg_match('/(\d{2}):(\d{2})/', $row["notes"], $matches)) {
                    $m = (int)$matches[1];
                    $s = (int)$matches[2];
                    $total_seconds += ($m * 60) + $s;
                    $count++;
                }
            }
            $data["today_nursing_count"] = $count;
            if($count > 0) {
                $avg_seconds = floor($total_seconds / $count);
                $avg_m = floor($avg_seconds / 60);
                $avg_s = $avg_seconds % 60;
                $data["today_nursing_avg_time"] = sprintf("%02d:%02d", $avg_m, $avg_s);
            }
        }

        // 5. Recent history (Today)
        $history = [];
        $feedings = $conn->query("SELECT id, 'feedings' as table_name, type as event_type, start_time as time, amount_ml, side FROM feedings WHERE DATE(start_time) = CURDATE()");
        while($row = $feedings->fetch_assoc()) { $history[] = $row; }
        
        $pumpings = $conn->query("SELECT id, 'pumpings' as table_name, 'pumping' as event_type, start_time as time, amount_ml, side FROM pumpings WHERE DATE(start_time) = CURDATE()");
        while($row = $pumpings->fetch_assoc()) { $history[] = $row; }

        $diapers = $conn->query("SELECT id, 'diapers' as table_name, type as event_type, time, null as amount_ml, null as side FROM diapers WHERE DATE(time) = CURDATE()");
        while($row = $diapers->fetch_assoc()) { $history[] = $row; }

        usort($history, function($a, $b) {
            return strtotime($b["time"]) - strtotime($a["time"]);
        });
        
        $data["recent_history"] = $history;
        echo json_encode($data);
    }
} elseif ($_SERVER["REQUEST_METHOD"] === "POST") {
    $input = json_decode(file_get_contents("php://input"), true);
    
    if ($action === "add_feeding") {
        $type = $input["type"];
        $start_time = $input["start_time"];
        $end_time = isset($input["end_time"]) ? $input["end_time"] : null;
        $side = isset($input["side"]) ? $input["side"] : null;
        $amount_ml = isset($input["amount_ml"]) ? (int)$input["amount_ml"] : null;
        $notes = isset($input["notes"]) ? $input["notes"] : "";

        $stmt = $conn->prepare("INSERT INTO feedings (type, start_time, end_time, side, amount_ml, notes) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("ssssis", $type, $start_time, $end_time, $side, $amount_ml, $notes);
        
        if ($stmt->execute()) {
            echo json_encode(["success" => true, "id" => $stmt->insert_id]);
        } else {
            echo json_encode(["success" => false, "error" => $stmt->error]);
        }
    } elseif ($action === "add_pumping") {
        $start_time = $input["start_time"];
        $end_time = isset($input["end_time"]) ? $input["end_time"] : null;
        $side = isset($input["side"]) ? $input["side"] : null;
        $amount_ml = (int)$input["amount_ml"];
        $notes = isset($input["notes"]) ? $input["notes"] : "";

        $stmt = $conn->prepare("INSERT INTO pumpings (start_time, end_time, side, amount_ml, notes) VALUES (?, ?, ?, ?, ?)");
        $stmt->bind_param("sssis", $start_time, $end_time, $side, $amount_ml, $notes);
        
        if ($stmt->execute()) {
            echo json_encode(["success" => true, "id" => $stmt->insert_id]);
        } else {
            echo json_encode(["success" => false, "error" => $stmt->error]);
        }
    } elseif ($action === "add_diaper") {
        $time = $input["time"];
        $type = $input["type"];
        $notes = isset($input["notes"]) ? $input["notes"] : "";

        $stmt = $conn->prepare("INSERT INTO diapers (time, type, notes) VALUES (?, ?, ?)");
        $stmt->bind_param("sss", $time, $type, $notes);
        
        if ($stmt->execute()) {
            echo json_encode(["success" => true, "id" => $stmt->insert_id]);
        } else {
            echo json_encode(["success" => false, "error" => $stmt->error]);
        }
    } elseif ($action === "delete_record") {
        $table = $input["table"];
        $id = (int)$input["id"];
        
        if (in_array($table, ["feedings", "pumpings", "diapers"])) {
            $stmt = $conn->prepare("DELETE FROM $table WHERE id = ?");
            $stmt->bind_param("i", $id);
            if ($stmt->execute()) {
                echo json_encode(["success" => true]);
            } else {
                echo json_encode(["success" => false, "error" => $stmt->error]);
            }
        } else {
            echo json_encode(["success" => false, "error" => "Invalid table"]);
        }
    }
}

$conn->close();
?>








