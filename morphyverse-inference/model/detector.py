from PIL.Image import Image as PILImage
from model.loader import get_model

# TODO: Verify YOLOE-26 visual prompt API shape — confirm how embeddings are passed to model.predict()
# TODO: Handle the case where embeddings list is empty (skip inference, return [])


def run_detection(pil_image: PILImage, embeddings: list[dict], conf: float) -> list[dict]:
    """Run YOLOE-26 visual-prompt inference. Returns [] if no detections or no embeddings."""
    if not embeddings:
        return []

    model = get_model()

    # TODO: Build visual_prompts from embeddings list in the format YOLOE-26 expects
    visual_prompts = _build_visual_prompts(embeddings)

    # TODO: Confirm correct keyword args for YOLOE-26 predict with visual prompts
    results = model.predict(pil_image, visual_prompts=visual_prompts, conf=conf)

    # TODO: Parse ultralytics Results object into the contract shape below
    detections = _parse_results(results, embeddings)
    return detections


def _build_visual_prompts(embeddings: list[dict]):
    # TODO: Implement prompt construction from stored float-list embeddings
    raise NotImplementedError


def _parse_results(results, embeddings: list[dict]) -> list[dict]:
    """
    Target shape per detected class:
    {
        "object_id": str,
        "name": str,
        "count": int,
        "confidence": float,   # highest confidence among boxes for this object
        "bboxes": [[x1,y1,x2,y2], ...]
    }
    """
    # TODO: Implement results parsing — group boxes by object_id, compute count
    raise NotImplementedError
