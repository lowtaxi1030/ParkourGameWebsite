import sqlite3

from backend import create_app


def test_database_tables_are_created(tmp_path, monkeypatch):
    monkeypatch.setenv("PYTHONUTF8", "1")
    app = create_app()
    app.config["DATABASE_PATH"] = tmp_path / "test.db"

    # init_database reads the configured path when called a second time.
    from backend.database.connection import init_database
    init_database(app)

    with sqlite3.connect(app.config["DATABASE_PATH"]) as connection:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }

    assert {"level_records", "play_records"} <= tables
