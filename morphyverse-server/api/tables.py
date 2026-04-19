from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import Table

router = APIRouter()

VALID_TYPES = {"lab", "production"}


class TableCreate(BaseModel):
    id: str
    label: str
    type: str


class TablePatch(BaseModel):
    label: str


def _table_dict(t: Table) -> dict:
    return {"id": t.id, "label": t.label, "type": t.type}


@router.get("/api/tables")
def list_tables(db: Session = Depends(get_db)):
    return [_table_dict(t) for t in db.query(Table).all()]


@router.post("/api/tables", status_code=201)
def create_table(body: TableCreate, db: Session = Depends(get_db)):
    if body.type not in VALID_TYPES:
        raise HTTPException(status_code=422, detail=f"type must be one of {sorted(VALID_TYPES)}")
    if db.get(Table, body.id):
        raise HTTPException(status_code=409, detail="Table ID already exists")
    table = Table(id=body.id, label=body.label, type=body.type, created_at=datetime.utcnow())
    db.add(table)
    db.commit()
    db.refresh(table)
    return _table_dict(table)


@router.patch("/api/tables/{table_id}")
def patch_table(table_id: str, body: TablePatch, db: Session = Depends(get_db)):
    table = db.get(Table, table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    table.label = body.label
    db.commit()
    db.refresh(table)
    return _table_dict(table)
