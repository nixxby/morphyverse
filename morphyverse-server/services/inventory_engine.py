from sqlalchemy.orm import Session
from config import GRACE_PERIOD
from services import registry
from db.models import Object


def process_scan(db: Session, table_id: str, new_detections: list[dict]) -> list[dict]:
    events: list[dict] = []

    # Aggregate detections by name — multiple crops of the same physical object
    # each have a distinct object_id but share a name; treat them as one.
    detections_by_name: dict[str, dict] = {}
    for det in new_detections:
        name = det["name"]
        if name not in detections_by_name:
            detections_by_name[name] = dict(det)
        else:
            detections_by_name[name]["count"] += det["count"]

    # Build current table state keyed by object name.
    current_state_by_name: dict[str, object] = {}
    for row in registry.get_table_inventory(db, table_id):
        obj = db.get(Object, row.object_id)
        name = obj.name if obj else row.object_id
        current_state_by_name[name] = row

    table = registry.get_table(db, table_id)

    for name, det in detections_by_name.items():
        count = det["count"]
        confidence = det.get("confidence", 0.0)
        oid = det["object_id"]

        if name not in current_state_by_name:
            central_count = registry.get_central_count(db, oid)
            registry.set_central_count(db, oid, max(0, central_count - count))
            registry.upsert_table_inventory(db, table_id, oid, count, confidence)
            events.append({
                "event_type": "checkout",
                "object_id": oid,
                "object_name": name,
                "table_id": table_id,
                "quantity": count,
            })
        else:
            # Keep the stored object_id; just refresh count and reset absent counter.
            existing = current_state_by_name[name]
            registry.upsert_table_inventory(db, table_id, existing.object_id, count, confidence)

    for name, row in current_state_by_name.items():
        if name not in detections_by_name:
            absent = registry.increment_absent(db, table_id, row.object_id)

            if absent >= GRACE_PERIOD:
                row_count = row.count

                if table.type == "lab":
                    central_count = registry.get_central_count(db, row.object_id)
                    registry.set_central_count(db, row.object_id, central_count + row_count)
                    registry.remove_table_inventory(db, table_id, row.object_id)
                    events.append({
                        "event_type": "return",
                        "object_id": row.object_id,
                        "object_name": name,
                        "table_id": table_id,
                        "quantity": row_count,
                    })

                elif table.type == "production":
                    registry.insert_outgoing(db, table_id, row.object_id, row_count)
                    registry.remove_table_inventory(db, table_id, row.object_id)
                    events.append({
                        "event_type": "consumed",
                        "object_id": row.object_id,
                        "object_name": name,
                        "table_id": table_id,
                        "quantity": row_count,
                    })

    db.commit()
    return events
