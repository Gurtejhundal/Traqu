"""Private desktop host. The normal web API and its database defaults stay intact."""

import asyncio
from contextlib import asynccontextmanager
import json
import os
from pathlib import Path
import secrets
import socket
import sys
import threading

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from starlette.staticfiles import StaticFiles
from starlette.exceptions import HTTPException
from starlette.middleware.trustedhost import TrustedHostMiddleware
import uvicorn


class SPAFiles(StaticFiles):
    async def get_response(self, path, scope):
        try:
            return await super().get_response(path, scope)
        except HTTPException as error:
            # BrowserRouter deep links resolve to the app; missing assets remain 404.
            if error.status_code == 404 and "." not in Path(path).name and scope["method"] in {"GET", "HEAD"}:
                return await super().get_response("index.html", scope)
            raise


def create_desktop_app(frontend_dir: Path, token: str):
    # Import only after main() selects the private desktop database.
    from main import app as api

    @asynccontextmanager
    async def lifespan(app):
        async with api.router.lifespan_context(api):
            yield

    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1"])

    @app.middleware("http")
    async def private_api(request, call_next):
        if request.url.path == "/api" or request.url.path.startswith("/api/"):
            supplied = request.headers.get("x-traqo-desktop-token", "")
            if not secrets.compare_digest(supplied.encode(), token.encode()):
                return JSONResponse({"detail": "Desktop session required."}, status_code=401)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; "
            "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
        )
        return response

    app.mount("/api", api)
    app.mount("/", SPAFiles(directory=frontend_dir, html=True))
    return app


def main():
    data_dir = Path(os.environ["TRAQO_DATA_DIR"]).resolve()
    frontend_dir = Path(os.environ["TRAQO_FRONTEND_DIR"]).resolve()
    token = os.environ["TRAQO_DESKTOP_TOKEN"]
    if len(token) < 32:
        raise RuntimeError("A private desktop session token is required.")
    data_dir.mkdir(parents=True, exist_ok=True)
    # Never pick up the web app's .env/database, including in a frozen build.
    os.environ["DATABASE_URL"] = f"sqlite:///{(data_dir / 'roadmap.db').as_posix()}"
    os.environ.pop("VERCEL", None)

    listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    listener.bind(("127.0.0.1", 0))
    listener.listen(128)
    port = listener.getsockname()[1]
    server = uvicorn.Server(uvicorn.Config(
        create_desktop_app(frontend_dir, token), host="127.0.0.1", port=port,
        log_level="warning", access_log=False, timeout_graceful_shutdown=5,
    ))

    # A pipe owned by Electron closes even if the parent crashes or is killed.
    def watch_parent():
        try:
            sys.stdin.buffer.read()
        finally:
            server.should_exit = True

    threading.Thread(target=watch_parent, daemon=True).start()
    print(json.dumps({"event": "listening", "port": port}), flush=True)
    try:
        asyncio.run(server.serve(sockets=[listener]))
    finally:
        listener.close()


if __name__ == "__main__":
    main()
