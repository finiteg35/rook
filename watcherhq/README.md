# WatcherHQ — AI Monitoring Platform

> Set it and forget it. WatcherHQ monitors websites, prices, brand mentions, job boards, rental listings, keyword rankings, and delivers personalized news digests — all powered by OpenClaw, your self-hosted AI engine.

## 🗂️ Project Structure

```
watcherhq/
  backend/      # FastAPI Python backend
  frontend/     # Next.js frontend
  nginx/        # Nginx reverse proxy config
  docker-compose.yml
  .env.example
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Python 3.11+
- Node.js 20+
- OpenClaw running locally on port 3000

### 1. Clone & configure

```bash
cd watcherhq
cp .env.example .env
# Edit .env with your values
```

### 2. Start the backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The API will be available at http://localhost:8000  
API docs: http://localhost:8000/docs

### 3. Start the frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Edit .env.local — set NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

The app will be available at http://localhost:3001

---

## 🖥️ VPS Deployment (Hostinger)

### Prerequisites
- VPS with Ubuntu 22.04+
- Domain name pointed at your VPS IP
- OpenClaw already running on the VPS

### 1. Install system dependencies

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3.11 python3.11-venv python3-pip nodejs npm nginx certbot python3-certbot-nginx
```

### 2. Clone the repository

```bash
git clone https://github.com/youruser/rook.git /opt/watcherhq
cd /opt/watcherhq/watcherhq
cp .env.example .env
nano .env  # Fill in all values
```

### 3. Set up the backend

```bash
cd /opt/watcherhq/watcherhq/backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create a systemd service
sudo nano /etc/systemd/system/watcherhq-backend.service
```

Paste:
```ini
[Unit]
Description=WatcherHQ Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/watcherhq/watcherhq/backend
EnvironmentFile=/opt/watcherhq/watcherhq/.env
ExecStart=/opt/watcherhq/watcherhq/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable watcherhq-backend
sudo systemctl start watcherhq-backend
```

### 4. Set up the frontend

```bash
cd /opt/watcherhq/watcherhq/frontend
npm install
cp .env.local.example .env.local
nano .env.local  # Set NEXT_PUBLIC_API_URL=https://yourdomain.com

npm run build

sudo nano /etc/systemd/system/watcherhq-frontend.service
```

Paste:
```ini
[Unit]
Description=WatcherHQ Frontend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/watcherhq/watcherhq/frontend
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable watcherhq-frontend
sudo systemctl start watcherhq-frontend
```

### 5. Configure Nginx

```bash
sudo cp /opt/watcherhq/watcherhq/nginx/watcherhq.conf /etc/nginx/sites-available/watcherhq
sudo ln -s /etc/nginx/sites-available/watcherhq /etc/nginx/sites-enabled/
sudo nano /etc/nginx/sites-available/watcherhq
# Replace yourdomain.com with your actual domain

sudo nginx -t
sudo systemctl reload nginx
```

### 6. Set up SSL (HTTPS)

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
# Follow the prompts — certbot will auto-configure Nginx for HTTPS
```

### 7. Configure Stripe webhook

1. Go to https://dashboard.stripe.com/webhooks
2. Add endpoint: `https://yourdomain.com/api/billing/webhook`
3. Select events: `customer.subscription.created`, `customer.subscription.deleted`, `invoice.payment_failed`
4. Copy the webhook signing secret into your `.env` as `STRIPE_WEBHOOK_SECRET`

---

## 🐳 Docker Deployment (Alternative)

```bash
cd /opt/watcherhq/watcherhq
cp .env.example .env
nano .env  # Fill in all values

docker compose up -d --build
```

---

## ⚙️ Configuration Reference

| Variable | Description |
|---|---|
| `OPENCLAW_API_URL` | OpenClaw local API URL (default: http://localhost:3000) |
| `OPENCLAW_API_KEY` | Optional API key for OpenClaw |
| `DATABASE_URL` | SQLAlchemy DB URL (SQLite or PostgreSQL) |
| `SECRET_KEY` | JWT signing secret (generate with `openssl rand -hex 32`) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRO_PRICE_ID` | Stripe Price ID for Pro plan ($9.99/mo) |
| `STRIPE_BUSINESS_PRICE_ID` | Stripe Price ID for Business plan ($24.99/mo) |
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP port (587 for TLS) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASSWORD` | SMTP password or app password |
| `SMTP_FROM` | Sender email address |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from @BotFather |
| `APP_URL` | Public URL of your app |

---

## 📦 Monitoring Modules

| Module | What it monitors | Free | Pro | Business |
|---|---|---|---|---|
| **PageSpy** 👁️ | URL changes (content diff) | 24h | 1h | 15min |
| **PriceHound** 💰 | Product price drops | 24h | 6h | 1h |
| **DigestBot** 📰 | Topic news briefings | 24h | 24h | 24h |
| **MentionAlert** 🔔 | Brand/keyword mentions | 24h | 6h | 1h |
| **RankWatch** 📈 | Google keyword rankings | 7d | 7d | 7d |
| **JobRadar** 💼 | Job board listings | 24h | 6h | 1h |
| **LeaseGuard** 🏠 | Rental listings | 24h | 1h | 15min |

---

## 💳 Plans

| Plan | Price | Monitors | Check Interval | Modules |
|---|---|---|---|---|
| Free | $0 | 3 | Daily | All |
| Pro | $9.99/mo | 25 | Hourly | All |
| Business | $24.99/mo | Unlimited | 15 minutes | All |

---

## 🔧 Development

### Backend tests
```bash
cd backend
source venv/bin/activate
pip install pytest httpx
pytest
```

### Frontend linting
```bash
cd frontend
npm run lint
```

### Database migrations
The database tables are created automatically on startup via SQLAlchemy's `create_all()`. For production schema migrations, use Alembic:

```bash
cd backend
alembic init alembic
alembic revision --autogenerate -m "initial"
alembic upgrade head
```

---

## 🛠️ Tech Stack

**Backend:** FastAPI · SQLAlchemy · APScheduler · python-jose · passlib · httpx · Stripe · aiosmtplib · python-telegram-bot · BeautifulSoup4

**Frontend:** Next.js 14 · React 18 · Tailwind CSS · Zustand · Axios · Lucide React · Stripe.js

**AI Engine:** OpenClaw (self-hosted)

**Infrastructure:** Nginx · systemd · Ubuntu VPS

---

## 📝 License

MIT
