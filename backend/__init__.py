from pathlib import Path
from flask import Flask

def create_app():
    project_root = Path(__file__).resolve().parent.parent

    app = Flask(
        __name__,
        template_folder=str(project_root / "frontend" / "templates"),
        static_folder=str(project_root / "frontend" / "static"),
        static_url_path="/static",
    )
    app.config.from_pyfile("config.py")
    app.config["PROJECT_ROOT"] = project_root

    from backend.database.connection import init_database
    from backend.routes.page_routes import page_bp
    from backend.routes.level_routes import level_bp

    init_database(app)
    app.register_blueprint(page_bp)
    app.register_blueprint(level_bp, url_prefix="/api/levels")

    return app
