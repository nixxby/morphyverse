import os
from dotenv import load_dotenv

load_dotenv()

# TODO: Validate that REPLIT_SERVER_URL is set and reachable on startup
REPLIT_SERVER_URL: str = os.environ["REPLIT_SERVER_URL"]
SYNC_INTERVAL: int = int(os.getenv("SYNC_INTERVAL", "60"))
DEFAULT_CONF: float = float(os.getenv("DEFAULT_CONF", "0.55"))
