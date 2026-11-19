from backend import create_app
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


def test_level_api_lists_example_and_rejects_invalid_payload(tmp_path, monkeypatch):
    app = create_app()
    app.config["TESTING"] = True
    app.config["LEVELS_DIR"] = tmp_path
    client = app.test_client()

    empty_response = client.get("/api/levels/")
    assert empty_response.status_code == 200
    assert empty_response.get_json()["levels"] == []

    bad_response = client.post("/api/levels/", json={"metadata": {}})
    assert bad_response.status_code == 400
    assert "關卡" in bad_response.get_json()["error"]
