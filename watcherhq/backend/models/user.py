from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    plan: Mapped[str] = mapped_column(String, default="free")  # "free", "pro", "business"
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    notification_email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    telegram_chat_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
