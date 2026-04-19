import asyncio
import requests
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from config import INFERENCE_SERVER_URL
from db.database import get_db

router = APIRouter()


def _ping_inference() -> str:
    try:
        resp = requests.get(f"{INFERENCE_SERVER_URL}/health", timeout=1)
        resp.raise_for_status()
        return "reachable"
    except Exception:
        return "unreachable"


@router.get("/api/health")
async def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "error"

    inference_status = await asyncio.to_thread(_ping_inference)
    return {"status": "ok", "db": db_status, "inference_server": inference_status}
