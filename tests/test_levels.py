import json
from backend.services.level_service import save_level, load_level

def test_save_and_load_level(tmp_path):
    data = {
        "metadata": {"name": "Test Level"},
        "settings": {"width": 640, "height": 480},
        "objects": [],
    }
    saved = save_level(tmp_path, data)
    loaded = load_level(tmp_path, saved["id"])
    assert loaded["metadata"]["name"] == "Test Level"
