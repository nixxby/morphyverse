# MorphyVerse — Inference Server

Runs on your laptop. Receives images from the Replit server, runs YOLOE-26 detection, and returns results. Exposed to the internet via ngrok.

---

## First-Time Setup

### 1. Install dependencies

```bash
pip install "ultralytics>=8.4.0" fastapi uvicorn httpx pillow python-dotenv loguru
```

### 2. Download the model

```bash
python -c "from ultralytics import YOLOE; YOLOE('yoloe-26s-seg.pt')"
```

This downloads `yoloe-26s-seg.pt` (~50MB) into the current directory on first run.

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```
REPLIT_SERVER_URL=https://your-replit-app.replit.app
SYNC_INTERVAL=60
DEFAULT_CONF=0.55
```

Get `REPLIT_SERVER_URL` from Person 2 (Replit server).

---

## Running

Open two terminal tabs. Keep both alive for the duration of the hackathon.

**Tab 1 — inference server:**
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

Wait for the log line confirming the model is loaded before proceeding.

**Tab 2 — ngrok tunnel:**
```bash
ngrok http 8000
```

ngrok will print a public URL like `https://abc123.ngrok-free.app`. Copy it and give it to Person 2 — they set it as `INFERENCE_SERVER_URL` in Replit Secrets.

**Confirm it's working:**
```bash
curl https://abc123.ngrok-free.app/health
```

Should return `{"status":"ok","model_loaded":true,...}`.

---

## Important: Keep ngrok alive

On the free ngrok tier, the public URL changes every time ngrok restarts. If your tunnel dies:

1. Restart ngrok: `ngrok http 8000`
2. Copy the new URL
3. Update `INFERENCE_SERVER_URL` in Replit Secrets
4. Replit will pick it up on the next request

To avoid this: don't close the ngrok terminal tab, and don't let your laptop sleep. If you're doing this repeatedly, a paid ngrok account ($10/month) gives you a static domain that never changes.

---

## What Each Endpoint Does

`POST /detect` — receives a scan frame from Replit, runs YOLOE-26 against all registered object embeddings, returns detections.

`POST /register` — receives a cropped object photo from Replit, extracts a YOLOE-26 visual embedding, returns it as a float array. Does not store anything locally.

`GET /health` — returns model status, number of embeddings currently loaded, and last sync timestamp.

---

## Logs

Inference calls are logged to `logs/inference.log`. Each line is JSON with `table_id`, detected objects, and `latency_ms`.

---

## Troubleshooting

**Model not loading** — make sure `yoloe-26s-seg.pt` is in the project root. Re-run the download step.

**`/health` returns `degraded`** — the embedding sync from Replit is failing. Check that `REPLIT_SERVER_URL` in `.env` is correct and the Replit server is running.

**ngrok returns 502** — the inference server isn't running. Start Tab 1 first, then Tab 2.

**Slow inference** — `yoloe-26s-seg` runs in ~1–3s on CPU. This is fine at a 30-second scan interval. If it's taking longer, check that no other heavy processes are running on the laptop.