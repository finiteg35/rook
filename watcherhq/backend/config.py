from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    OPENCLAW_API_URL: str = "http://localhost:3000"
    OPENCLAW_API_KEY: str = ""

    DATABASE_URL: str = "sqlite:///./watcherhq.db"

    SECRET_KEY: str = "your-secret-key-here"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRO_PRICE_ID: str = ""
    STRIPE_BUSINESS_PRICE_ID: str = ""

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""

    TELEGRAM_BOT_TOKEN: str = ""

    APP_URL: str = "https://yourdomain.com"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
