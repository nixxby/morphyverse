import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import Object

router = APIRouter()


@router.get("/api/embeddings")
def get_embeddings(db: Session = Depends(get_db)):
    objects = (
        db.query(Object)
        .filter(Object.retired_at.is_(None), Object.embedding.isnot(None))
        .all()
    )
    return [
        {
            "object_id": obj.id,
            "name": obj.name,
            "embedding": json.loads(obj.embedding),
        }
        for obj in objects
    ]
