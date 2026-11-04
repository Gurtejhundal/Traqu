import os
from pathlib import Path
import tempfile
import pytest
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))


_temporary_database_dir = None
test_database_url = os.getenv("TRAQU_TEST_DATABASE_URL")

if not test_database_url:
    _temporary_database_dir = tempfile.TemporaryDirectory(prefix="traqu-tests-")
    database_path = Path(_temporary_database_dir.name) / "roadmap-test.db"
    test_database_url = f"sqlite:///{database_path.as_posix()}"

# Set this before pytest imports database.py through any test module. load_dotenv
# does not override an existing value, so a developer database cannot be selected
# accidentally during a test run.
os.environ["DATABASE_URL"] = test_database_url


@pytest.fixture(autouse=True)
def functional_test_owner(request):
    """Old ownership/CRUD fixtures use explicit fake identities, not real auth.

    Authentication and desktop-boundary tests deliberately use the real
    dependency, so a test override cannot conceal a production bypass.
    """
    if request.module.__name__.split('.')[-1] in {'test_web_security', 'test_desktop_server'}:
        yield
        return
    from fastapi import Header
    from main import app, get_current_user
    def fixture_owner(x_local_user_id: str = Header(None), x_clerk_user_id: str = Header(None)):
        return x_local_user_id or x_clerk_user_id or 'public_user'
    app.dependency_overrides[get_current_user] = fixture_owner
    try:
        yield
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def pytest_sessionfinish(session, exitstatus):
    try:
        from database import engine

        engine.dispose()
    finally:
        if _temporary_database_dir is not None:
            _temporary_database_dir.cleanup()
