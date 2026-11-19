from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
INSTANCE_DIR = PROJECT_ROOT / "instance"
DATABASE_PATH = INSTANCE_DIR / "game.db"
LEVELS_DIR = PROJECT_ROOT / "levels"
SECRET_KEY = "local-development-key-change-before-distribution"
