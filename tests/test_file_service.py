from backend.services.level_service import list_levels, load_level


def test_example_levels_are_listed_and_loaded(tmp_path):
    examples = tmp_path / "examples"
    examples.mkdir()
    (examples / "demo.json").write_text(
        '{"metadata":{"name":"Demo"},"settings":{"width":320},"objects":[]}',
        encoding="utf-8",
    )

    levels = list_levels(tmp_path)

    assert any(level["id"] == "demo" for level in levels)
    assert load_level(tmp_path, "demo")["metadata"]["name"] == "Demo"
