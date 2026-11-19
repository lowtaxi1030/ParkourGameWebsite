from flask import Blueprint, render_template

page_bp = Blueprint("pages", __name__)

@page_bp.get("/")
def home():
    return render_template("index.html")

@page_bp.get("/game")
def game_page():
    return render_template("game.html")

@page_bp.get("/editor")
def editor_page():
    return render_template("editor.html")

@page_bp.get("/levels")
def levels_page():
    return render_template("levels.html")
