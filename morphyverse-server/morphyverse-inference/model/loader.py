import time
from loguru import logger

# TODO: Download yoloe-26s-seg.pt and place it in the project root before running
_model = None


def load_model() -> None:
    global _model
    # TODO: Confirm the correct YOLOE import path from ultralytics >= 8.4.0
    from ultralytics import YOLOE
    start = time.time()
    _model = YOLOE("yoloe-26s-seg.pt")
    elapsed = time.time() - start
    logger.info(f"YOLOE-26s loaded in {elapsed:.2f}s")


def get_model():
    # TODO: Raise a clear error if get_model() is called before load_model()
    if _model is None:
        raise RuntimeError("Model not loaded. Call load_model() first.")
    return _model
