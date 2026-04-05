import logging
from typing import Any, Dict, List

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models.user import User
from ..routers.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["billing"])

if settings.STRIPE_SECRET_KEY:
    stripe.api_key = settings.STRIPE_SECRET_KEY

PLAN_INFO: List[Dict[str, Any]] = [
    {
        "id": "free",
        "name": "Free",
        "price_usd": 0,
        "monitors": 3,
        "features": ["3 monitors", "Daily checks", "Email notifications"],
    },
    {
        "id": "pro",
        "name": "Pro",
        "price_usd": 9,
        "price_id": settings.STRIPE_PRO_PRICE_ID,
        "monitors": 25,
        "features": ["25 monitors", "Hourly checks", "Email & Telegram notifications", "Priority support"],
    },
    {
        "id": "business",
        "name": "Business",
        "price_usd": 29,
        "price_id": settings.STRIPE_BUSINESS_PRICE_ID,
        "monitors": -1,
        "features": ["Unlimited monitors", "15-minute checks", "All notification channels", "Dedicated support"],
    },
]

PRICE_ID_TO_PLAN: Dict[str, str] = {
    settings.STRIPE_PRO_PRICE_ID: "pro",
    settings.STRIPE_BUSINESS_PRICE_ID: "business",
}


# ---------- Pydantic schemas ----------

class CheckoutRequest(BaseModel):
    plan: str  # "pro" or "business"


class CheckoutResponse(BaseModel):
    checkout_url: str


class PortalResponse(BaseModel):
    portal_url: str


# ---------- Helpers ----------

def _require_stripe() -> None:
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing is not configured on this server",
        )


def _ensure_stripe_customer(user: User, db: Session) -> str:
    """Create a Stripe customer if one doesn't exist; return customer ID."""
    if user.stripe_customer_id:
        return user.stripe_customer_id
    customer = stripe.Customer.create(email=user.email, metadata={"user_id": str(user.id)})
    user.stripe_customer_id = customer.id
    db.commit()
    return customer.id


# ---------- Endpoints ----------

@router.get("/plans")
def get_plans():
    return PLAN_INFO


@router.post("/checkout", response_model=CheckoutResponse)
def create_checkout(
    body: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_stripe()

    price_map = {"pro": settings.STRIPE_PRO_PRICE_ID, "business": settings.STRIPE_BUSINESS_PRICE_ID}
    price_id = price_map.get(body.plan)
    if not price_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid plan")

    customer_id = _ensure_stripe_customer(current_user, db)

    try:
        session = stripe.checkout.Session.create(
            customer=customer_id,
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{settings.APP_URL}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{settings.APP_URL}/billing/cancel",
        )
    except stripe.error.StripeError as exc:
        logger.error("Stripe checkout error for user %d: %s", current_user.id, exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Stripe error")

    return CheckoutResponse(checkout_url=session.url)


@router.get("/portal", response_model=PortalResponse)
def billing_portal(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_stripe()

    if not current_user.stripe_customer_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No billing account found")

    try:
        session = stripe.billing_portal.Session.create(
            customer=current_user.stripe_customer_id,
            return_url=f"{settings.APP_URL}/dashboard",
        )
    except stripe.error.StripeError as exc:
        logger.error("Stripe portal error for user %d: %s", current_user.id, exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Stripe error")

    return PortalResponse(portal_url=session.url)


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Webhook not configured")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature")
    except Exception as exc:
        logger.error("Webhook parsing error: %s", exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bad webhook payload")

    event_type: str = event["type"]
    data_obj = event["data"]["object"]

    if event_type == "customer.subscription.created":
        _handle_subscription_created(data_obj, db)
    elif event_type == "customer.subscription.deleted":
        _handle_subscription_deleted(data_obj, db)
    elif event_type == "invoice.payment_failed":
        _handle_payment_failed(data_obj, db)
    else:
        logger.debug("Unhandled Stripe event type: %s", event_type)

    return {"received": True}


def _handle_subscription_created(subscription: Any, db: Session) -> None:
    customer_id: str = subscription.get("customer", "")
    subscription_id: str = subscription.get("id", "")
    items = subscription.get("items", {}).get("data", [])
    price_id = items[0]["price"]["id"] if items else ""

    plan = PRICE_ID_TO_PLAN.get(price_id, "free")

    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if user:
        user.plan = plan
        user.stripe_subscription_id = subscription_id
        db.commit()
        logger.info("User %d upgraded to plan=%s", user.id, plan)


def _handle_subscription_deleted(subscription: Any, db: Session) -> None:
    customer_id: str = subscription.get("customer", "")
    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if user:
        user.plan = "free"
        user.stripe_subscription_id = None
        db.commit()
        logger.info("User %d subscription cancelled; reverted to free", user.id)


def _handle_payment_failed(invoice: Any, db: Session) -> None:
    customer_id: str = invoice.get("customer", "")
    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if user:
        logger.warning("Payment failed for user %d (customer=%s)", user.id, customer_id)
