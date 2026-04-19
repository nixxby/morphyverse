from PIL.Image import Image as PILImage
from model.loader import get_model

# TODO: Confirm the SAVPE (Spatially-Aware Visual Prompt Encoder) API on the ultralytics YOLOE object
# TODO: Determine whether the model must be in eval() mode and whether grad is needed


def extract_embedding(pil_image: PILImage) -> list[float]:
    """Extract a YOLOE-26 SAVPE visual embedding from a reference crop. Returns a flat list of floats."""
    model = get_model()

    # TODO: Call the correct SAVPE encode method — e.g., model.encode_image(pil_image) or similar
    # TODO: Convert tensor output to a plain Python list[float] before returning
    raise NotImplementedError
