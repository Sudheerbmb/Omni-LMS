import os
from pathlib import Path
from tempfile import NamedTemporaryFile

import httpx


VIMEO_API_URL = "https://api.vimeo.com"
VIMEO_ACCESS_TOKEN = os.getenv("VIMEO_ACCESS_TOKEN")


async def upload_zoom_recording(recording: dict) -> str | None:
    if not VIMEO_ACCESS_TOKEN:
        raise RuntimeError("VIMEO_ACCESS_TOKEN is not configured")

    download_url = recording.get("download_url")
    if not download_url:
        raise ValueError("Zoom recording does not contain a download_url")

    download_token = recording.get("download_token")
    if download_token:
        separator = "&" if "?" in download_url else "?"
        download_url = f"{download_url}{separator}access_token={download_token}"

    name = recording.get("file_name") or "Zoom recording"
    headers = {"Authorization": f"Bearer {VIMEO_ACCESS_TOKEN}"}

    async with httpx.AsyncClient(timeout=None, follow_redirects=True) as client:
        response = await client.get(download_url)
        response.raise_for_status()

        with NamedTemporaryFile(prefix="zoom-recording-", suffix=".mp4", delete=False) as temp_file:
            temp_path = Path(temp_file.name)
            temp_file.write(response.content)

        try:
            create_response = await client.post(
                f"{VIMEO_API_URL}/me/videos",
                headers={**headers, "Content-Type": "application/json"},
                json={
                    "name": name,
                    "upload": {
                        "approach": "tus",
                        "size": str(temp_path.stat().st_size),
                    },
                },
            )
            create_response.raise_for_status()
            upload_link = create_response.json().get("upload", {}).get("upload_link")
            if not upload_link:
                raise RuntimeError("Vimeo did not return an upload link")

            with temp_path.open("rb") as video_file:
                upload_response = await client.patch(
                    upload_link,
                    headers={
                        "Tus-Resumable": "1.0.0",
                        "Upload-Offset": "0",
                        "Content-Type": "application/offset+octet-stream",
                    },
                    content=video_file.read(),
                )
            upload_response.raise_for_status()
            return create_response.json().get("uri")
        finally:
            temp_path.unlink(missing_ok=True)