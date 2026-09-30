"""
Pluggable file storage: local filesystem or AWS S3.
All public methods return a publicly accessible URL.
"""
import os
import uuid
from pathlib import Path

import aiofiles

from app.platform.config import settings
from app.platform.logging import get_logger

logger = get_logger(__name__)


def _extension(filename: str) -> str:
    return Path(filename).suffix.lower()


def _safe_key(filename: str, prefix: str = "") -> str:
    ext = _extension(filename)
    key = f"{prefix}/{uuid.uuid4().hex}{ext}" if prefix else f"{uuid.uuid4().hex}{ext}"
    return key


# ── Local storage ─────────────────────────────────────────────────────────────

async def _save_local(data: bytes, filename: str, prefix: str = "") -> str:
    upload_dir = Path(settings.local_upload_dir)
    subdir = upload_dir / prefix if prefix else upload_dir
    subdir.mkdir(parents=True, exist_ok=True)
    key = f"{uuid.uuid4().hex}{_extension(filename)}"
    dest = subdir / key
    async with aiofiles.open(dest, "wb") as f:
        await f.write(data)
    relative = f"{prefix}/{key}" if prefix else key
    return f"{settings.frontend_url}/uploads/{relative}"


async def _delete_local(url: str) -> None:
    # Extract path after /uploads/
    try:
        rel = url.split("/uploads/", 1)[1]
        path = Path(settings.local_upload_dir) / rel
        if path.exists():
            path.unlink()
    except Exception as exc:
        logger.warning("local_delete_failed", url=url, error=str(exc))


# ── S3 storage ────────────────────────────────────────────────────────────────

async def _save_s3(data: bytes, filename: str, prefix: str = "") -> str:
    import boto3  # type: ignore

    key = _safe_key(filename, prefix)
    s3 = boto3.client(
        "s3",
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        region_name=settings.aws_region,
    )
    s3.put_object(Bucket=settings.s3_bucket, Key=key, Body=data, ACL="public-read")
    base = settings.s3_public_url or f"https://{settings.s3_bucket}.s3.{settings.aws_region}.amazonaws.com"
    return f"{base}/{key}"


async def _delete_s3(url: str) -> None:
    import boto3  # type: ignore

    try:
        base = settings.s3_public_url or f"https://{settings.s3_bucket}.s3.{settings.aws_region}.amazonaws.com"
        key = url.replace(f"{base}/", "")
        s3 = boto3.client(
            "s3",
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_region,
        )
        s3.delete_object(Bucket=settings.s3_bucket, Key=key)
    except Exception as exc:
        logger.warning("s3_delete_failed", url=url, error=str(exc))


# ── Public API ────────────────────────────────────────────────────────────────

async def upload_file(data: bytes, filename: str, prefix: str = "") -> str:
    """Upload file bytes and return the public URL."""
    size_mb = len(data) / (1024 * 1024)
    if size_mb > settings.max_upload_size_mb:
        raise ValueError(f"File exceeds maximum allowed size of {settings.max_upload_size_mb} MB")

    if settings.storage_backend == "s3":
        return await _save_s3(data, filename, prefix)
    return await _save_local(data, filename, prefix)


async def delete_file(url: str) -> None:
    """Delete a file by its public URL."""
    if settings.storage_backend == "s3":
        await _delete_s3(url)
    else:
        await _delete_local(url)
