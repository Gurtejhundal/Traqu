"""Exercise real authentication: conftest deliberately does not override it."""
import pytest
from fastapi.testclient import TestClient

import db
from main import app, get_current_user
from desktop_server import create_desktop_app
from web_security import COOKIE


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.delenv('VERCEL', raising=False)
    monkeypatch.delenv('TRAQU_LOCAL_MODE', raising=False)
    monkeypatch.setenv('TRAQU_SESSION_SECRET', 'security-test-only-stable-secret-1234567890')
    assert get_current_user not in app.dependency_overrides
    db.init_db()


def browser():
    return TestClient(app, base_url='https://testserver', headers={'Origin': 'https://testserver'})


def test_anonymous_browsers_cannot_select_another_owner(configured):
    with browser() as first, browser() as second:
        created = first.post('/roadmaps', json={'name': 'Private browser fixture', 'text': '# Week 1\n- Keep private'})
        assert created.status_code == 200, created.text
        rid = created.json()['id']
        cookie = created.headers['set-cookie'].lower()
        assert 'httponly' in cookie and 'secure' in cookie and 'samesite=strict' in cookie
        assert created.headers['cache-control'] == 'private, no-store'
        for headers in ({}, {'X-Local-User-Id': 'local_owner'}, {'X-Clerk-User-Id': 'local_owner'},
                        {'X-Local-User-Id': 'public_user', 'X-Traqo-Desktop-Token': 'forged'}):
            for prefix in ('', '/api'):
                assert second.get(f'{prefix}/roadmaps/{rid}/export', headers=headers).status_code == 404
                assert second.delete(f'{prefix}/roadmaps/{rid}', headers=headers).status_code == 404
        assert first.get(f'/roadmaps/{rid}').status_code == 200
        copied = dict(first.cookies)
    # A signed session works across app/client restarts with the same secret.
    with browser() as reopened:
        reopened.cookies.update(copied)
        assert reopened.get(f'/roadmaps/{rid}').status_code == 200
        reopened.delete(f'/roadmaps/{rid}')


@pytest.mark.parametrize('origin', [None, 'https://evil.example', 'null', 'https://testserver.evil.example'])
def test_mutations_require_the_workspace_origin(configured, origin):
    with browser() as client:
        client.get('/roadmaps')
        client.headers.pop('Origin')
        headers = {'Origin': origin} if origin is not None else {}
        assert client.post('/roadmaps', headers=headers,
                           json={'name': 'CSRF fixture', 'text': '- Do not create'}).status_code == 403


def test_tampered_session_is_rejected_and_cleared(configured):
    with browser() as client:
        client.get('/roadmaps')
        token = client.cookies.get(COOKIE)
        response = client.get('/roadmaps', headers={'Cookie': f'{COOKIE}={token[:-1]}z'})
        assert response.status_code == 401
        assert 'Max-Age=0' in response.headers['set-cookie']


@pytest.mark.parametrize('prefix', ['', '/api'])
def test_unconfigured_hosted_workspace_fails_closed(configured, monkeypatch, prefix):
    monkeypatch.delenv('TRAQU_SESSION_SECRET')
    with browser() as client:
        for headers in ({}, {'X-Local-User-Id': 'local_owner'}, {'X-Clerk-User-Id': 'local_owner'}):
            assert client.get(f'{prefix}/roadmaps', headers=headers).status_code == 503
        assert client.get('/').status_code == 200


@pytest.mark.parametrize('url', ['sqlite:////tmp/roadmap.db', 'sqlite+pysqlite:////tmp/roadmap.db', 'sqlite:///:memory:'])
def test_vercel_rejects_ephemeral_database_even_with_valid_secret(configured, monkeypatch, url):
    monkeypatch.setenv('VERCEL', '1')
    monkeypatch.setenv('DATABASE_URL', url)
    with browser() as client:
        assert client.get('/roadmaps').status_code == 503


@pytest.mark.parametrize('url', ['sqlite://', 'sqlite+pysqlite:///:memory:', 'sqlite:///file:session?mode=memory&uri=true'])
def test_other_hosts_reject_memory_databases(configured, monkeypatch, url):
    monkeypatch.setenv('DATABASE_URL', url)
    with browser() as client:
        assert client.get('/roadmaps').status_code == 503


def test_cross_site_sessions_are_explicit_and_still_check_origins(configured, monkeypatch):
    monkeypatch.setenv('FRONTEND_URL', 'https://frontend.example')
    with browser() as client:
        assert client.get('/roadmaps', headers={'Origin': 'https://frontend.example'}).status_code == 503
        monkeypatch.setenv('TRAQU_CROSS_SITE_SESSIONS', '1')
        response = client.get('/roadmaps', headers={'Origin': 'https://frontend.example'})
        assert response.status_code == 200
        assert 'SameSite=none' in response.headers['set-cookie']
        assert 'Secure' in response.headers['set-cookie']
        assert client.post('/roadmaps', headers={'Origin': 'https://attacker.example'}, json={
            'name': 'Blocked cross-site write', 'text': '- No'}).status_code == 403


def test_local_browser_mode_keeps_existing_owner_without_trusting_headers(configured, monkeypatch):
    monkeypatch.setenv('TRAQU_LOCAL_MODE', '1')
    rid = db.save_imported_roadmap('Existing local fixture', [{'title': 'Existing work', 'timeframe': 'General'}], 'local_owner')
    try:
        with TestClient(app, base_url='http://127.0.0.1', client=('127.0.0.1', 30000)) as client:
            assert client.get(f'/roadmaps/{rid}', headers={'X-Local-User-Id': 'other'}).status_code == 200
        with TestClient(app, base_url='http://127.0.0.1', client=('203.0.113.2', 30000)) as client:
            assert client.get('/roadmaps').status_code == 403
    finally:
        db.delete_roadmap(rid, 'local_owner')


def test_desktop_token_sets_trusted_identity_only_inside_desktop_host(configured, tmp_path):
    (tmp_path / 'index.html').write_text('<html>fixture</html>')
    token = 'a' * 64
    desktop = create_desktop_app(tmp_path, token)
    rid = db.save_imported_roadmap('Existing desktop fixture', [{'title': 'Local work', 'timeframe': 'General'}], 'local_owner')
    try:
        with TestClient(desktop, base_url='http://127.0.0.1') as client:
            assert client.get(f'/api/roadmaps/{rid}').status_code == 401
            assert client.get(f'/api/roadmaps/{rid}', headers={
                'X-Traqo-Desktop-Token': token, 'X-Local-User-Id': 'someone_else'}).status_code == 200
        with browser() as client:
            assert client.get(f'/roadmaps/{rid}', headers={'X-Traqo-Desktop-Token': token}).status_code == 404
    finally:
        db.delete_roadmap(rid, 'local_owner')
