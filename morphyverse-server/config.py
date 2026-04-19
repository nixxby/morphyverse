from dotenv import load_dotenv
import os

load_dotenv()

INFERENCE_SERVER_URL = os.getenv("INFERENCE_SERVER_URL", "http://localhost:8001")
GRACE_PERIOD = int(os.getenv("GRACE_PERIOD", "3"))
