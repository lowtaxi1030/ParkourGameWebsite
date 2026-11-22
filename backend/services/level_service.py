import json
import math
import re
from pathlib import Path
from uuid import uuid4

SAFE_ID = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")
ALLOWED_OBJECT_TYPES = {"platform", "spike", "spawn", "goal"}
DEFAULT_OBJECT_COLORS = {
    "platform": "#60a5fa",
    "spike": "#fb7185",
    "spawn": "#a3e635",
    "goal": "#facc15",
}
SAFE_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


def _level_folder(levels_dir):
    folder = Path(levels_dir) / "user"
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def _number(value, field, minimum=None, maximum=None):
    if isinstance(value, bool):
        raise ValueError(f"{field} 必須是數字。")
    try:
        result = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field} 必須是數字。")
    if not math.isfinite(result):
        raise ValueError(f"{field} 必須是有效數字。")
    if minimum is not None and result < minimum:
        raise ValueError(f"{field} 不可小於 {minimum}。")
    if maximum is not None and result > maximum:
        raise ValueError(f"{field} 不可大於 {maximum}。")
    return result


def validate_level(data):
    if not isinstance(data, dict):
        raise ValueError("關卡資料必須是 JSON 物件。")

    metadata = data.get("metadata")
    settings = data.get("settings")
    objects = data.get("objects")
    if not isinstance(metadata, dict) or not isinstance(settings, dict) or not isinstance(objects, list):
        raise ValueError("關卡必須包含 metadata、settings 及 objects。")
    if len(objects) > 5000:
        raise ValueError("單一關卡最多只能有 5000 個物件。")

    level_id = data.get("id") or uuid4().hex[:12]
    if not isinstance(level_id, str) or not SAFE_ID.fullmatch(level_id):
        raise ValueError("關卡 ID 格式不正確。")

    width = int(_number(settings.get("width", 3200), "關卡寬度", 320, 100000))
    height = int(_number(settings.get("height", 960), "關卡高度", 320, 20000))
    tile_size = int(_number(settings.get("tile_size", 32), "格子大小", 8, 256))
    gravity = _number(settings.get("gravity", 980), "重力", 0, 5000)
    move_speed = _number(settings.get("move_speed", 300), "角色移動速度", 50, 1000)
    jump_strength = _number(settings.get("jump_strength", 520), "角色跳躍力度", 100, 1500)

    normalized_objects = []
    seen_ids = set()
    for index, item in enumerate(objects):
        label = f"第 {index + 1} 個物件"
        if not isinstance(item, dict):
            raise ValueError(f"{label}資料格式不正確。")
        object_id = item.get("id")
        object_type = item.get("type")
        if not isinstance(object_id, str) or not SAFE_ID.fullmatch(object_id):
            raise ValueError(f"{label}缺少有效的物件 ID。")
        if object_id in seen_ids:
            raise ValueError(f"物件 ID 重複：{object_id}")
        seen_ids.add(object_id)
        if object_type not in ALLOWED_OBJECT_TYPES:
            raise ValueError(f"{label}的類型不支援。")

        x = _number(item.get("x"), f"{label} X 位置", 0, width)
        y = _number(item.get("y"), f"{label} Y 位置", 0, height)
        object_width = _number(item.get("width"), f"{label}寬度", 8, width)
        object_height = _number(item.get("height"), f"{label}高度", 8, height)
        if x + object_width > width or y + object_height > height:
            raise ValueError(f"{label}超出關卡範圍。")

        color = item.get("color", DEFAULT_OBJECT_COLORS[object_type])
        if not isinstance(color, str) or not SAFE_COLOR.fullmatch(color):
            raise ValueError(f"{label}的顏色格式不正確，請使用 #RRGGBB。")

        normalized_objects.append({
            "id": object_id,
            "type": object_type,
            "color": color.lower(),
            "x": x,
            "y": y,
            "width": object_width,
            "height": object_height,
        })

    try:
        version = int(data.get("version", 1))
    except (TypeError, ValueError):
        raise ValueError("關卡版本格式不正確。")
    if version < 1 or version > 100:
        raise ValueError("關卡版本必須介於 1 到 100。")

    return {
        "id": level_id,
        "version": version,
        "metadata": {
            "name": str(metadata.get("name", "未命名關卡"))[:80],
            "author": str(metadata.get("author", "Player"))[:40],
            "description": str(metadata.get("description", ""))[:500],
        },
        "settings": {
            "width": width,
            "height": height,
            "tile_size": tile_size,
            "gravity": gravity,
            "move_speed": move_speed,
            "jump_strength": jump_strength,
        },
        "objects": normalized_objects,
    }


def list_levels(levels_dir):
    results = []
    levels_path = Path(levels_dir)
    folders = [(levels_path / "examples", "example"), (levels_path / "user", "user")]
    for folder, source in folders:
        folder.mkdir(parents=True, exist_ok=True)
        for file_path in sorted(folder.glob("*.json")):
            try:
                data = json.loads(file_path.read_text(encoding="utf-8"))
                metadata = data.get("metadata", {})
                if not isinstance(metadata, dict):
                    metadata = {}
                results.append({
                    "id": file_path.stem,
                    "name": metadata.get("name", file_path.stem),
                    "author": metadata.get("author", "Unknown"),
                    "source": source,
                })
            except (OSError, json.JSONDecodeError):
                continue
    seen = set()
    unique_results = []
    for level in results:
        if level["id"] not in seen:
            seen.add(level["id"])
            unique_results.append(level)
    return unique_results


def load_level(levels_dir, level_id):
    if not isinstance(level_id, str) or not SAFE_ID.fullmatch(level_id):
        return None
    levels_path = Path(levels_dir)
    candidates = [
        levels_path / "user" / f"{level_id}.json",
        levels_path / "examples" / f"{level_id}.json",
    ]
    for file_path in candidates:
        if not file_path.is_file():
            continue
        try:
            return json.loads(file_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
    return None


def save_level(levels_dir, data):
    normalized = validate_level(data)
    file_path = _level_folder(levels_dir) / f"{normalized['id']}.json"
    file_path.write_text(
        json.dumps(normalized, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return normalized
