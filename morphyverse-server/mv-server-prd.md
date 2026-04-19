# MorphyVerse — Replit Server (Central Hub + Inventory DB)
### Technical Design Document — Person 2 of 3
*April 2026*

---

## Context

You are building the Replit server — the central hub of MorphyVerse. It sits between the phone PWA (Person 3) and the inference laptop (Person 1). Phones never talk to the laptop directly. You receive images and commands from phones, relay images to the laptop for inference, run inventory logic, persist everything in SQLite, and serve inventory data back to phones.

Two contracts govern your work:
1. **Downstream contract** — what the phone PWA sends you and expects back (defined below)
2. **Upstream contract** — what you send the inference laptop and expect back (defined below)

Do not deviate from these shapes.

---

## API Contract — Exposed to Phone PWA (Person 3 calls these)

---

### `POST /api/scan`

**Request:** `multipart/form-data`

| Field | Type | Description |
|---|---|---|
| `table_id` | string | ID of the table being scanned |
| `image` | file (JPEG) | Camera frame from phone |

**Response:** `application/json`

```json
{
  "table_id": "bench-west-01",
  "detections": [
    {
      "object_id": "uuid-string",
      "name": "775 DC Motor",
      "count": 2,
      "confidence": 0.82,
      "bboxes": [[x1, y1, x2, y2], [x1, y1, x2, y2]]
    }
  ],
  "inventory_events": [
    {
      "event_type": "checkout",
      "object_id": "uuid-string",
      "object_name": "775 DC Motor",
      "table_id": "bench-west-01",
      "quantity": 2
    }
  ]
}
```

- `detections` is always an array, never `null`
- `inventory_events` is an array of state changes that happened as a result of this scan. Types: `checkout`, `return`, `consumed`. Empty array if no state changed.
- `bboxes` are pixel coordinates `[x1, y1, x2, y2]` as returned by the inference laptop — pass them through unchanged

---

### `POST /api/register`

**Request:** `multipart/form-data`

| Field | Type | Description |
|---|---|---|
| `object_name` | string | Human-readable name e.g. `"ESP32-C3"` |
| `crop` | file (JPEG) | Bounding box crop from phone |

**Response:** `application/json`

```json
{
  "object_id": "uuid-string",
  "name": "ESP32-C3"
}
```

- On success: relay crop to inference laptop, receive embedding, store object + embedding in DB, seed `central_registry` with `count = 1`, return `object_id` and `name`.
- Return HTTP 502 if inference laptop is unreachable.

---

### `GET /api/embeddings`

Called by the inference laptop (Person 1) every N seconds to sync its in-memory embedding cache.

**Response:** `application/json`

```json
[
  {
    "object_id": "uuid-string",
    "name": "775 DC Motor",
    "embedding": [0.342, -0.117, 0.894, ...]
  }
]
```

- Return all non-retired objects that have a non-null embedding.
- This endpoint must always be fast — no joins, read straight from `objects` table.

---

### `GET /api/tables`

**Response:** `application/json`

```json
[
  {
    "id": "bench-west-01",
    "label": "West Bench",
    "type": "lab"
  }
]
```

---

### `POST /api/tables`

**Request:** `application/json`

```json
{
  "id": "bench-west-01",
  "label": "West Bench",
  "type": "lab"
}
```

- `type` must be `"lab"` or `"production"`. Return HTTP 422 for any other value.

**Response:** `application/json` — the created table object (same shape as GET item).

---

### `PATCH /api/tables/{table_id}`

**Request:** `application/json`

```json
{
  "label": "New Label"
}
```

- Only `label` is patchable. `type` and `id` cannot change after creation.

**Response:** updated table object.

---

### `GET /api/inventory`

**Response:** `application/json`

```json
[
  {
    "object_id": "uuid-string",
    "name": "775 DC Motor",
    "count": 4
  }
]
```

- Joins `central_registry` with `objects`. Only non-retired objects. Count is the number currently in central (not on any table).

---

### `GET /api/inventory/locate?name=<query>`

- Fuzzy match on object name (case-insensitive `LIKE %query%`).

**Response:** `application/json`

```json
[
  {
    "object_id": "uuid-string",
    "object_name": "775 DC Motor",
    "table_id": "bench-west-01",
    "table_label": "West Bench",
    "count": 2,
    "last_seen": "2026-04-19T10:31:00Z"
  }
]
```

- Returns all tables currently holding matching objects. Empty array if not found on any table (may be in central storage or retired).

---

### `GET /api/inventory/outgoing`

**Response:** `application/json`

```json
[
  {
    "id": "uuid-string",
    "object_id": "uuid-string",
    "object_name": "ESP32-C3",
    "table_id": "prod-table-01",
    "table_label": "Assembly Line 1",
    "quantity": 3,
    "disappeared_at": "2026-04-19T09:12:00Z"
  }
]
```

- Ordered by `disappeared_at` descending (most recent first).

---

### `GET /api/health`

**Response:** `application/json`

```json
{
  "status": "ok",
  "db": "connected",
  "inference_server": "reachable"
}
```

- Ping `GET {INFERENCE_SERVER_URL}/health` and check response; report `"unreachable"` if it fails.

---

## API Contract — You Call These (Inference Laptop, Person 1)

---

### `POST {INFERENCE_SERVER_URL}/detect`

**You send:** `multipart/form-data` with `table_id` (string), `image` (JPEG file)

**You receive:**

```json
{
  "detections": [
    {
      "object_id": "uuid-string",
      "name": "775 DC Motor",
      "count": 2,
      "confidence": 0.82,
      "bboxes": [[x1, y1, x2, y2]]
    }
  ],
  "latency_ms": 340,
  "embedding_count": 12,
  "model_version": "yoloe-26s-seg"
}
```

- Pass `detections` through to PWA unchanged. Use `latency_ms` in your own scan_log.

---

### `POST {INFERENCE_SERVER_URL}/register`

**You send:** `multipart/form-data` with `object_name` (string), `crop` (JPEG file)

**You receive:**

```json
{
  "object_name": "ESP32-C3",
  "embedding": [0.342, -0.117, ...]
}
```

- Store `embedding` (as JSON string) in the `objects` table.

---

## Inventory Engine Logic

Run this in `services/inventory_engine.py` after every successful `/detect` response.

```
process_scan(db, table_id, new_detections):

  current_state = table_inventory WHERE table_id = table_id

  FOR each object in new_detections:
    IF object.object_id NOT IN current_state:
      # New arrival
      central_registry.count -= object.count
      INSERT INTO table_inventory (table_id, object_id, count, consecutive_absent_scans=0)
      emit event: { event_type: "checkout", object_id, object_name, table_id, quantity: object.count }
    ELSE:
      # Still present
      UPDATE table_inventory SET consecutive_absent_scans=0, last_seen=now(), count=object.count

  FOR each row in current_state WHERE object_id NOT IN new_detections:
    # Possibly gone
    UPDATE table_inventory SET consecutive_absent_scans += 1

    IF consecutive_absent_scans >= GRACE_PERIOD:
      IF table.type == 'lab':
        central_registry.count += row.count
        DELETE FROM table_inventory WHERE table_id=table_id AND object_id=row.object_id
        emit event: { event_type: "return", object_id, object_name, table_id, quantity: row.count }

      IF table.type == 'production':
        INSERT INTO outgoing_registry (table_id, object_id, quantity, disappeared_at=now())
        DELETE FROM table_inventory WHERE table_id=table_id AND object_id=row.object_id
        emit event: { event_type: "consumed", object_id, object_name, table_id, quantity: row.count }

  RETURN emitted events
```

---

## DB Schema

```python
# objects
id: str (UUID, PK)
name: str
embedding: str (JSON-serialised list[float], nullable until registered)
created_at: datetime
retired_at: datetime | None

# tables
id: str (PK — set by user, e.g. "bench-west-01")
label: str
type: str  # 'lab' | 'production'
created_at: datetime

# central_registry
object_id: str (FK → objects.id, PK)
count: int
last_updated: datetime

# table_inventory
table_id: str (FK → tables.id, composite PK)
object_id: str (FK → objects.id, composite PK)
count: int
confidence_avg: float
first_seen: datetime
last_seen: datetime
consecutive_absent_scans: int  # default 0

# outgoing_registry
id: str (UUID, PK)
table_id: str (FK → tables.id)
object_id: str (FK → objects.id)
quantity: int
disappeared_at: datetime

# scan_log
id: str (UUID, PK)
table_id: str
scanned_at: datetime
detections: str (JSON — raw detections array from inference laptop)
latency_ms: int
```

---

## Stack

- Python 3.11
- FastAPI + Uvicorn
- SQLAlchemy 2.0 (sync) + SQLite (`./morphyverse.db`)
- Alembic (migrations)
- httpx (async relay calls to inference laptop)
- python-dotenv
- loguru

---

## File Structure

```
morphyverse-server/
├── main.py                        # FastAPI app, CORS middleware, router wiring
├── config.py                      # INFERENCE_SERVER_URL, GRACE_PERIOD=3
├── db/
│   ├── database.py                # SQLAlchemy engine, SessionLocal, Base
│   ├── models.py                  # All ORM models
│   └── migrations/                # Alembic versions/
├── api/
│   ├── scan.py                    # POST /api/scan
│   ├── register.py                # POST /api/register
│   ├── embeddings.py              # GET /api/embeddings
│   ├── tables.py                  # GET/POST/PATCH /api/tables
│   ├── inventory.py               # GET /api/inventory + /locate + /outgoing
│   └── health.py                  # GET /api/health
├── services/
│   ├── inference_relay.py         # relay_detect() and relay_register() via httpx
│   ├── inventory_engine.py        # process_scan() — all inventory logic
│   └── registry.py                # DB helper functions (read/write central_registry etc.)
├── .env                           # INFERENCE_SERVER_URL, GRACE_PERIOD=3
├── requirements.txt
└── README.md
```

---

## TODOs (in order)

- [ ] Create Replit Python project; `pip install fastapi uvicorn sqlalchemy alembic httpx python-dotenv loguru pillow`
- [ ] `config.py` — read `INFERENCE_SERVER_URL`, `GRACE_PERIOD` (int, default 3) from `.env`
- [ ] `db/database.py` — SQLite engine at `./morphyverse.db`, `SessionLocal`, `Base`
- [ ] `db/models.py` — all ORM models per schema above; use `String` for UUID fields (SQLite), JSON-serialise embeddings as `Text`
- [ ] `alembic init migrations`; configure `env.py` to use `Base.metadata` and SQLite URL; `alembic revision --autogenerate -m "init"`; `alembic upgrade head`
- [ ] `services/inference_relay.py` — async `relay_detect(table_id: str, image_bytes: bytes) → list[dict]`: POST multipart to `{INFERENCE_SERVER_URL}/detect`, return `response.json()["detections"]`; async `relay_register(object_name: str, crop_bytes: bytes) → list[float]`: POST multipart to `{INFERENCE_SERVER_URL}/register`, return `response.json()["embedding"]`; raise `httpx.HTTPError` on failure
- [ ] `services/registry.py` — helper functions: `get_table(db, table_id)`, `get_central_count(db, object_id)`, `set_central_count(db, object_id, count)`, `upsert_table_inventory(db, table_id, object_id, count, confidence)`, `get_table_inventory(db, table_id)`, `increment_absent(db, table_id, object_id)`, `remove_table_inventory(db, table_id, object_id)`, `insert_outgoing(db, table_id, object_id, quantity)`
- [ ] `services/inventory_engine.py` — `process_scan(db, table_id, new_detections: list[dict]) → list[dict]` per logic above; return list of event dicts with `event_type`, `object_id`, `object_name`, `table_id`, `quantity`
- [ ] `api/scan.py` — `POST /api/scan`: read `table_id` (Form) + `image` (UploadFile); call `relay_detect`; call `process_scan`; write to `scan_log`; return `{table_id, detections, inventory_events}`
- [ ] `api/register.py` — `POST /api/register`: read `object_name` (Form) + `crop` (UploadFile); call `relay_register`; create `objects` row; create `central_registry` row with `count=1`; return `{object_id, name}`
- [ ] `api/embeddings.py` — `GET /api/embeddings`: query all non-retired `objects` with non-null `embedding`; return `[{object_id, name, embedding}]` where `embedding` is parsed back from JSON string to list
- [ ] `api/tables.py` — GET list, POST create (validate type is `lab` or `production`), PATCH label-only update
- [ ] `api/inventory.py` — three endpoints per contract above; use SQLAlchemy joins for locate and outgoing
- [ ] `api/health.py` — ping `{INFERENCE_SERVER_URL}/health` with a 3s timeout; return status
- [ ] `main.py` — include all routers; add `CORSMiddleware` with `allow_origins=["*"]` for hackathon (tighten later)
- [ ] Deploy on Replit; set `INFERENCE_SERVER_URL` in Replit Secrets to ngrok URL from Person 1
- [ ] End-to-end smoke test: `POST /api/tables` → `POST /api/register` → `POST /api/scan` → `GET /api/inventory`
