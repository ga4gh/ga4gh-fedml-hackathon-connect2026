"""
Simple DRS 1.5 mock server.

Serves files from a local directory as DRS objects.
Each file is identified by the SHA-256 of its content (content-addressable).
Access control is not enforced — all calls are logged.

Usage:
    uvicorn main:app --host 0.0.0.0 --port 8080

Environment variables:
    DRS_DATA_DIR   Directory to serve files from (default: ./data)
    DRS_HOST       Public hostname/IP for self_uri and access URLs (default: localhost)
    DRS_PORT       Public port (default: 8080)
    DRS_CORS_ORIGINS Comma-separated allowed browser origins
                     (default: http://localhost:5173,http://127.0.0.1:5173)
"""

import hashlib
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DATA_DIR = Path(os.environ.get("DRS_DATA_DIR", "data")).resolve()
DRS_HOST = os.environ.get("DRS_HOST", "localhost")
DRS_PORT = int(os.environ.get("DRS_PORT", "8080"))
DRS_CORS_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "DRS_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("drs-mock")

app = FastAPI(title="DRS Mock", version="1.5.0")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _md5(path: Path) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


def _public_base() -> str:
    return f"http://{DRS_HOST}:{DRS_PORT}"


def _cors_origin(origin: str | None) -> str | None:
    if not origin:
        return None
    if "*" in DRS_CORS_ORIGINS:
        return origin
    if origin in DRS_CORS_ORIGINS:
        return origin
    return None


def _build_object(path: Path, object_id: str) -> dict:
    stat = path.stat()
    return {
        "id": object_id,
        "name": path.name,
        "self_uri": f"drs://{DRS_HOST}/{object_id}",
        "size": stat.st_size,
        "created_time": _iso(stat.st_ctime),
        "updated_time": _iso(stat.st_mtime),
        "checksums": [
            {"type": "sha-256", "checksum": _sha256(path)},
            {"type": "md5", "checksum": _md5(path)},
        ],
        "access_methods": [
            {
                "type": "https",
                "access_id": "local-https",
                "region": "local",
            }
        ],
        "description": f"File served by DRS mock from {path}",
        "version": "1",
    }


# ---------------------------------------------------------------------------
# Object index — built lazily from DATA_DIR
# ---------------------------------------------------------------------------

def _index() -> dict[str, Path]:
    """Return mapping from object_id -> absolute Path for all files in DATA_DIR."""
    if not DATA_DIR.exists():
        return {}
    result: dict[str, Path] = {}
    for p in sorted(DATA_DIR.rglob("*")):
        if p.is_file():
            oid = _sha256(p)
            result[oid] = p
    return result


# ---------------------------------------------------------------------------
# Logging middleware
# ---------------------------------------------------------------------------

@app.middleware("http")
async def log_requests(request: Request, call_next):
    allowed_origin = _cors_origin(request.headers.get("origin"))

    if request.method == "OPTIONS":
        response = Response(status_code=204)
    else:
        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000
        log.info(
            "method=%s path=%s status=%d client=%s elapsed_ms=%.1f",
            request.method,
            request.url.path,
            response.status_code,
            request.client.host if request.client else "unknown",
            elapsed_ms,
        )

    if allowed_origin is not None:
        response.headers["Access-Control-Allow-Origin"] = allowed_origin
        response.headers["Vary"] = "Origin"
        response.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,PATCH,DELETE,OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = request.headers.get(
            "access-control-request-headers", "*"
        )

    return response


# ---------------------------------------------------------------------------
# DRS 1.5 endpoints
# ---------------------------------------------------------------------------

@app.get("/ga4gh/drs/v1/service-info")
def service_info():
    return {
        "id": "org.ga4gh.drs.mock",
        "name": "DRS Mock",
        "type": {"group": "org.ga4gh", "artifact": "drs", "version": "1.5.0"},
        "description": "Simple DRS mock that serves files from a local directory",
        "organization": {"name": "Local", "url": _public_base()},
        "version": "1.5.0",
        "supported_filters": [],
    }


@app.get("/ga4gh/drs/v1/objects")
def list_objects():
    """Non-standard convenience endpoint — not in DRS spec but useful for discovery."""
    index = _index()
    return {
        "objects": [
            {
                "id": oid,
                "name": path.name,
                "self_uri": f"drs://{DRS_HOST}/{oid}",
                "size": path.stat().st_size,
            }
            for oid, path in index.items()
        ]
    }


@app.get("/ga4gh/drs/v1/objects/{object_id}")
def get_object(object_id: str, expand: bool = False):
    index = _index()
    path = index.get(object_id)
    if path is None:
        raise HTTPException(status_code=404, detail=f"Object '{object_id}' not found")
    return _build_object(path, object_id)


@app.get("/ga4gh/drs/v1/objects/{object_id}/access/{access_id}")
def get_access_url(object_id: str, access_id: str):
    index = _index()
    path = index.get(object_id)
    if path is None:
        raise HTTPException(status_code=404, detail=f"Object '{object_id}' not found")
    if access_id != "local-https":
        raise HTTPException(status_code=404, detail=f"Access ID '{access_id}' not found")
    url = f"{_public_base()}/files/{object_id}/{path.name}"
    return {"url": url, "headers": {}}


# ---------------------------------------------------------------------------
# File download endpoint (backing the access URL above)
# ---------------------------------------------------------------------------

@app.get("/files/{object_id}/{filename}")
def download_file(object_id: str, filename: str):
    index = _index()
    path = index.get(object_id)
    if path is None or path.name != filename:
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, filename=path.name)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    log.info("Serving files from %s", DATA_DIR)
    uvicorn.run(app, host="0.0.0.0", port=DRS_PORT)
