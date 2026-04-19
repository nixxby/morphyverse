from datetime import datetime
from sqlalchemy.orm import Session
from db.models import CentralRegistry, Table, TableInventory, OutgoingRegistry
import uuid


def get_table(db: Session, table_id: str) -> Table | None:
    return db.get(Table, table_id)


def get_central_count(db: Session, object_id: str) -> int:
    row = db.get(CentralRegistry, object_id)
    return row.count if row else 0


def set_central_count(db: Session, object_id: str, count: int) -> None:
    row = db.get(CentralRegistry, object_id)
    if row:
        row.count = count
        row.last_updated = datetime.utcnow()
    else:
        db.add(CentralRegistry(object_id=object_id, count=count, last_updated=datetime.utcnow()))
    db.flush()


def get_table_inventory(db: Session, table_id: str) -> list[TableInventory]:
    return db.query(TableInventory).filter(TableInventory.table_id == table_id).all()


def upsert_table_inventory(
    db: Session,
    table_id: str,
    object_id: str,
    count: int,
    confidence: float,
) -> None:
    row = db.get(TableInventory, (table_id, object_id))
    now = datetime.utcnow()
    if row:
        row.count = count
        row.confidence_avg = confidence
        row.last_seen = now
        row.consecutive_absent_scans = 0
    else:
        db.add(TableInventory(
            table_id=table_id,
            object_id=object_id,
            count=count,
            confidence_avg=confidence,
            first_seen=now,
            last_seen=now,
            consecutive_absent_scans=0,
        ))
    db.flush()


def increment_absent(db: Session, table_id: str, object_id: str) -> int:
    row = db.get(TableInventory, (table_id, object_id))
    if row:
        row.consecutive_absent_scans += 1
        db.flush()
        return row.consecutive_absent_scans
    return 0


def remove_table_inventory(db: Session, table_id: str, object_id: str) -> None:
    row = db.get(TableInventory, (table_id, object_id))
    if row:
        db.delete(row)
        db.flush()


def insert_outgoing(db: Session, table_id: str, object_id: str, quantity: int) -> None:
    db.add(OutgoingRegistry(
        id=str(uuid.uuid4()),
        table_id=table_id,
        object_id=object_id,
        quantity=quantity,
        disappeared_at=datetime.utcnow(),
    ))
    db.flush()
