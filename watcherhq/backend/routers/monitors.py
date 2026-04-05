import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.monitor import Monitor
from ..routers.auth import get_current_user
from ..models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/monitors", tags=["monitors"])

PLAN_LIMITS: Dict[str, int] = {
    "free": 3,
    "pro": 25,
    "business": -1,  # unlimited
}

VALID_MODULE_TYPES = {
    "pagespy", "pricehound", "digestbot",
    "mentionalert", "rankwatch", "jobradar", "leaseguard",
}


# ---------- Pydantic schemas ----------

class MonitorCreate(BaseModel):
    name: str
    module_type: str
    config: Optional[Dict[str, Any]] = None


class MonitorUpdate(BaseModel):
    name: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class MonitorResponse(BaseModel):
    id: int
    user_id: int
    name: str
    module_type: str
    config: Optional[Dict[str, Any]]
    is_active: bool
    last_checked: Optional[datetime]
    last_alert_at: Optional[datetime]
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Helpers ----------

def _check_plan_limit(user: User, db: Session) -> None:
    limit = PLAN_LIMITS.get(user.plan, 3)
    if limit == -1:
        return
    count = db.query(Monitor).filter(Monitor.user_id == user.id).count()
    if count >= limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Monitor limit reached for your plan ({user.plan}: {limit} monitors).",
        )


def _get_monitor_or_404(monitor_id: int, user: User, db: Session) -> Monitor:
    monitor = db.query(Monitor).filter(Monitor.id == monitor_id, Monitor.user_id == user.id).first()
    if not monitor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Monitor not found")
    return monitor


async def _run_monitor_worker(monitor: Monitor, db: Session) -> None:
    from ..workers import pagespy, pricehound, digestbot, mentionalert, rankwatch, jobradar, leaseguard

    worker_map = {
        "pagespy":      pagespy.run_pagespy,
        "pricehound":   pricehound.run_pricehound,
        "digestbot":    digestbot.run_digestbot,
        "mentionalert": mentionalert.run_mentionalert,
        "rankwatch":    rankwatch.run_rankwatch,
        "jobradar":     jobradar.run_jobradar,
        "leaseguard":   leaseguard.run_leaseguard,
    }
    fn = worker_map.get(monitor.module_type)
    if fn:
        await fn(monitor.id, db)


# ---------- Endpoints ----------

@router.get("", response_model=List[MonitorResponse])
def list_monitors(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(Monitor).filter(Monitor.user_id == current_user.id).all()


@router.post("", response_model=MonitorResponse, status_code=status.HTTP_201_CREATED)
def create_monitor(
    body: MonitorCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.module_type not in VALID_MODULE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid module_type. Must be one of: {', '.join(sorted(VALID_MODULE_TYPES))}",
        )
    _check_plan_limit(current_user, db)

    monitor = Monitor(
        user_id=current_user.id,
        name=body.name,
        module_type=body.module_type,
        config=body.config or {},
    )
    db.add(monitor)
    db.commit()
    db.refresh(monitor)
    return monitor


@router.get("/{monitor_id}", response_model=MonitorResponse)
def get_monitor(
    monitor_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_monitor_or_404(monitor_id, current_user, db)


@router.put("/{monitor_id}", response_model=MonitorResponse)
def update_monitor(
    monitor_id: int,
    body: MonitorUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    monitor = _get_monitor_or_404(monitor_id, current_user, db)

    if body.name is not None:
        monitor.name = body.name
    if body.config is not None:
        monitor.config = body.config
    if body.is_active is not None:
        monitor.is_active = body.is_active

    db.commit()
    db.refresh(monitor)
    return monitor


@router.delete("/{monitor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_monitor(
    monitor_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    monitor = _get_monitor_or_404(monitor_id, current_user, db)
    db.delete(monitor)
    db.commit()


@router.post("/{monitor_id}/run", response_model=MonitorResponse)
async def run_monitor(
    monitor_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    monitor = _get_monitor_or_404(monitor_id, current_user, db)
    try:
        await _run_monitor_worker(monitor, db)
        db.refresh(monitor)
    except Exception as exc:
        logger.error("Manual run failed for monitor %d: %s", monitor_id, exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Worker failed")
    return monitor
