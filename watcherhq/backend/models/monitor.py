from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from ..database import Base


class Monitor(Base):
    __tablename__ = "monitors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    module_type: Mapped[str] = mapped_column(
        String, nullable=False
    )  # "pagespy","pricehound","digestbot","mentionalert","rankwatch","jobradar","leaseguard"
    config: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_checked: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_alert_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_state: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="pending")  # "ok", "alert", "error", "pending"
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
