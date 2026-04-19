import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Form, UploadFile, HTTPException
from PIL import Image
import io

from config import DEFAULT_CONF
from embeddings.cache import EmbeddingCache
from embeddings.extractor import extract_embedding
from logger import log_inference
from model.detector import run_detection
from model.loader import load_model, get_model

# TODO: Add CORS middleware if needed for local testing
# TODO: Add request-size limit to prevent oversized image uploads

embedding_cache = EmbeddingCache()


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()
    embedding_cache.start()
    # TODO: Block until first embedding sync completes before accepting requests (optional grace period)
    yield


app = FastAPI(title="MorphyVerse Inference", lifespan=lifespan)


@app.post("/detect")
async def detect(
    table_id: str = Form(...),
    image: UploadFile = Form(...),
    conf: float = Form(DEFAULT_CONF),
):
    # TODO: Validate image content-type is image/jpeg before decoding
    try:
        pil_image = Image.open(io.BytesIO(await image.read())).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Cannot decode image")

    embeddings = embedding_cache.get_all()
    t0 = time.monotonic()
    detections = run_detection(pil_image, embeddings, conf)
    latency_ms = int((time.monotonic() - t0) * 1000)

    log_inference(table_id, detections, latency_ms)

    return {
        "detections": detections,
        "latency_ms": latency_ms,
        "embedding_count": embedding_cache.count(),
        "model_version": "yoloe-26s-seg",
    }


@app.post("/register")
async def register(
    object_name: str = Form(...),
    crop: UploadFile = Form(...),
):
    try:
        pil_image = Image.open(io.BytesIO(await crop.read())).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Cannot decode crop image")

    # TODO: Add minimum crop size validation (e.g., reject crops smaller than 32x32 px)
    embedding = extract_embedding(pil_image)

    return {"object_name": object_name, "embedding": embedding}


@app.get("/health")
async def health():
    try:
        model = get_model()
        model_loaded = model is not None
    except RuntimeError:
        model_loaded = False

    # TODO: Implement "degraded" status when embedding sync has failed for > 2 intervals
    last_sync = embedding_cache.last_sync_ts()
    status = "ok" if model_loaded and last_sync else ("not_ready" if not model_loaded else "degraded")

    return {
        "status": status,
        "model_loaded": model_loaded,
        "embedding_count": embedding_cache.count(),
        "last_sync_ts": last_sync,
    }
