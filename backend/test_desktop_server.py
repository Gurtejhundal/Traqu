from pathlib import Path

from fastapi.testclient import TestClient
import pytest

from desktop_server import create_desktop_app


@pytest.fixture
def desktop(tmp_path: Path):
    (tmp_path / "index.html").write_text("<html>Traqo workspace</html>")
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "app.js").write_text("console.log('local')")
    with TestClient(create_desktop_app(tmp_path, "a" * 64), base_url="http://127.0.0.1") as client:
        yield client


def test_desktop_api_requires_private_session(desktop):
    for route in ["/api/", "/api/roadmaps", "/api/docs"]:
        assert desktop.get(route).status_code == 401
    assert desktop.get("/api/", headers={"X-Traqo-Desktop-Token": "wrong"}).status_code == 401
    assert desktop.get("/api/", headers={b"X-Traqo-Desktop-Token": b"\xc3\xa9"}).status_code == 401
    response = desktop.get("/api/", headers={"X-Traqo-Desktop-Token": "a" * 64})
    assert response.status_code == 200
    assert response.json()["message"] == "Welcome to Roadmap Tracer API"


def test_desktop_deep_links_and_missing_assets(desktop):
    assert "Traqo workspace" in desktop.get("/roadmap/123").text
    assert desktop.get("/assets/app.js").status_code == 200
    assert desktop.get("/assets/missing.js").status_code == 404
    assert desktop.get("/roadmap/123", headers={"Host": "evil.test"}).status_code == 400


def test_desktop_headers_restrict_active_content(desktop):
    response = desktop.get("/")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert "script-src 'self'" in response.headers["content-security-policy"]
    assert "connect-src 'self'" in response.headers["content-security-policy"]
