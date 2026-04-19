import json
import threading
from pathlib import Path
from PIL.Image import Image as PILImage

CROPS_DIR = Path("crops")
INDEX_FILE = CROPS_DIR / "index.json"


class CropStore:
    """Persists reference crop images to disk. Thread-safe via a write lock."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        CROPS_DIR.mkdir(exist_ok=True)
        if not INDEX_FILE.exists():
            INDEX_FILE.write_text("[]")

    def save(self, object_id: str, name: str, pil_image: PILImage) -> None:
        crop_path = CROPS_DIR / f"{object_id}.jpg"
        pil_image.save(crop_path, "JPEG")
        with self._lock:
            index = self._read_index()
            index = [e for e in index if e["object_id"] != object_id]
            index.append({"object_id": object_id, "name": name, "path": str(crop_path)})
            INDEX_FILE.write_text(json.dumps(index, indent=2))

    def get_all(self) -> list[dict]:
        with self._lock:
            return self._read_index()

    def count(self) -> int:
        with self._lock:
            return len(self._read_index())

    def _read_index(self) -> list[dict]:
        try:
            return json.loads(INDEX_FILE.read_text())
        except Exception:
            return []
