from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import CentralRegistry, Object, TableInventory, Table, OutgoingRegistry

router = APIRouter()


@router.get("/api/inventory")
def get_inventory(db: Session = Depends(get_db)):
    rows = (
        db.query(CentralRegistry, Object)
        .join(Object, CentralRegistry.object_id == Object.id)
        .filter(Object.retired_at.is_(None))
        .all()
    )
    return [
        {"object_id": cr.object_id, "name": obj.name, "count": cr.count}
        for cr, obj in rows
    ]


@router.get("/api/inventory/locate")
def locate_inventory(name: str = Query(...), db: Session = Depends(get_db)):
    rows = (
        db.query(TableInventory, Object, Table)
        .join(Object, TableInventory.object_id == Object.id)
        .join(Table, TableInventory.table_id == Table.id)
        .filter(Object.name.ilike(f"%{name}%"))
        .filter(Object.retired_at.is_(None))
        .all()
    )
    return [
        {
            "object_id": ti.object_id,
            "object_name": obj.name,
            "table_id": ti.table_id,
            "table_label": tbl.label,
            "count": ti.count,
            "last_seen": ti.last_seen.isoformat() + "Z",
        }
        for ti, obj, tbl in rows
    ]


@router.get("/api/inventory/outgoing")
def get_outgoing(db: Session = Depends(get_db)):
    rows = (
        db.query(OutgoingRegistry, Object, Table)
        .join(Object, OutgoingRegistry.object_id == Object.id)
        .join(Table, OutgoingRegistry.table_id == Table.id)
        .order_by(OutgoingRegistry.disappeared_at.desc())
        .all()
    )
    return [
        {
            "id": og.id,
            "object_id": og.object_id,
            "object_name": obj.name,
            "table_id": og.table_id,
            "table_label": tbl.label,
            "quantity": og.quantity,
            "disappeared_at": og.disappeared_at.isoformat() + "Z",
        }
        for og, obj, tbl in rows
    ]
