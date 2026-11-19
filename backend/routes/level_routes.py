from flask import Blueprint, current_app, jsonify, request
from backend.services.level_service import list_levels, load_level, save_level

level_bp = Blueprint("levels", __name__)

@level_bp.get("/")
def get_levels():
    return jsonify({"levels": list_levels(current_app.config["LEVELS_DIR"])})

@level_bp.get("/<level_id>")
def get_level(level_id):
    level = load_level(current_app.config["LEVELS_DIR"], level_id)
    if level is None:
        return jsonify({"error": "找不到這個關卡"}), 404
    return jsonify(level)

@level_bp.post("/")
def create_level():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "請提供有效的 JSON 關卡資料"}), 400

    try:
        saved = save_level(current_app.config["LEVELS_DIR"], data)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    return jsonify(saved), 201
