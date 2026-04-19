from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from db.database import engine
from db import models  # noqa: F401 — registers models with Base
from db.database import Base

from api import scan, register, embeddings, tables, inventory, health

Base.metadata.create_all(bind=engine)

app = FastAPI(title="MorphyVerse Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scan.router)
app.include_router(register.router)
app.include_router(embeddings.router)
app.include_router(tables.router)
app.include_router(inventory.router)
app.include_router(health.router)

logger.info("MorphyVerse server started")
