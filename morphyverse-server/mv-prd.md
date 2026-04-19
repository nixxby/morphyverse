# LabLens — AI-Native Lab Inventory Management System
### Product Requirements Document v0.2
**Author:** Piqoid Robotics Internal  
**Date:** April 2026  
**Status:** Draft for Review  
**Delta from v0.1:** PWA on Android/iPhone, YOLOE-26 visual prompting, two table types (Lab vs. Production), cloud-hosted central DB

---

## 1. Executive Summary

LabLens is a fully autonomous, AI-native inventory and parts tracking system for wet labs, robotics labs, and maker-style workspaces. It eliminates manual scanning, tagging, or logging entirely.

**Core loop:** A user opens LabLens in their phone browser, points their camera at a workstation, and the system — using YOLOE-26's visual prompting on a backend inference server — identifies all known objects, updates the central inventory, and logs where each part is. Object registration requires only a single photo with a drawn bounding box and a name. No training. No model redeployment. No barcodes.

**Key change from v0.1:** There are no Raspberry Pi nodes. The phone IS the capture device, running as a PWA. All heavy inference runs on a central inference server. The central database is cloud-hosted (or self-hosted on a lab machine).

---

## 2. Problem Statement

Wet labs and robotics labs suffer from chronic inventory opacity:
- Components migrate from storage to desks with no tracking
- Barcodes and RFID require deliberate human action
- Visual search ("who has the oscilloscope?") is constant friction
- Inventory counts are infrequent and always stale

Standard systems assume parts live on shelves. **LabLens assumes parts live at people's desks** — because that's where work happens. And the capture device people already carry everywhere is their phone.

---

## 3. Goals & Non-Goals

### Goals
- Zero-friction inventory tracking: no barcodes, no behavior change from lab members
- One-shot visual object registration: photo + bounding box + name → done
- Real-time approximate location of any tracked object (table-level granularity)
- Live count of all objects across the lab
- Two semantically distinct table types with different inventory accounting logic
- PWA: works in Chrome/Safari on Android and iPhone with no app install
- Central inference + cloud DB: phones are thin clients

### Non-Goals (v1)
- Centimeter-level localization within a table
- Offline inference on-device (stretch goal for v2)
- Tracking objects in transit between tables
- Multi-lab sync across physical sites
- Person identification or face recognition

---

## 4. The Two Table Types

This is the core inventory logic of LabLens and must be understood before any other feature.

### 4.1 Lab Table
A **Lab Table** is a research, assembly, or engineering workstation where parts are actively being used but are expected to return to circulation.

**Inventory logic:**
- When an object is first detected on a Lab Table → subtract from Central Parts Registry, add to Lab Table Registry
- While the object remains on the table → no change (idempotent)
- When the object disappears from the table (not detected for N consecutive scans) → add back to Central Parts Registry, remove from Lab Table Registry

Think of a Lab Table as a temporary checkout. The part left the shelf, went to a desk, came back.

### 4.2 Production Table
A **Production Table** is a workstation where parts are consumed into assemblies or products being built for dispatch out of the lab. Parts that arrive here are assumed to be consumed.

**Inventory logic:**
- When an object is first detected on a Production Table → subtract from Central Parts Registry, add to Production Table Registry
- While the object remains on the table → no change
- When the object disappears from the table → do NOT add back to Central Parts Registry. Log the disappearance as an **Outgoing Event** to the Outgoing Registry with timestamp, quantity, and last-known scan snapshot

Think of a Production Table as a consumption point. Parts go in. Products go out.

### 4.3 Summary Table

| Event | Lab Table | Production Table |
|---|---|---|
| Object appears | −1 Central, +1 Lab Table | −1 Central, +1 Prod Table |
| Object remains | No change | No change |
| Object disappears | +1 Central, −1 Lab Table | Logged to Outgoing Registry (not returned to Central) |

---

## 5. YOLOE-26 Visual Prompting — How It Works in LabLens

YOLOE-26 (released January 2026 by Ultralytics, built on YOLO26) is an open-vocabulary segmentation model that natively supports **visual prompts**: you supply a cropped reference image of an object and the model detects that object in new scenes without any retraining.

### Why YOLOE-26 replaces the old training pipeline

In v0.1, registration required fine-tuning a YOLOv8 model and redistributing it to Pi nodes. With YOLOE-26:

1. **Registration time:** User takes a photo, draws a bounding box → the crop is sent to the server → YOLOE-26 extracts a **visual embedding** from that crop using its SAVPE (Spatially-Aware Visual Prompt Encoder) module → embedding is stored in the object database
2. **Detection time:** When a scan image arrives, YOLOE-26 receives all registered visual embeddings as prompts and runs a single forward pass → returns bounding boxes for all registered objects simultaneously
3. **No retraining, no model updates, no file distribution** — the model weights never change; only embeddings are added to the DB

### The prompt-then-detect paradigm in LabLens

```
REGISTRATION:
  photo crop  →  YOLOE-26 SAVPE  →  visual embedding  →  stored in DB

SCAN DETECTION:
  scan image + [all visual embeddings]  →  YOLOE-26 forward pass  →  [{object, bbox, confidence}]
```

YOLOE-26's visual prompting is particularly well-suited here because:
- It supports **one-shot** recognition from a single reference image
- The SAVPE module is the only component that changes when new objects are registered; the backbone and neck are frozen
- It runs real-time on modern server hardware and is exportable to ONNX for edge deployment in v2

### Inference server requirements

| Model variant | Recommended for |
|---|---|
| `yoloe-26s-seg.pt` | Up to ~20 registered object classes, CPU server |
| `yoloe-26m-seg.pt` | 20–100 registered object classes, GPU server |
| `yoloe-26l-seg.pt` | 100+ classes, production GPU server |

For a hackathon / pilot: `yoloe-26s-seg` running on a GPU-enabled cloud VM (e.g., GCP e2 with T4) or even a powerful CPU instance is sufficient.

---

## 6. System Architecture

### 6.1 Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        USER'S PHONE                              │
│                                                                  │
│   LabLens PWA (Chrome Android / Safari iOS)                      │
│   - Camera capture (MediaDevices API)                            │
│   - Canvas bounding box annotator (registration)                 │
│   - Dashboard, query, alerts UI                                  │
│   - Sends JPEG frames to inference API                           │
└───────────────────────────┬──────────────────────────────────────┘
                            │ HTTPS (REST)
                            │ Multipart image upload
                ┌───────────▼──────────────┐
                │   Inference & API Server  │
                │   (Cloud VM / Lab machine)│
                │                          │
                │   FastAPI                 │
                │   YOLOE-26 (Python)       │
                │   Visual embedding store  │
                │   Inventory logic engine  │
                └───────────┬──────────────┘
                            │
                ┌───────────▼──────────────┐
                │   Central Database        │
                │   (PostgreSQL, cloud or   │
                │    self-hosted)           │
                │                          │
                │   Objects + embeddings    │
                │   Tables registry         │
                │   Central parts registry  │
                │   Lab table registry      │
                │   Production table reg.   │
                │   Outgoing registry       │
                │   Scan log                │
                └──────────────────────────┘
```

### 6.2 PWA Architecture

The frontend is a **Progressive Web App** — a React/Vite app served over HTTPS that uses:

- `MediaDevices.getUserMedia()` for live camera access
- `ImageCapture` API or canvas frame extraction for sending snapshots
- Service Worker for offline shell caching (UI remains usable without connectivity; scans queue and sync when back online)
- Web App Manifest for "Add to Home Screen" on Android and iOS
- No native app store required

**Platform compatibility:**
- **Android Chrome**: Full PWA support including camera, background sync, home screen install — primary target
- **iPhone Safari**: Camera access supported, home screen install via "Add to Home Screen" — supported with minor limitations (no background sync in Safari; scans only when app is open)

### 6.3 Scan Flow (Phone → Server → DB)

```
1. User opens scan mode in PWA
2. PWA accesses rear camera via getUserMedia
3. Every N seconds (configurable, default 30s): capture frame as JPEG
4. POST /api/scan with: { table_id, image: <JPEG blob> }
5. Server: run YOLOE-26 with all registered visual embeddings as prompts
6. Server: return detections [{object_id, count, confidence, bbox}]
7. Server: compute diff vs. last known state for this table
8. Server: apply inventory logic (Lab or Production table rules)
9. Server: write to scan_log, update desk_inventory, update central_registry
10. Server: return updated table state to PWA
11. PWA: render overlay + update dashboard
```

---

## 7. Feature List

### 7.1 Object Registration
- **F-REG-01**: Single-shot visual registration — photo + bounding box + name → YOLOE-26 extracts embedding, no training
- **F-REG-02**: Multiple reference images per object (up to 5 angles) for better embedding
- **F-REG-03**: Name, tags, and optional description per object
- **F-REG-04**: Low-stock threshold configuration per object
- **F-REG-05**: Object retirement (soft-delete, history preserved)
- **F-REG-06**: Registration happens from phone camera directly in PWA — no desktop required
- **F-REG-07**: Preview mode: after registration, run a test scan to confirm the object is detectable before finalizing

### 7.2 Table Management
- **F-TBL-01**: Create tables with a name, type (Lab or Production), and optional location tag
- **F-TBL-02**: Each table has a unique scan code or name used by the phone to identify which table it's scanning
- **F-TBL-03**: Table type is set at creation and can be changed by an admin (with a warning about in-progress inventory)
- **F-TBL-04**: Floor plan view: drag-and-drop table placement on a configurable SVG lab map
- **F-TBL-05**: Per-table live inventory panel (visible from any phone on the network)

### 7.3 Scan & Detection
- **F-DET-01**: Scan mode in PWA: live camera feed with periodic auto-capture
- **F-DET-02**: Manual capture trigger ("Scan Now" button)
- **F-DET-03**: Visual overlay on captured frame showing detected objects + bounding boxes + names (returned by server, rendered on canvas in PWA)
- **F-DET-04**: Configurable scan interval (default 30s, range 10s–5min)
- **F-DET-05**: Confidence threshold per object class (admin-configurable)
- **F-DET-06**: Grace period before object is considered "disappeared" (default: absent for 3 consecutive scans before triggering inventory update)
- **F-DET-07**: Scan history: last 20 scans per table viewable in PWA

### 7.4 Inventory Logic Engine
- **F-INV-01**: Central Parts Registry: global count of each object in the lab
- **F-INV-02**: Lab Table Registry: which objects are on which Lab Tables and in what quantity
- **F-INV-03**: Production Table Registry: which objects are currently on Production Tables
- **F-INV-04**: Outgoing Registry: immutable log of objects that left via Production Tables — timestamp, quantity, table ID, scan snapshot
- **F-INV-05**: Lab Table return logic: object disappears from Lab Table → returned to Central (after grace period)
- **F-INV-06**: Production Table consumption logic: object disappears from Production Table → logged to Outgoing, NOT returned to Central
- **F-INV-07**: Multi-table conflict handling: if the same object is detected on two tables simultaneously, flag as conflict — show on dashboard with both locations, use higher-confidence for count deduction
- **F-INV-08**: Manual override: admin can manually adjust any registry count with a logged reason

### 7.5 Dashboard & Queries
- **F-UI-01**: Home screen: global inventory summary (all objects, total counts, low-stock flags)
- **F-UI-02**: Search: "Where is the 775 motor?" → returns table name + last seen timestamp + confidence
- **F-UI-03**: Floor plan view: tap any table to see its current inventory
- **F-UI-04**: Lab Table view: shows objects currently checked out from Central, when they arrived
- **F-UI-05**: Production Table view: shows objects currently in production + cumulative outgoing log
- **F-UI-06**: Outgoing Registry view: filterable log of all consumed/shipped parts (date, quantity, table, scan thumbnail)
- **F-UI-07**: Low-stock alerts: banner + notification for objects below threshold
- **F-UI-08**: Object detail page: registration photo, all tables it's been seen on, full scan history

### 7.6 Notifications
- **F-NOT-01**: In-app push notifications via Web Push API (works on Android PWA)
- **F-NOT-02**: Slack webhook for low-stock and outgoing events
- **F-NOT-03**: Email alerts (SMTP configurable)
- **F-NOT-04**: Daily inventory summary report (optional, scheduled)

---

## 8. Data Models

### 8.1 `objects`
```sql
id                   UUID PRIMARY KEY
name                 TEXT NOT NULL
tags                 TEXT[]
description          TEXT
low_stock_threshold  INTEGER
visual_embeddings    JSONB   -- list of SAVPE embeddings (one per reference image)
reference_image_urls TEXT[]
created_at           TIMESTAMP
retired_at           TIMESTAMP NULL
```

### 8.2 `tables`
```sql
id            TEXT PRIMARY KEY   -- e.g. "bench-west-01"
label         TEXT
type          ENUM('lab', 'production')
floor_plan_x  FLOAT
floor_plan_y  FLOAT
created_at    TIMESTAMP
```

### 8.3 `central_registry`
```sql
object_id     UUID REFERENCES objects(id)
count         INTEGER
last_updated  TIMESTAMP
PRIMARY KEY (object_id)
```
*Source of truth for how many of each object are "available" in the lab (not on any table).*

### 8.4 `table_inventory`
```sql
table_id        TEXT REFERENCES tables(id)
object_id       UUID REFERENCES objects(id)
count           INTEGER
confidence_avg  FLOAT
first_seen      TIMESTAMP
last_seen       TIMESTAMP
consecutive_absent_scans  INTEGER DEFAULT 0
PRIMARY KEY (table_id, object_id)
```

### 8.5 `outgoing_registry`
```sql
id              UUID PRIMARY KEY
table_id        TEXT REFERENCES tables(id)  -- must be type='production'
object_id       UUID REFERENCES objects(id)
quantity        INTEGER
disappeared_at  TIMESTAMP
last_scan_image_url  TEXT    -- snapshot from last scan that detected it
notes           TEXT
```
*Immutable append-only log. Never updated, only inserted.*

### 8.6 `scan_log`
```sql
id            UUID PRIMARY KEY
table_id      TEXT
scanned_at    TIMESTAMP
submitted_by  TEXT             -- phone device identifier or user ID
detections    JSONB            -- [{object_id, count, confidence, bbox}]
image_url     TEXT             -- optional: store scan thumbnail
model_version TEXT
```

### 8.7 `inventory_events`
```sql
id          UUID PRIMARY KEY
event_type  ENUM('checkout', 'return', 'consumed', 'manual_adjust', 'conflict_flagged')
object_id   UUID
from_table  TEXT NULL
to_table    TEXT NULL
quantity    INTEGER
reason      TEXT NULL
created_at  TIMESTAMP
created_by  TEXT
```
*Full audit trail of every inventory state change.*

---

## 9. API Endpoints

### Object Management
```
POST   /api/objects              — register object (name, tags, image crops → server extracts embeddings)
GET    /api/objects              — list all active objects
GET    /api/objects/{id}         — object detail + embedding status
PATCH  /api/objects/{id}         — update metadata
DELETE /api/objects/{id}         — retire
POST   /api/objects/{id}/images  — add additional reference images
```

### Table Management
```
POST   /api/tables               — create table (name, type: lab|production, position)
GET    /api/tables               — list all tables
GET    /api/tables/{id}          — table detail + current inventory
PATCH  /api/tables/{id}          — update label/position/type
GET    /api/tables/{id}/scans    — scan history for table
```

### Scan & Detection
```
POST   /api/scan                 — submit scan image for a table
                                    body: { table_id, image: <JPEG> }
                                    returns: { detections, table_inventory, inventory_diffs }
```

### Inventory Queries
```
GET    /api/inventory/central            — full central parts registry
GET    /api/inventory/locate?name=<q>   — find object → [{table_id, count, last_seen}]
GET    /api/inventory/lab-tables         — all objects currently on Lab Tables
GET    /api/inventory/production-tables  — all objects currently on Production Tables
GET    /api/inventory/outgoing           — outgoing registry (filterable by date, table, object)
GET    /api/inventory/events             — full audit log
```

### Admin
```
POST   /api/inventory/manual-adjust     — manually override a count (logged)
GET    /api/health                       — server + model health check
```

---

## 10. File System Layout

### Backend (Inference + API Server)
```
lablens-server/
├── app/
│   ├── main.py                      # FastAPI entrypoint
│   ├── config.py                    # Settings (DB URL, model path, etc.)
│   ├── api/
│   │   ├── objects.py               # Object CRUD + embedding extraction
│   │   ├── tables.py                # Table management
│   │   ├── scan.py                  # Core scan endpoint (YOLOE-26 inference)
│   │   ├── inventory.py             # Query endpoints
│   │   └── admin.py                 # Manual overrides, health
│   ├── db/
│   │   ├── models.py                # SQLAlchemy ORM
│   │   ├── session.py               # DB connection
│   │   └── migrations/              # Alembic
│   ├── services/
│   │   ├── detection_service.py     # YOLOE-26 wrapper: embed extraction + inference
│   │   ├── inventory_engine.py      # Core inventory diff + Lab/Production logic
│   │   ├── alert_service.py         # Low-stock, outgoing alerts
│   │   └── image_service.py         # Image storage (S3 or local)
│   └── ml/
│       ├── yoloe_model.py           # YOLOE-26 model loader + inference interface
│       └── embedding_store.py       # In-memory cache of visual embeddings for fast lookup
├── models/
│   └── yoloe-26s-seg.pt             # Model weights
├── reference_images/                # Stored registration crops
├── scan_thumbnails/                 # Optional: stored scan snapshots
├── frontend/                        # Vite build (served as static)
└── docker-compose.yml
```

### Frontend (PWA — React + Vite)
```
lablens-pwa/
├── public/
│   ├── manifest.json                # PWA manifest (name, icons, display: standalone)
│   └── sw.js                        # Service worker (offline shell + scan queue)
├── src/
│   ├── App.jsx
│   ├── pages/
│   │   ├── Dashboard.jsx            # Global inventory + floor plan
│   │   ├── ScanMode.jsx             # Live camera + auto-capture loop
│   │   ├── Register.jsx             # Registration wizard (photo → bbox → name)
│   │   ├── TableDetail.jsx          # Per-table inventory view
│   │   ├── OutgoingLog.jsx          # Production outgoing registry
│   │   ├── LabCheckout.jsx          # Lab table checkout view
│   │   └── Search.jsx               # Object location query
│   ├── components/
│   │   ├── CameraCapture.jsx        # getUserMedia wrapper, frame extraction
│   │   ├── BBoxAnnotator.jsx        # Canvas bounding box draw tool (registration)
│   │   ├── DetectionOverlay.jsx     # Canvas overlay rendering detected bboxes on scan
│   │   ├── FloorPlan.jsx            # SVG lab map with table overlays
│   │   ├── InventoryTable.jsx       # Sortable object count table
│   │   ├── TableTypeBadge.jsx       # Lab (blue) / Production (orange) badge
│   │   └── AlertBanner.jsx          # Low-stock + conflict alerts
│   ├── hooks/
│   │   ├── useCamera.js             # getUserMedia + ImageCapture hook
│   │   ├── useScanLoop.js           # Auto-capture interval logic
│   │   └── usePushNotifications.js  # Web Push subscription
│   ├── api/
│   │   └── client.js                # All API calls (fetch wrapper)
│   ├── store/
│   │   └── inventoryStore.js        # Zustand: global inventory state
│   └── utils/
│       └── imageUtils.js            # JPEG compression before upload
├── vite.config.js
└── package.json
```

---

## 11. YOLOE-26 Integration Detail

### 11.1 Object Registration Flow (Server-side)
```python
from ultralytics import YOLOE

model = YOLOE("yoloe-26s-seg.pt")

def register_object(crop_image_path: str) -> list[float]:
    """Extract visual embedding from a cropped reference image."""
    # YOLOE-26 SAVPE extracts embedding from the reference crop
    embedding = model.extract_visual_prompt_embedding(crop_image_path)
    return embedding.tolist()  # store in DB as JSON array
```

### 11.2 Scan Detection Flow (Server-side)
```python
def run_scan(scan_image_path: str, registered_objects: list[dict]) -> list[dict]:
    """
    registered_objects: [{object_id, name, embedding, confidence_threshold}]
    Returns: [{object_id, name, count, confidence, bboxes}]
    """
    visual_prompts = [obj["embedding"] for obj in registered_objects]
    
    results = model.predict(
        source=scan_image_path,
        visual_prompts=visual_prompts,
        conf=0.55
    )
    
    detections = []
    for i, obj in enumerate(registered_objects):
        boxes = [r for r in results if r.class_id == i and r.conf >= obj["confidence_threshold"]]
        if boxes:
            detections.append({
                "object_id": obj["object_id"],
                "count": len(boxes),
                "confidence": max(b.conf for b in boxes),
                "bboxes": [b.xyxy.tolist() for b in boxes]
            })
    return detections
```

### 11.3 Key Properties for LabLens

| Property | Value |
|---|---|
| Training required for new objects | None — visual embedding only |
| Reference images needed per object | 1 (ideally 3–5 for robustness) |
| Inference mode | Visual-prompted segmentation |
| Output | Bounding boxes + masks + class similarity scores |
| Model update on new registration | No — only DB updated |
| ONNX export for edge (v2) | Supported via `model.export(format='onnx')` |

---

## 12. PWA Camera & Capture Implementation

```javascript
// useCamera.js — simplified
export function useCamera(tableId, scanInterval = 30000) {
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: 1280, height: 720 }
    });
    streamRef.current = stream;
  }

  async function captureAndScan() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);
    
    // Compress to JPEG before upload
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    
    const formData = new FormData();
    formData.append('table_id', tableId);
    formData.append('image', blob);
    
    const result = await fetch('/api/scan', { method: 'POST', body: formData });
    return result.json();  // { detections, table_inventory, inventory_diffs }
  }

  useEffect(() => {
    const interval = setInterval(captureAndScan, scanInterval);
    return () => clearInterval(interval);
  }, [scanInterval]);
}
```

**iOS Safari note:** `getUserMedia` with `facingMode: 'environment'` works on iOS 14.3+. Background scan loops don't run when the app is backgrounded in Safari — users need to keep the PWA in the foreground during active scanning sessions. Android Chrome has no this restriction when installed as a PWA.

---

## 13. Inventory Engine Logic (Pseudocode)

```python
def process_scan_diff(table_id, new_detections, current_table_state, table_type, grace_period=3):
    events = []
    
    # Objects newly appeared
    for obj in new_detections:
        if obj not in current_table_state:
            # New arrival at this table
            central_registry.decrement(obj.object_id, obj.count)
            table_inventory.upsert(table_id, obj.object_id, obj.count)
            events.append(Event(type='checkout', object_id=obj.object_id, to_table=table_id))

    # Objects that were present but no longer detected
    for obj in current_table_state:
        if obj not in new_detections:
            table_inventory.increment_absent_counter(table_id, obj.object_id)
            
            if table_inventory.get_absent_count(table_id, obj.object_id) >= grace_period:
                # Confirmed gone
                if table_type == 'lab':
                    # Return to central
                    central_registry.increment(obj.object_id, obj.count)
                    events.append(Event(type='return', object_id=obj.object_id, from_table=table_id))
                
                elif table_type == 'production':
                    # Log to outgoing — do NOT return to central
                    outgoing_registry.insert(table_id, obj.object_id, obj.count)
                    events.append(Event(type='consumed', object_id=obj.object_id, from_table=table_id))
                
                table_inventory.remove(table_id, obj.object_id)
        else:
            # Still present — reset absent counter
            table_inventory.reset_absent_counter(table_id, obj.object_id)
    
    return events
```

---

## 14. Rollout Plan

### Phase 1 — Hackathon MVP (1–2 days)
- Central FastAPI server with SQLite
- YOLOE-26s running locally (or on a GPU VM)
- Single scan endpoint
- PWA: camera capture → POST to server → show detection overlay
- Basic registration: photo upload + manual bbox → embedding stored
- One table type only (Lab Table logic)
- Minimal dashboard: object list + "where is X"

### Phase 2 — Full Feature (2–3 weeks post-hackathon)
- Production Table type + Outgoing Registry
- Grace period logic
- PostgreSQL migration
- Floor plan SVG editor
- Multi-table conflict detection
- iOS Safari compatibility testing

### Phase 3 — Hardening
- Web Push notifications
- Slack / email webhooks
- Admin manual override UI
- Audit log UI
- PWA offline scan queue (service worker)

### Phase 4 — Scale & Intelligence (stretch)
- YOLOE-26 ONNX export for on-device inference (eliminate server round-trip latency)
- Usage analytics (part dwell time, production throughput)
- Natural language inventory queries via LLM layer

---

## 15. Open Questions

1. **Scan triggering model:** Auto-interval vs. manual "Scan Now" vs. motion-triggered (phone accelerometer)? Auto-interval is simplest for MVP; motion-trigger is more power-efficient for long sessions.
2. **Who scans which table?** Does each phone scan a specific assigned table, or can any phone scan any table? V1 recommendation: user selects table from a dropdown before entering scan mode.
3. **Reference image quality:** YOLOE-26 visual prompting works best with clean, isolated crops. Should we add a crop quality validator at registration time (blur detection, background isolation check)?
4. **Counting multiples:** YOLOE-26 returns one bounding box per instance. Counting 20 identical M3 screws will likely under-count due to occlusion and clustering. Consider a dedicated counting mode using a separate counting head or size-based estimation for small identical parts.
5. **Offline resilience:** If the server is down, scan data should queue on-device and sync when connectivity restores. Service worker background sync covers Android PWA; iOS requires the app to remain open.
6. **Who owns the central DB?** For a hackathon: SQLite on the inference server VM. For production: PostgreSQL on a managed cloud service (Supabase, Neon, or Railway are fast to set up).

---

## 16. Success Metrics

| Metric | Target |
|---|---|
| Object registration time (photo to detectable) | <90 seconds |
| Detection recall for registered objects | >80% in controlled lab conditions |
| False positive rate | <8% per scan |
| Inventory accuracy vs. manual count | Within ±15% |
| Scan round-trip latency (phone → server → result) | <3 seconds on LAN, <6 seconds on 4G |
| PWA install-to-first-scan time | <2 minutes |

---

*LabLens PRD v0.2 — Piqoid Robotics Internal — April 2026*
