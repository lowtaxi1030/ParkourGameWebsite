import sqlite3
from pathlib import Path
from flask import current_app

def get_connection():
    database_path = Path(current_app.config["DATABASE_PATH"])
    database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path)
    connection.row_factory = sqlite3.Row
    return connection

def init_database(app):
    database_path = Path(app.config["DATABASE_PATH"])
    database_path.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(database_path) as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS level_records (
                level_id TEXT PRIMARY KEY,
                level_name TEXT NOT NULL,
                file_name TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        connection.execute("""
            CREATE TABLE IF NOT EXISTS play_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                level_id TEXT NOT NULL,
                completion_seconds REAL,
                played_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
