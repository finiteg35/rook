from datetime import datetime
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.alert import Alert
from ..routers.auth import get_current_user
from ..models.user import User

router = APIRouter(prefix="/alerts", tags=["alerts"])


# ---------- Pydantic schemas ----------

class AlertResponse(BaseModel):
    id: int
    monitor_id: int
    user_id: int
    title: str
    message: str
    data: Optional[Any]
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Helpers ----------

def _get_alert_or_404(alert_id: int, user: User, db: Session) -> Alert:
    alert = db.query(Alert).filter(Alert.id == alert_id, Alert.user_id == user.id).first()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    return alert


# ---------- Endpoints ----------

@router.get("", response_model=List[AlertResponse])
def list_alerts(
    monitor_id: Optional[int] = Query(None, description="Filter by monitor ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Alert).filter(Alert.user_id == current_user.id)
    if monitor_id is not None:
        query = query.filter(Alert.monitor_id == monitor_id)
    return query.order_by(Alert.created_at.desc()).all()


@router.get("/{alert_id}", response_model=AlertResponse)
def get_alert(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_alert_or_404(alert_id, current_user, db)


@router.put("/{alert_id}/read", response_model=AlertResponse)
def mark_alert_read(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alert = _get_alert_or_404(alert_id, current_user, db)
    alert.is_read = True
    db.commit()
    db.refresh(alert)
    return alert


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_alert(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alert = _get_alert_or_404(alert_id, current_user, db)
    db.delete(alert)
    db.commit()
