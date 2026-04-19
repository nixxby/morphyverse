import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from config import INFERENCE_SERVER_URL
from db.database import get_db

router = APIRouter()


@router.get("/api/health")
async def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "error"

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{INFERENCE_SERVER_URL}/health")
            resp.raise_for_status()
        inference_status = "reachable"
    except Exception:
        inference_status = "unreachable"

    return {"status": "ok", "db": db_status, "inference_server": inference_status}
