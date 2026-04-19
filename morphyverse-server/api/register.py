import uuid
from datetime import datetime

import requests.exceptions
from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from config import INFERENCE_SERVER_URL
from db.database import get_db
from db.models import Object, CentralRegistry
from services.inference_relay import relay_register

router = APIRouter()


@router.post("/api/register")
async def register(
    object_name: str = Form(...),
    crop: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    crop_bytes = await crop.read()
    object_id = str(uuid.uuid4())

    try:
        await relay_register(object_id, object_name, crop_bytes)
    except requests.exceptions.ConnectionError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Cannot connect to inference server ({INFERENCE_SERVER_URL}): {e}",
        )
    except requests.exceptions.HTTPError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Inference server returned {e.response.status_code}: {e.response.text}",
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Inference server error: {type(e).__name__}: {e}")

    now = datetime.utcnow()
    db.add(Object(id=object_id, name=object_name, created_at=now))
    db.add(CentralRegistry(object_id=object_id, count=1, last_updated=now))
    db.commit()

    return {"object_id": object_id, "name": object_name}
