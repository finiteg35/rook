import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .routers import auth_router, monitors_router, alerts_router, billing_router
from .workers.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting WatcherHQ backend…")
    init_db()
    start_scheduler()
    yield
    stop_scheduler()
    logger.info("WatcherHQ backend stopped.")


app = FastAPI(
    title="WatcherHQ API",
    version="1.0.0",
    description="Monitoring-as-a-service: PageSpy, PriceHound, DigestBot, MentionAlert, RankWatch, JobRadar, LeaseGuard",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(monitors_router, prefix="/api")
app.include_router(alerts_router, prefix="/api")
app.include_router(billing_router, prefix="/api")


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}
