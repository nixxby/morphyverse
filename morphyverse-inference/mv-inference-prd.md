# MorphyVerse — Inference Server (Laptop)
### Technical Design Document — Person 1 of 3
*April 2026*

---

## Context

You are building the YOLOE-26 inference server that runs on a laptop. It is called by the Replit server only — never directly by phones. Two other people are building the Replit server (Person 2) and the phone PWA (Person 3). This document defines your contracts with Person 2 precisely. Do not deviate from the request/response shapes below.

---

## API Contract

You expose three endpoints over HTTP. Person 2 (Replit server) calls all three.

---

### `POST /detect`

Called by Replit server when a phone submits a scan.

**Request:** `multipart/form-data`

| Field | Type | Description |
|---|---|---|
| `table_id` | string | ID of the table being scanned, e.g. `"bench-west-01"` |
| `image` | file (JPEG) | Full frame captured from phone camera |
| `conf` | float (optional) | Confidence threshold override. Default: `0.55` |

**Response:** `application/json`

```json
{
  "detections": [
    {
      "object_id": "uuid-string",
      "name": "775 DC Motor",
      "count": 2,
      "confidence": 0.82,
      "bboxes": [[x1, y1, x2, y2], [x1, y1, x2, y2]]
    }
  ],
  "latency_ms": 340,
  "embedding_count": 12,
  "model_version": "yoloe-26s-seg"
}
```

- `detections` is an empty array `[]` if nothing is found, never `null`
- `bboxes` are pixel coordinates in `[x1, y1, x2, y2]` format, relative to the submitted image dimensions
- `count` is the number of bounding boxes for that object class in this frame

---

### `POST /register`

Called by Replit server when a user registers a new object. You receive a cropped image, extract a YOLOE-26 visual embedding, and return it. You do NOT store anything — Replit stores the embedding.

**Request:** `multipart/form-data`

| Field | Type | Description |
|---|---|---|
| `object_name` | string | Human-readable name, e.g. `"ESP32-C3"` |
| `crop` | file (JPEG) | Tightly cropped image of the object (bounding box crop from phone) |

**Response:** `application/json`

```json
{
  "object_name": "ESP32-C3",
  "embedding": [0.342, -0.117, 0.894, ...]
}
```

- `embedding` is a flat list of floats (YOLOE-26 SAVPE output). Length depends on model variant — do not hardcode a length expectation anywhere.
- Return HTTP 400 if the crop image cannot be decoded.

---

### `GET /health`

Called by Replit server to confirm the inference server is alive and ready.

**Response:** `application/json`

```json
{
  "status": "ok",
  "model_loaded": true,
  "embedding_count": 12,
  "last_sync_ts": "2026-04-19T10:32:00Z"
}
```

- `status` is `"ok"` when model is loaded and embeddings are synced, `"degraded"` if model is loaded but embedding sync has failed for more than 2 intervals, `"not_ready"` if model is still loading.
- `last_sync_ts` is ISO 8601 UTC string of when embeddings were last successfully fetched from Replit.

---

### `GET /api/embeddings` ← You call this (Replit exposes it)

Your embedding cache polls this endpoint on Replit every `SYNC_INTERVAL` seconds.

**You call:** `GET {REPLIT_SERVER_URL}/api/embeddings`

**You expect back:**

```json
[
  {
    "object_id": "uuid-string",
    "name": "775 DC Motor",
    "embedding": [0.342, -0.117, 0.894, ...]
  }
]
```

- Replace your entire in-memory embedding store atomically on each successful poll.
- If the poll fails, keep using the previous store and log a warning.

---

## Feature Requirements

- Load `YOLOE("yoloe-26s-seg.pt")` once on startup using FastAPI `lifespan`; keep model in memory for the lifetime of the server
- Maintain an in-memory embedding cache refreshed from Replit every `SYNC_INTERVAL` seconds (default: 60)
- `/detect` runs YOLOE-26 inference with all cached visual embeddings as prompts
- `/register` extracts a visual embedding from a crop and returns it — no local storage
- All endpoints are unauthenticated (Replit is the only caller; isolated by ngrok)
- Log every `/detect` call: `table_id`, detected objects, `latency_ms`, timestamp

---

## Stack

- Python 3.11
- FastAPI + Uvicorn
- `ultralytics >= 8.4.0`
- `httpx` (polling Replit for embeddings)
- `Pillow` (image decoding)
- `python-dotenv`
- `loguru`

---

## File Structure

```
morphyverse-inference/
├── main.py                  # FastAPI app + lifespan, endpoint wiring
├── model/
│   ├── loader.py            # Singleton YOLOE-26 model, loaded on startup
│   └── detector.py          # run_detection(pil_image, embeddings) → list[dict]
├── embeddings/
│   ├── cache.py             # EmbeddingCache: in-memory store + background refresh thread
│   └── extractor.py         # extract_embedding(pil_image) → list[float]
├── config.py                # Reads .env: REPLIT_SERVER_URL, SYNC_INTERVAL, DEFAULT_CONF
├── logger.py                # Loguru setup + inference log writer
├── .env                     # REPLIT_SERVER_URL, SYNC_INTERVAL=60, DEFAULT_CONF=0.55
├── requirements.txt
└── README.md
```

---

## TODOs (in order)

- [ ] `pip install "ultralytics>=8.4.0" fastapi uvicorn httpx pillow python-dotenv loguru`
- [ ] `config.py` — read `REPLIT_SERVER_URL`, `SYNC_INTERVAL` (int, default 60), `DEFAULT_CONF` (float, default 0.55) from `.env`
- [ ] `model/loader.py` — module-level `_model = None`; `load_model()` calls `YOLOE("yoloe-26s-seg.pt")` and assigns to `_model`; `get_model()` returns `_model`; log load time in seconds
- [ ] `embeddings/cache.py` — `EmbeddingCache` with `_store: list[dict]` and a `threading.Thread` that calls `GET {REPLIT_SERVER_URL}/api/embeddings` every `SYNC_INTERVAL` seconds using `httpx`; on success atomically replaces `_store`; exposes `get_all() → list[{object_id, name, embedding}]` and `count() → int` and `last_sync_ts() → str | None`
- [ ] `embeddings/extractor.py` — `extract_embedding(pil_image: Image) → list[float]`; use YOLOE-26 SAVPE module to encode the crop; return as plain Python list of floats
- [ ] `model/detector.py` — `run_detection(pil_image: Image, embeddings: list[dict], conf: float) → list[dict]`; build visual prompts from embedding list; call `model.predict()`; parse results into `{object_id, name, count, confidence, bboxes}` per the response contract above; return `[]` if no detections
- [ ] `logger.py` — configure loguru; `log_inference(table_id, detections, latency_ms)` writes JSON line to `logs/inference.log`
- [ ] `main.py`:
  - FastAPI `lifespan`: call `load_model()` and start `EmbeddingCache` thread on startup
  - `POST /detect`: parse `table_id` (Form), `image` (UploadFile), `conf` (Form, optional); decode JPEG to PIL; call `run_detection`; call `log_inference`; return response per contract
  - `POST /register`: parse `object_name` (Form), `crop` (UploadFile); decode JPEG to PIL; call `extract_embedding`; return `{object_name, embedding}`
  - `GET /health`: return `{status, model_loaded, embedding_count, last_sync_ts}`
- [ ] Test locally: `uvicorn main:app --host 0.0.0.0 --port 8000`; hit `/health`, confirm `model_loaded: true`
- [ ] Run `ngrok http 8000`; give the public HTTPS URL to Person 2 to set as `INFERENCE_SERVER_URL` in Replit Secrets
