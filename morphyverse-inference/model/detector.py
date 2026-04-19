import threading
from pathlib import Path

import numpy as np
from PIL import Image
from PIL.Image import Image as PILImage

from config import DETECT_IMGSZ
from model.loader import get_model

# Serialises model state changes across concurrent requests:
# model.predict() with visual_prompts mutates model.model[-1].nc and model.names
_detect_lock = threading.Lock()


def run_detection(pil_image: PILImage, crops: list[dict], conf: float) -> list[dict]:
    """Run YOLOE-26 visual-prompt inference against all registered crops."""
    if not crops:
        return []

    composite, bboxes, valid_crops = _build_reference(crops)
    if composite is None:
        return []

    model = get_model()

    from ultralytics.models.yolo.yoloe import YOLOEVPSegPredictor  # noqa: PLC0415

    with _detect_lock:
        results = model.predict(
            source=pil_image,
            visual_prompts={
                "bboxes": bboxes.tolist(),
                "cls": list(range(len(valid_crops))),
            },
            refer_image=composite,
            predictor=YOLOEVPSegPredictor,
            conf=conf,
            imgsz=DETECT_IMGSZ,
            verbose=False,
        )

    return _parse_results(results, valid_crops)


def _build_reference(crops: list[dict]) -> tuple:
    """
    Composite all crop images side-by-side into one reference image.
    Normalises all crops to the same height first so YOLOE's letterboxing
    treats each reference region at comparable scale.
    Returns (composite_pil, bboxes_np [N,4], valid_entries).
    """
    REF_HEIGHT = 320

    images, valid = [], []
    for entry in crops:
        p = Path(entry["path"])
        if p.exists():
            img = Image.open(p).convert("RGB")
            scale = REF_HEIGHT / img.height
            img = img.resize((max(1, int(img.width * scale)), REF_HEIGHT), Image.Resampling.LANCZOS)
            images.append(img)
            valid.append(entry)

    if not images:
        return None, None, []

    total_w = sum(img.width for img in images)
    composite = Image.new("RGB", (total_w, REF_HEIGHT))

    bboxes, x = [], 0
    for img in images:
        composite.paste(img, (x, 0))
        bboxes.append([x, 0, x + img.width, REF_HEIGHT])
        x += img.width

    return composite, np.array(bboxes, dtype=np.float32), valid


def _parse_results(results, crops: list[dict]) -> list[dict]:
    """
    Group boxes by object name so that multiple registered crops of the same
    physical object merge into one detection entry. Applies IoU NMS per name
    group to suppress duplicate boxes produced by overlapping crop embeddings.
    Uses the object_id of the highest-confidence crop as the representative ID.
    """
    if not results or results[0].boxes is None or len(results[0].boxes) == 0:
        return []

    r = results[0]
    boxes_xyxy = r.boxes.xyxy.cpu().numpy()
    confs = r.boxes.conf.cpu().numpy()
    cls_ids = r.boxes.cls.cpu().numpy().astype(int)

    # Collect raw hits grouped by name
    by_name: dict[str, dict] = {}
    for box, conf_val, cls_idx in zip(boxes_xyxy, confs, cls_ids):
        if cls_idx >= len(crops):
            continue
        entry = crops[cls_idx]
        name = entry["name"]
        conf_f = float(conf_val)
        if name not in by_name:
            by_name[name] = {"object_id": entry["object_id"], "best_conf": conf_f,
                             "boxes": [], "confs": []}
        elif conf_f > by_name[name]["best_conf"]:
            # Track object_id of the best-matching crop for this name
            by_name[name]["object_id"] = entry["object_id"]
            by_name[name]["best_conf"] = conf_f
        by_name[name]["boxes"].append(box)
        by_name[name]["confs"].append(conf_f)

    detections = []
    for name, data in by_name.items():
        boxes = np.array(data["boxes"])
        confs_arr = np.array(data["confs"])
        keep = _nms(boxes, confs_arr, iou_thresh=0.5)
        kept_boxes = boxes[keep]
        kept_confs = confs_arr[keep]
        detections.append({
            "object_id": data["object_id"],
            "name": name,
            "count": len(kept_boxes),
            "confidence": round(float(kept_confs.max()), 4),
            "bboxes": [[int(x1), int(y1), int(x2), int(y2)]
                       for x1, y1, x2, y2 in kept_boxes],
        })

    return detections


def _nms(boxes: np.ndarray, confs: np.ndarray, iou_thresh: float = 0.5) -> np.ndarray:
    """Greedy IoU NMS. Returns indices of kept boxes sorted by confidence."""
    if len(boxes) == 0:
        return np.array([], dtype=int)
    order = np.argsort(confs)[::-1]
    keep = []
    while len(order):
        i = order[0]
        keep.append(i)
        if len(order) == 1:
            break
        ious = _iou(boxes[i], boxes[order[1:]])
        order = order[1:][ious < iou_thresh]
    return np.array(keep, dtype=int)


def _iou(box: np.ndarray, boxes: np.ndarray) -> np.ndarray:
    x1 = np.maximum(box[0], boxes[:, 0])
    y1 = np.maximum(box[1], boxes[:, 1])
    x2 = np.minimum(box[2], boxes[:, 2])
    y2 = np.minimum(box[3], boxes[:, 3])
    inter = np.maximum(0, x2 - x1) * np.maximum(0, y2 - y1)
    area_a = (box[2] - box[0]) * (box[3] - box[1])
    area_b = (boxes[:, 2] - boxes[:, 0]) * (boxes[:, 3] - boxes[:, 1])
    return inter / np.maximum(area_a + area_b - inter, 1e-6)
