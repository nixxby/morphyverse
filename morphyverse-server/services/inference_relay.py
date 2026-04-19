import httpx
from config import INFERENCE_SERVER_URL


async def relay_detect(table_id: str, image_bytes: bytes) -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{INFERENCE_SERVER_URL}/detect",
            files={
                "image": ("image.jpg", image_bytes, "image/jpeg"),
                "table_id": (None, table_id),
            },
        )
        response.raise_for_status()
        return response.json()


async def relay_register(object_id: str, object_name: str, crop_bytes: bytes) -> None:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{INFERENCE_SERVER_URL}/register",
            files={
                "crop": ("crop.jpg", crop_bytes, "image/jpeg"),
                "object_id": (None, object_id),
                "object_name": (None, object_name),
            },
        )
        response.raise_for_status()
