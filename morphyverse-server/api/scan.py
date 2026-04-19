import json
import uuid
from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from config import INFERENCE_SERVER_URL
from db.database import get_db
from db.models import ScanLog
from services.inference_relay import relay_detect
from services.inventory_engine import process_scan

router = APIRouter()


@router.post("/api/scan")
async def scan(
    table_id: str = Form(...),
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    image_bytes = await image.read()

    try:
        result = await relay_detect(table_id, image_bytes)
    except httpx.ConnectError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Cannot connect to inference server ({INFERENCE_SERVER_URL}): {e}",
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Inference server returned {e.response.status_code}: {e.response.text}",
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Inference server error: {type(e).__name__}: {e}")

    detections = result.get("detections", [])
    latency_ms = result.get("latency_ms", 0)

    inventory_events = process_scan(db, table_id, detections)

    db.add(ScanLog(
        id=str(uuid.uuid4()),
        table_id=table_id,
        scanned_at=datetime.utcnow(),
        detections=json.dumps(detections),
        latency_ms=latency_ms,
    ))
    db.commit()

    return {
        "table_id": table_id,
        "detections": detections,
        "inventory_events": inventory_events,
    }
