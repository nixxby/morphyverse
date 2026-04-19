import os
from dotenv import load_dotenv

load_dotenv()

# No longer used for polling, but kept in case Replit integration needs it later
REPLIT_SERVER_URL: str = os.getenv("REPLIT_SERVER_URL", "")

DEFAULT_CONF: float = float(os.getenv("DEFAULT_CONF", "0.01"))
DETECT_IMGSZ: int = int(os.getenv("DETECT_IMGSZ", "1280"))
