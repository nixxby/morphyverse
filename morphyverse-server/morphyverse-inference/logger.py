import json
from pathlib import Path
from loguru import logger

# TODO: Rotate logs/inference.log at 50 MB; retain last 7 days
Path("logs").mkdir(exist_ok=True)
logger.add("logs/inference.log", format="{message}", serialize=False, rotation="50 MB")


def log_inference(table_id: str, detections: list[dict], latency_ms: int) -> None:
    # TODO: Include timestamp in ISO 8601 UTC format
    logger.info(json.dumps({
        "table_id": table_id,
        "detections": detections,
        "latency_ms": latency_ms,
    }))
