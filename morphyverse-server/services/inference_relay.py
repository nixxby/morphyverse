import asyncio
import requests
from config import INFERENCE_SERVER_URL

# ngrok free tier requires this header to skip the browser-warning interstitial
_NGROK_HEADERS = {"ngrok-skip-browser-warning": "true"}


def _detect_sync(table_id: str, image_bytes: bytes) -> dict:
    resp = requests.post(
        f"{INFERENCE_SERVER_URL}/detect",
        headers=_NGROK_HEADERS,
        files=[
            ("table_id", (None, table_id)),
            ("image",    ("image.jpg", image_bytes, "image/jpeg")),
        ],
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def _register_sync(object_id: str, object_name: str, crop_bytes: bytes) -> None:
    resp = requests.post(
        f"{INFERENCE_SERVER_URL}/register",
        headers=_NGROK_HEADERS,
        files=[
            ("object_id",   (None, object_id)),
            ("object_name", (None, object_name)),
            ("crop",        ("crop.jpg", crop_bytes, "image/jpeg")),
        ],
        timeout=30,
    )
    resp.raise_for_status()


async def relay_detect(table_id: str, image_bytes: bytes) -> dict:
    return await asyncio.to_thread(_detect_sync, table_id, image_bytes)


async def relay_register(object_id: str, object_name: str, crop_bytes: bytes) -> None:
    await asyncio.to_thread(_register_sync, object_id, object_name, crop_bytes)
