"""Server-owned browser identity; public owner headers are never credentials."""
import hashlib
import hmac
import os
from pathlib import Path
import secrets
import time
from urllib.parse import urlsplit
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError

from fastapi import HTTPException, Request, Response

COOKIE = "traqu_workspace"
MAX_AGE = 60 * 60 * 24 * 180


def local_mode():
    return os.getenv("TRAQU_LOCAL_MODE") == "1" and not os.getenv("VERCEL")


def _secret():
    configured = os.getenv("TRAQU_SESSION_SECRET", "")
    if len(configured) >= 32:
        return configured.encode()
    if not local_mode():
        raise HTTPException(503, "The web workspace is not configured yet. Set a stable TRAQU_SESSION_SECRET and durable DATABASE_URL, or use the private desktop app.")
    path = Path(__file__).resolve().parent / ".traqu-session-key"
    try:
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        pass
    else:
        with os.fdopen(descriptor, "w") as output:
            output.write(secrets.token_hex(32))
    value = path.read_bytes().strip()
    if len(value) < 32:
        raise HTTPException(503, "The local session key is invalid. Restore it from your local backup.")
    return value


def _origin(value):
    try:
        parsed = urlsplit(value)
        if parsed.scheme not in {'http', 'https'} or not parsed.hostname or parsed.username or parsed.password:
            return None
        return parsed.scheme.lower(), parsed.netloc.lower()
    except ValueError:
        return None


def browser_user(request: Request, response: Response):
    trusted = getattr(request.state, "traqu_desktop_owner", None)
    if trusted is not None:
        return trusted
    local = local_mode()
    if local:
        if request.url.hostname not in {"127.0.0.1", "localhost", "::1"} or request.client.host not in {"127.0.0.1", "::1"}:
            raise HTTPException(403, "Local browser mode accepts loopback requests only.")
    else:
        database = os.getenv("DATABASE_URL", "")
        try:
            url = make_url(database)
            sqlite = url.get_backend_name() == 'sqlite'
            ephemeral = sqlite and (bool(os.getenv('VERCEL')) or not url.database
                                    or url.database == ':memory:' or url.query.get('mode') == 'memory')
        except ArgumentError:
            ephemeral = True
        if not database or ephemeral:
            raise HTTPException(503, "The hosted workspace needs a durable DATABASE_URL. The desktop app remains available for private local work.")
    secret = _secret()
    cross_site = not local and os.getenv('TRAQU_CROSS_SITE_SESSIONS') == '1'
    origin = request.headers.get('Origin', '')
    allowed = {_origin(str(request.base_url))}
    configured = os.getenv('TRAQU_CORS_ORIGINS', '') + ',' + os.getenv('FRONTEND_URL', '')
    allowed.update(normalized for value in configured.split(',') if (normalized := _origin(value.strip())))
    if local:
        allowed.update(_origin(value) for value in (
            'http://127.0.0.1:5173', 'http://localhost:5173',
            'http://127.0.0.1:4173', 'http://localhost:4173',
        ))
    if origin and _origin(origin) not in allowed:
        raise HTTPException(403, 'This request did not come from the workspace. Reload Traqu and try again.')
    if not local and origin and _origin(origin) != _origin(str(request.base_url)) and not cross_site:
        raise HTTPException(503, "Use the same-origin /api proxy for this workspace. Cross-site sessions need explicit server configuration.")
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        if not origin or _origin(origin) not in allowed:
            raise HTTPException(403, "This request did not come from the workspace. Reload Traqu and try again.")
    encoded = request.cookies.get(COOKIE)
    if encoded:
        try:
            owner, timestamp, signature = encoded.split(".")
            payload = f"{owner}.{timestamp}"
            expected = hmac.new(secret, payload.encode(), hashlib.sha256).hexdigest()
            issued = int(timestamp)
            valid_owner = owner == "local_owner" if local else owner.startswith("web_") and len(owner) == 68
            if not valid_owner or not hmac.compare_digest(signature, expected) or not 0 <= time.time() - issued <= MAX_AGE:
                raise ValueError("Invalid browser session")
            return owner
        except (ValueError, TypeError):
            raise HTTPException(401, "Your browser session expired or could not be verified. Reload to start a new workspace, or restore a backup.",
                                headers={"Set-Cookie": f"{COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite={'None; Secure' if cross_site else 'Strict'}"})
    owner = "local_owner" if local else "web_" + secrets.token_hex(32)
    payload = f"{owner}.{int(time.time())}"
    signature = hmac.new(secret, payload.encode(), hashlib.sha256).hexdigest()
    response.set_cookie(COOKIE, f"{payload}.{signature}", max_age=MAX_AGE,
                        httponly=True, secure=not local, samesite='none' if cross_site else 'strict', path="/")
    response.headers["Cache-Control"] = "private, no-store"
    return owner
