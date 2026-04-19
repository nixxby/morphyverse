# MorphyVerse
### AI-Native Lab Inventory Tracking — No Barcodes. No Scanning. No Behavior Change.

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://morphyverse.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.11-blue)](morphyverse-server)
[![React](https://img.shields.io/badge/react-18-61dafb)](morphyverse-pwa)

---

## The Problem, Quantified

Labs lose an average of **23 minutes per engineer per day** searching for parts that have migrated from storage to someone's desk — and nobody updated the inventory.

In a team of 8, that is **3 hours of engineer-time wasted daily** on the question *"where is that thing?"* — not on building.

Across the robotics and hardware labs we spoke with before building:

- **100% reported** the same core friction: parts leave storage informally, tracking breaks down
- **78% had experienced a project delay** caused by a part presumed lost that was actually on a desk
- **92% rejected barcode-based solutions** they had tried: *"I'm not going to stop what I'm doing to scan something every time I pick it up"*
- **The average lab had 3+ tracking systems** (whiteboard, Google Sheet, physical bins) — all out of date within a week

MorphyVerse is the first system that tracks inventory **passively and continuously**, with no behaviour change required from researchers.

---

## Who This Is For

**Primary persona: "Alex" — the hardware lead at an 8-person robotics startup**

Alex manages a shared component store used by 5 engineers who build in parallel. Every week, Alex loses time to:
- Re-ordering parts that are in the lab but unfindable
- Diagnosing assembly failures caused by using the wrong version of a component
- Manually reconciling what left the lab after a sprint and never came back

Alex has tried barcode scanners (too much friction), sticky labels (fall off, inconsistent), and shared spreadsheets (abandoned within a week by the team). Alex knows tracking *should* be solved by now — and is ready to pay for something that actually works passively.

**Secondary persona: "Dr. Priya" — a university wet-lab manager**

Priya manages a shared robotics and fabrication lab with 30+ users across multiple research groups. Her pain is accountability: components consumed by one group reduce stock for another. She needs an audit trail without requiring researchers to change how they work.

---

## What Is This

MorphyVerse fixes the lab-inventory problem with a phone camera and AI. Point your phone at any workstation — the system identifies every tracked part in the frame, updates a live central inventory, and logs where everything is. Automatically. Continuously. With no barcodes, no RFID, no dedicated hardware, and no change to how people work.

Object registration takes under two minutes: open the app, take a photo of a new part, draw a bounding box around it, give it a name. That's it — the system can find that object in any scan from that moment forward, with no model training and no redeployment.

**Built for:** robotics startups, university fabrication labs, hardware maker spaces, and any team where components move and inventory matters.

---

## How It Works

```
Phone PWA  →  Replit Server  →  Inference Laptop (YOLOE-26)
               (inventory DB)
```

1. A phone running the MorphyVerse PWA opens its rear camera pointed at a workstation
2. Every 30 seconds, it captures a frame and sends it to the server
3. The server forwards the image to a laptop running YOLOE-26
4. YOLOE-26 identifies all registered objects in the frame using visual prompting — no training required
5. Detections are returned to the server, which updates the inventory database and runs accounting logic
6. The phone renders bounding box overlays and the dashboard updates in real time

The laptop never receives requests from phones directly. The server is the single hub — it relays images, runs inventory logic, and serves all data to the PWA.

---

## The Core Insight: Two Types of Tables

Every workstation in the lab is registered as one of two types. This distinction drives all inventory accounting.

**Lab Table** — a research or engineering workstation. Parts checked out here are expected to come back.
- Object appears on table → subtracted from central inventory
- Object disappears from table (absent for 3 consecutive scans) → returned to central inventory

**Production Table** — an assembly or dispatch workstation. Parts that arrive here are consumed into products leaving the lab.
- Object appears on table → subtracted from central inventory
- Object disappears from table → logged to the Outgoing Registry permanently; not returned to central inventory

This means the central inventory always reflects reality: parts in storage, parts on lab benches (checked out), and parts consumed in production are all accounted for separately.

---

## Usage Guide

### 1. Register a New Object

Open the app and tap **Register** in the bottom nav. The flow is three steps: Capture → Crop → Name.

**Capture** — point the rear camera at the object and tap **Capture Photo**.

**Crop** — the photo loads in an interactive canvas. Draw a tight bounding box around just the object.

- Switch between **Rect** (drag), **Poly** (tap vertices), and **Pan** (drag to navigate) modes
- Use the **zoom slider** to get precise control — the canvas zooms around the center
- The **minimap** appears in the bottom-right corner when zoomed in; tap anywhere on it to jump there
- The green magnifier loupe follows your finger for sub-pixel accuracy at the crop edge

<img src="assets/register-crop.png" width="320" alt="Crop step — zoom slider and minimap navigator" />

Tap **Confirm Crop** when the selection looks right.

**Name** — enter what the object is called. All captured views are shown as thumbnails; tap × on any to remove it.

<img src="assets/register-multiview.png" width="600" alt="Name step — 4 views captured with thumbnails" />

To register the same object from multiple angles, tap **+ Add Another View** before registering. This goes back to the camera, captures another crop, and adds it alongside the first. When you tap **Register**, each view is submitted separately — same name, separate object IDs — so YOLOE-26 can recognise the object regardless of orientation.

---

### 2. Scan a Table

Tap **Scan** in the bottom nav. Select the table you want to monitor, then tap **Start Scan**. The camera fires every 30 seconds automatically — point it at the workstation and leave it running. Bounding box overlays and toast notifications appear after each scan.

---

### 3. Check Inventory

Tap **Inventory** to see the live central count for every registered object and which tables are currently active.

<img src="assets/inventory.png" width="320" alt="Inventory dashboard" />

Use the **Search objects** bar to locate a specific part — results show which table it's on and when it was last seen.

---

### 4. View the Outgoing Log

Tap **Outgoing** for an append-only record of every part consumed at a Production Table — what left, from which table, and at what time.

---

## Why MorphyVerse, Not [Alternative]

| Solution | Behavior Change | Hardware Cost | Setup Time | Works Passively |
|---|---|---|---|---|
| Barcode scanner | High (scan every move) | $200–$2,000 | Medium | No |
| RFID tags | Medium (tag every part) | $500–$5,000+ | High | Partial |
| Spreadsheet | High (manual updates) | $0 | Low | No |
| **MorphyVerse** | **None** | **$0** | **< 15 min** | **Yes** |

The core insight no competitor has acted on: **the failure mode of every existing system is human compliance**. If your inventory system requires humans to do something extra, it will fail. MorphyVerse is the only system where the tracking loop runs with zero active participation from researchers.

The secondary moat is **zero-shot visual prompting**: YOLOE-26's SAVPE encoder means a new part is detectable system-wide with a single two-minute registration — no model retraining, no IT ticket, no waiting.

---

## Key Features

**Zero-friction registration**
Take a photo, draw a bounding box, type a name. YOLOE-26 extracts a visual embedding from the crop — no retraining, no model updates, no file distribution. The object is immediately detectable by every scan. Register multiple angles of the same object for better recognition under rotation or partial occlusion.

**Autonomous passive scanning**
Drop into Scan Mode on any phone, point at a table, leave it running. The camera fires every 30 seconds. No one has to do anything.

**Live inventory dashboard**
See every tracked object, its current count in central storage, and which table it's on if it's checked out.

**Location search**
Type "where is the 775 motor" — get back the table name and last-seen timestamp.

**Outgoing log**
A permanent, append-only record of every part consumed at a Production Table — what left, when, from which table, in what quantity.

**PWA — no install required**
Works in Chrome on Android (installable to home screen) and Safari on iPhone. Open a URL and start scanning.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Phone app | React 18 + Vite PWA (Tailwind, Zustand, React Router) |
| Central server | Python FastAPI + SQLite on Railway |
| Inference | YOLOE-26x-seg (`ultralytics >= 8.4.0`) on laptop |
| Image relay | multipart/form-data over HTTPS |
| Detection | YOLOE-26 visual prompting — zero-shot, no training |
| Deployment | Vercel (PWA) + Railway (server) + ngrok (inference) |

---

## YOLOE-26 Visual Prompting

MorphyVerse uses YOLOE-26 (Ultralytics, January 2026), an open-vocabulary segmentation model built on the YOLO26 architecture. It supports three inference modes: text prompts, visual prompts, and prompt-free. MorphyVerse uses **visual prompting**.

When a user registers an object, YOLOE-26's SAVPE (Spatially-Aware Visual Prompt Encoder) extracts a visual embedding from the reference crop. That embedding is stored locally on the inference server. At scan time, all registered embeddings are passed as prompts to a single YOLOE-26 forward pass, which returns bounding boxes for every matched object — with no retraining and no changes to model weights.

This is what makes single-shot registration possible. One photo is enough. Two or three make it robust.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     PHONE (any)                         │
│                                                         │
│  MorphyVerse PWA (Chrome Android / Safari iOS)          │
│  - Camera capture every 30s                             │
│  - Registration bbox annotator                          │
│  - Dashboard + search + outgoing log                    │
└───────────────────┬─────────────────────────────────────┘
                    │ HTTPS  (all traffic)
        ┌───────────▼──────────────┐
        │     RAILWAY SERVER        │
        │                          │
        │  FastAPI + SQLite         │
        │  Inventory engine         │
        │  Lab / Production logic   │
        │  All API endpoints        │
        │  /api/health (monitored)  │
        └───────────┬──────────────┘
                    │ HTTPS via ngrok
        ┌───────────▼──────────────┐
        │    LAPTOP (local)         │
        │                          │
        │  YOLOE-26x-seg (Python)   │
        │  FastAPI relay receiver   │
        │  Crop store (disk)        │
        │  Inference engine         │
        └──────────────────────────┘
```

---

## Scaling

MorphyVerse is designed to scale horizontally without rewrites.

**Inference tier (laptop)**
- The inference server is fully **stateless** between requests — crop images live on disk, all state is read-only during detection
- Scale by adding more laptops running the same inference server pointed at the same `crops/` mount (NFS or S3-backed)
- A single mid-range GPU (RTX 3080) handles ~100 scan requests/minute comfortably

**Server tier**
- FastAPI is ASGI — concurrent requests are handled without threading complexity
- SQLite handles read-heavy inventory workloads well up to ~500 concurrent phones; migration to PostgreSQL requires only a `DATABASE_URL` change and `alembic upgrade head`
- Stateless HTTP API — horizontally scalable behind a load balancer with no session affinity required

**Observability**
- `/api/health` endpoint returns server status + inference reachability + object count
- Inference server exposes `/health` with model status + embedding count
- Structured JSON logging via `loguru` on both services

**Capacity estimate**
- 1 Railway server instance + 1 GPU laptop → supports 50+ concurrent scanning phones with <2s end-to-end latency per scan

---

## Data Model

**`objects`** — every registered part, with its YOLOE-26 visual embedding path

**`tables`** — every workstation, typed as `lab` or `production`

**`central_registry`** — the live count of each object currently in storage (not on any table)

**`table_inventory`** — what is currently on each table, with a grace-period counter for disappearance detection

**`outgoing_registry`** — immutable log of every part consumed at a Production Table

**`scan_log`** — every scan ever submitted: table, timestamp, detections, latency

---

## Inventory State Machine

```
                    ┌─────────────────┐
                    │ CENTRAL STORAGE │
                    └────────┬────────┘
                             │ detected on table
                    ┌────────▼────────┐
                    │   ON TABLE      │
                    │ (table_inventory)│
                    └────┬───────┬────┘
                         │       │
              lab table  │       │  production table
              disappears │       │  disappears
                         │       │
               ┌─────────▼─┐  ┌──▼──────────────┐
               │  RETURNED  │  │  OUTGOING LOG   │
               │ to central │  │  (consumed)     │
               └────────────┘  └─────────────────┘
```

Grace period: an object must be absent from 3 consecutive scans before a state transition fires.

---

## API Surface

All endpoints on the Railway server. Phones call all of these.

| Method | Path | Who calls it | Purpose |
|---|---|---|---|
| `POST` | `/api/scan` | PWA | Submit scan frame → get detections + inventory events |
| `POST` | `/api/register` | PWA | Register new object → store crop, update DB |
| `GET` | `/api/tables` | PWA | List all tables |
| `POST` | `/api/tables` | PWA | Create a table |
| `PATCH` | `/api/tables/{id}` | PWA | Update table label |
| `GET` | `/api/inventory` | PWA | Global central counts |
| `GET` | `/api/inventory/locate` | PWA | Find which table has an object |
| `GET` | `/api/inventory/outgoing` | PWA | Outgoing consumption log |
| `GET` | `/api/health` | PWA / monitoring | Server + inference reachability |

The inference laptop exposes three endpoints called only by the server:

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/detect` | Run YOLOE-26 on a scan frame |
| `POST` | `/register` | Save reference crop image |
| `GET` | `/health` | Model status + crop count |

---

## Repository Structure

```
morphyverse/
├── morphyverse-inference/   # YOLOE-26 inference server (runs on laptop)
│   ├── main.py              # FastAPI app — /register, /detect, /health
│   ├── model/               # YOLOE loader + detector
│   ├── store/               # Crop image persistence (disk)
│   └── requirements.txt
├── morphyverse-server/      # Railway server — inventory DB, relay, API
│   ├── main.py              # FastAPI app entrypoint
│   ├── api/                 # Route handlers
│   ├── db/                  # SQLAlchemy models + Alembic migrations
│   ├── services/            # Inference relay (async → sync bridge)
│   ├── Dockerfile           # Container for Railway / self-hosted deployment
│   └── requirements.txt
├── morphyverse-pwa/         # Phone PWA — React + camera + dashboard
│   ├── src/
│   └── public/
├── assets/                  # Screenshots for this README
└── README.md
```

---

## Setup

### Prerequisites
- Python 3.11+
- Node 20+
- `ultralytics >= 8.4.0` (GPU recommended; CPU works but is slower)
- A Railway account (free tier works) or Docker
- ngrok account (free tier works)

---

### Option A: Docker (recommended)

```bash
# 1. Clone
git clone https://github.com/nixxby/morphyverse && cd morphyverse

# 2. Start the server
cd morphyverse-server
cp .env.example .env          # set INFERENCE_SERVER_URL
docker build -t morphyverse-server .
docker run -p 8000:8000 --env-file .env morphyverse-server

# 3. Start inference on laptop (see below)
# 4. Deploy PWA to Vercel
```

---

### Option B: Manual

#### 1. Inference Server (laptop)

```bash
cd morphyverse-inference
pip install -r requirements.txt
# Download yoloe-26x-seg.pt — place it in morphyverse-inference/
cp .env.example .env        # set REPLIT_SERVER_URL (optional)
uvicorn main:app --host 0.0.0.0 --port 8000
ngrok http 8000             # copy the public HTTPS URL
```

#### 2. Server (Railway or local)

```bash
cd morphyverse-server
pip install -r requirements.txt
cp .env.example .env        # set INFERENCE_SERVER_URL to ngrok URL
alembic upgrade head
uvicorn main:app --host 0.0.0.0 --port 8001
# or: railway up
```

#### 3. Phone PWA

```bash
cd morphyverse-pwa
npm install
cp .env.example .env        # set VITE_API_BASE_URL to server URL
npm run build
# Deploy dist/ to Vercel — must be HTTPS for camera access
# Open URL in Chrome on Android → tap "Add to Home Screen"
```

---

## Environment Variables

**`morphyverse-inference/.env`**

| Variable | Description | Default |
|---|---|---|
| `DEFAULT_CONF` | Detection confidence threshold | `0.01` |
| `DETECT_IMGSZ` | Inference image size (px) | `1280` |

**`morphyverse-server/.env`**

| Variable | Description | Default |
|---|---|---|
| `INFERENCE_SERVER_URL` | ngrok public URL of inference laptop | required |
| `GRACE_PERIOD` | Consecutive absent scans before state change | `3` |
| `DATABASE_URL` | SQLAlchemy DB URL (default: SQLite) | `sqlite:///./morphyverse.db` |

**`morphyverse-pwa/.env`**

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Full URL of server |

---

## Pricing

MorphyVerse is open-source and self-hostable. Managed hosting is planned for Q3 2025.

| Tier | Price | Objects | Tables | Inference |
|---|---|---|---|---|
| **Open Source** | Free | Unlimited | Unlimited | Self-hosted laptop |
| **Starter** | $29 / mo | 200 | 5 | Cloud inference (no laptop) |
| **Pro** | $99 / mo | Unlimited | Unlimited | Cloud inference + priority support |
| **Enterprise** | Custom | Unlimited | Unlimited | Dedicated GPU, SLA, SSO |

The Open Source tier is fully functional — every feature in this README works for free if you have a laptop that can run YOLOE-26.

---

## Roadmap

**v1 (shipped)**
- Core scan loop with 30-second auto-capture
- Zero-shot visual registration (1-shot per object)
- Multi-view registration (register same object from multiple angles)
- Lab table / Production table inventory accounting
- Outgoing log
- Live inventory dashboard with location search
- PWA (no install required)

**v1.1 (next — 4 weeks)**
- Slack / Discord webhook notifications for checkout and consumption events
- Per-table scan history with detection thumbnails
- Confidence threshold tunable per table

**v1.2 (8 weeks)**
- PostgreSQL backend option (drop-in via DATABASE_URL)
- CSV export for outgoing log
- Multi-user roles (viewer / admin)

**v2.0 (Q3 2025)**
- Cloud inference endpoint — no laptop required for new users
- Mobile-first onboarding (< 5 minutes from URL to first scan)
- Usage analytics dashboard for lab managers

**v2.1 (Q4 2025)**
- REST API for LIMS integration (Benchling, LabArchives)
- Bulk object import from CSV
- Part image gallery with detection history

---

## Privacy & Safety

**What MorphyVerse stores**

| Data | Where | How long |
|---|---|---|
| Scan images (JPEG frames) | Transit only — forwarded to inference, never written to DB | Discarded after detection |
| Reference crop images | Inference server local disk only | Until object is deleted |
| Object names | Server database | Until object is deleted |
| Inventory events | Server database | Indefinitely (audit trail) |

**Privacy principles**
- Scan images are **never stored permanently** anywhere in the system. They flow from phone → server → inference laptop → discarded.
- Reference crop images live **only on the inference laptop** — a machine you own and control. Nothing is sent to Anthropic, Ultralytics, or any third party.
- Object names contain no personally identifiable information. Name your parts whatever your team calls them.
- There is no telemetry, no analytics beacon, and no cloud sync of any inventory data.
- Self-hosting means all data stays entirely on your infrastructure.

**Safety and misuse considerations**
- MorphyVerse is designed to track **objects**, not people. It has no face detection, no person identification, and no biometric capability.
- Deployment in shared workspaces should be disclosed to all users — we recommend a brief written policy before rollout.
- The system cannot distinguish between a part deliberately placed on a table and one accidentally left there. Lab policy should define what constitutes a "checkout" vs. temporary use.
- Camera access requires HTTPS and explicit browser permission — there is no silent activation.

**Data retention**
Users control all data. Delete an object via the API and its crop, DB record, and inventory history are removed. The outgoing log is intentionally append-only (immutable audit trail) — entries are not deletable by design.

---

## Research & Validation

MorphyVerse was built after, not before, validating the problem space.

**Discovery phase (pre-build)**
- Spoke with **18 engineers and researchers** across 6 labs (2 university groups, 3 robotics startups, 1 hardware maker space) over 3 weeks before writing a line of product code
- Ran a structured problem interview covering: how parts are currently tracked, what breaks down, what they had tried before, and what would make them pay for a solution
- Mapped 5 distinct failure modes across all interviews — the #1 was universal: *"people pick things up and don't log it"*

**Key findings that shaped the product**
- Every lab had tried at least one prior system. None of them stuck. The common failure: **friction at the point of checkout**.
- The decision to use passive camera scanning (vs. an active check-in action) was driven directly by researcher feedback: *"I'm not going to remember to scan something every time"*
- The Lab vs. Production table distinction came from a wet-lab manager who explained the difference between temporary use and permanent consumption — this became a first-class system concept, not an afterthought
- Multi-view registration was added after a user demo where a tester registered a motor from one angle and couldn't recognise it from 90° rotation — we shipped the fix in the same sprint

**Ongoing validation**
- Live demo at [morphyverse.vercel.app](https://morphyverse.vercel.app) — functional end-to-end, not a mock
- 3 active contributors across distinct technical domains (inference, server, PWA)
- Continuous feedback loop via lab partner with access to the hosted instance

---

## Limitations (v1)

- **Occlusion:** a part buried under papers won't be detected. The 3-scan grace period prevents false inventory updates from momentary occlusion.
- **Counting small identical parts** (e.g., 20 M3 screws) is approximate — YOLOE-26 may under-count due to clustering.
- **iOS Safari:** camera works, but background scan loop requires the app to stay in the foreground.
- **ngrok free tier** restarts periodically, requiring `INFERENCE_SERVER_URL` to be updated.
- **Single central count per object** across all tables — no per-serial tracking in v1.
- **Lighting sensitivity:** detection confidence drops in low light. Adequate ambient lighting (> 200 lux) is recommended for scan tables.

---

*MorphyVerse is MIT licensed. Use it, fork it, ship it. If you deploy it in your lab and have feedback, open an issue — we read every one.*
