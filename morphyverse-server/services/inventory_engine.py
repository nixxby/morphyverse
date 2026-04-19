from sqlalchemy.orm import Session
from config import GRACE_PERIOD
from services import registry
from db.models import Object


def process_scan(db: Session, table_id: str, new_detections: list[dict]) -> list[dict]:
    events: list[dict] = []

    current_state = {row.object_id: row for row in registry.get_table_inventory(db, table_id)}
    table = registry.get_table(db, table_id)
    new_ids = {d["object_id"] for d in new_detections}

    for det in new_detections:
        oid = det["object_id"]
        count = det["count"]
        confidence = det.get("confidence", 0.0)

        if oid not in current_state:
            central_count = registry.get_central_count(db, oid)
            registry.set_central_count(db, oid, max(0, central_count - count))
            registry.upsert_table_inventory(db, table_id, oid, count, confidence)
            obj_name = _get_name(db, oid, det)
            events.append({
                "event_type": "checkout",
                "object_id": oid,
                "object_name": obj_name,
                "table_id": table_id,
                "quantity": count,
            })
        else:
            registry.upsert_table_inventory(db, table_id, oid, count, confidence)

    for oid, row in current_state.items():
        if oid not in new_ids:
            absent = registry.increment_absent(db, table_id, oid)

            if absent >= GRACE_PERIOD:
                obj_name = _get_name(db, oid, {})
                row_count = row.count

                if table.type == "lab":
                    central_count = registry.get_central_count(db, oid)
                    registry.set_central_count(db, oid, central_count + row_count)
                    registry.remove_table_inventory(db, table_id, oid)
                    events.append({
                        "event_type": "return",
                        "object_id": oid,
                        "object_name": obj_name,
                        "table_id": table_id,
                        "quantity": row_count,
                    })

                elif table.type == "production":
                    registry.insert_outgoing(db, table_id, oid, row_count)
                    registry.remove_table_inventory(db, table_id, oid)
                    events.append({
                        "event_type": "consumed",
                        "object_id": oid,
                        "object_name": obj_name,
                        "table_id": table_id,
                        "quantity": row_count,
                    })

    db.commit()
    return events


def _get_name(db: Session, object_id: str, det: dict) -> str:
    if det.get("name"):
        return det["name"]
    obj = db.get(Object, object_id)
    return obj.name if obj else object_id
