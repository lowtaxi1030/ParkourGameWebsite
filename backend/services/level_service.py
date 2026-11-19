import json
import re
from pathlib import Path
from uuid import uuid4

SAFE_ID = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")

def _level_folder(levels_dir):
    folder = Path(levels_dir) / "user"
    folder.mkdir(parents=True, exist_ok=True)
    return folder

def list_levels(levels_dir):
    results = []
    for file_path in _level_folder(levels_dir).glob("*.json"):
        try:
            data = json.loads(file_path.read_text(encoding="utf-8"))
            metadata = data.get("metadata", {})
            results.append({
                "id": file_path.stem,
                "name": metadata.get("name", file_path.stem),
                "author": metadata.get("author", "Unknown"),
            })
        except (OSError, json.JSONDecodeError):
            continue
    return results

def load_level(levels_dir, level_id):
    if not SAFE_ID.fullmatch(level_id):
        return None
    file_path = _level_folder(levels_dir) / f"{level_id}.json"
    if not file_path.is_file():
        return None
    try:
        return json.loads(file_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None

def save_level(levels_dir, data):
    metadata = data.get("metadata")
    settings = data.get("settings")
    objects = data.get("objects")

    if not isinstance(metadata, dict) or not isinstance(settings, dict) or not isinstance(objects, list):
        raise ValueError("關卡必須包含 metadata、settings 及 objects。")

    level_id = data.get("id") or uuid4().hex[:12]
    if not isinstance(level_id, str) or not SAFE_ID.fullmatch(level_id):
        raise ValueError("關卡 ID 格式不正確。")

    normalized = {
        "id": level_id,
        "version": int(data.get("version", 1)),
        "metadata": {
            "name": str(metadata.get("name", "未命名關卡"))[:80],
            "author": str(metadata.get("author", "Player"))[:40],
            "description": str(metadata.get("description", ""))[:500],
        },
        "settings": {
            "width": max(320, min(int(settings.get("width", 3200)), 100000)),
            "height": max(320, min(int(settings.get("height", 960)), 20000)),
            "tile_size": max(8, min(int(settings.get("tile_size", 32)), 256)),
            "gravity": max(0, min(float(settings.get("gravity", 980)), 5000)),
        },
        "objects": objects,
    }

    file_path = _level_folder(levels_dir) / f"{level_id}.json"
    file_path.write_text(
        json.dumps(normalized, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return normalized
