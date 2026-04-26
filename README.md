# Tennis Hub

A player-centric tournament aggregator for tennis in Brazil. Consolidates calendars, registration rules, and eligibility information from multiple official sources into a single mobile app.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [Running Tests](#running-tests)
- [Production Deployment](#production-deployment)
- [Mobile Builds](#mobile-builds)

---

## Overview

Tennis Hub solves the fragmentation problem in the Brazilian tennis tournament ecosystem. Players currently need to visit multiple federation websites, read PDF regulations, and manually track registration deadlines. This platform aggregates all of that into one place.

**Core features:**

- **Tournament discovery** — unified calendar from multiple official sources (national and state federations, international circuits)
- **Eligibility engine** — tells players exactly which categories they can enter based on age, class, and circuit rules
- **Watchlist & alerts** — save tournaments and receive deadline notifications via push and in-app
- **Subscription plans** — Free / Pro / Elite tiers with feature gating
- **Admin panel** — data curation, source management, and ingestion monitoring

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Mobile App (Expo)                 │
│           React Native · TypeScript · EAS           │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS / REST
┌──────────────────────▼──────────────────────────────┐
│                  Django REST API                    │
│         Python · DRF · Celery · PostgreSQL          │
│                                                     │
│  ┌────────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ Ingestion  │  │ Billing  │  │  Eligibility   │  │
│  │  Pipeline  │  │          │  │    Engine      │  │
│  └────────────┘  └──────────┘  └────────────────┘  │
└──────────────────────┬──────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   PostgreSQL        Redis       Cloudinary
```

**Ingestion pipeline:**

```
Scheduler (Celery Beat)
  → fetch_source()       — HTTP request to official source
  → parse_normalize()    — extract structured tournament data
  → dedup_fingerprint()  — cross-source deduplication
  → upsert_edition()     — persist or update
  → diff_detect()        — detect field changes
  → dispatch_alerts()    — notify affected watchers
```

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Framework | Django + Django REST Framework |
| Database | PostgreSQL |
| Cache / Queue | Redis |
| Task runner | Celery + Celery Beat |
| Auth | JWT (SimpleJWT) with refresh rotation and blacklist |
| Email | Resend API |
| Storage | Cloudinary |
| Payments | Asaas |
| Error tracking | Sentry |
| Web server | Gunicorn (gthread workers) |

### Mobile
| Layer | Technology |
|---|---|
| Framework | React Native (Expo) |
| Language | TypeScript |
| Navigation | React Navigation v6 |
| Build | EAS Build |
| Token storage | expo-secure-store (Keychain / EncryptedSharedPreferences) |

### Infrastructure
| Service | Provider |
|---|---|
| Hosting | Railway |
| CI/CD | GitHub → Railway (auto-deploy on push to master) |
| Mobile builds | Expo EAS |

---

## Project Structure

```
tennis_hub/
├── backend/                    # Django API
│   ├── apps/
│   │   ├── accounts/           # Auth, OTP, user management, LGPD
│   │   ├── alerts/             # Push/in-app notification system
│   │   ├── admin_panel/        # Internal admin API
│   │   ├── audit/              # Audit logging
│   │   ├── billing/            # Subscriptions, payments, webhooks
│   │   ├── eligibility/        # Category compatibility engine
│   │   ├── ingestion/          # Data pipeline + connectors
│   │   │   └── connectors/     # Per-source scrapers/APIs
│   │   ├── marketplace/        # Merchant offers (schema only)
│   │   ├── players/            # Player profiles + category taxonomy
│   │   ├── registrations/      # Tournament registration tracking
│   │   ├── sources/            # Data source registry
│   │   ├── tournaments/        # Tournament and Edition models
│   │   └── watchlist/          # Watchlist + results
│   ├── config/
│   │   ├── settings.py         # All settings (environment-driven)
│   │   ├── urls.py
│   │   ├── celery.py
│   │   └── email_backend.py    # Resend integration
│   ├── nixpacks.toml           # Build + startup config
│   ├── railway.json            # Backend service config
│   ├── railway.worker.json     # Worker+beat service config
│   └── requirements.txt
│
├── mobile/                     # Expo React Native app
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── contexts/           # Auth, Theme contexts
│   │   ├── hooks/              # Custom hooks
│   │   ├── navigation/         # Stack + Tab navigators
│   │   ├── screens/
│   │   │   ├── app/            # Authenticated screens
│   │   │   └── auth/           # Login, Register, ForgotPassword
│   │   ├── services/           # API client + feature services
│   │   ├── types/              # TypeScript interfaces
│   │   └── utils/              # Formatters, helpers
│   ├── app.json                # Expo config
│   └── eas.json                # EAS build profiles
│
└── README.md
```

---

## Local Development

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Redis 7+

### Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate       # Linux/macOS
# venv\Scripts\activate        # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your local values

# Run migrations and seed initial data
python manage.py migrate
python manage.py seed_plans
python manage.py seed_sources

# Start development server
python manage.py runserver

# Start Celery worker (separate terminal)
celery -A config worker --beat --loglevel=info --concurrency=2
```

### Mobile

```bash
cd mobile

# Install dependencies
npm install

# Start Expo development server
npx expo start --tunnel

# Scan the QR code with Expo Go app on your device
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the required values.

```bash
# Django core
SECRET_KEY=          # Minimum 50 characters
DEBUG=False
ALLOWED_HOSTS=       # Comma-separated hostnames

# Database (PostgreSQL required)
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Cache and message broker
REDIS_URL=redis://default:password@host:6379

# Email delivery
RESEND_API_KEY=      # Required in production
DEFAULT_FROM_EMAIL=no-reply@yourdomain.com

# File storage
CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name

# Push notifications (VAPID keys)
VAPID_PRIVATE_KEY=
VAPID_PUBLIC_KEY=
VAPID_CLAIMS_EMAIL=

# Payments
ASAAS_API_KEY=
ASAAS_ENVIRONMENT=sandbox   # sandbox | production
ASAAS_WEBHOOK_TOKEN=

# Error tracking
SENTRY_DSN=
SENTRY_ENVIRONMENT=production

# CORS and trusted origins
CORS_ALLOWED_ORIGINS=https://yourdomain.com
CSRF_TRUSTED_ORIGINS=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com
```

---

## Running Tests

```bash
cd backend

# Run all tests
python manage.py test --keepdb

# Run specific app
python manage.py test apps.billing
python manage.py test apps.accounts
python manage.py test apps.eligibility

# Verbose output
python manage.py test --verbosity=2 --keepdb
```

---

## Production Deployment

Deployed on Railway with 5 services: `backend`, `worker-beat`, `frontend`, `postgres`, `redis`.

### Deploy

1. Push to the `master` branch
2. Railway auto-deploys all connected services
3. Startup sequence: `migrate → seed_plans → seed_sources → gunicorn`

### Scheduled tasks (Celery Beat)

| Task | Schedule | Purpose |
|---|---|---|
| Run all active sources | Hourly | Fetch tournaments from enabled connectors |
| Dispatch deadline alerts | Hourly at :15 | Send D-7/D-2/D-0 notifications |
| Detect tournament changes | Every 2h at :30 | Detect and broadcast field changes |
| Cleanup old logs | Daily at 03:00 UTC | Remove audit logs older than 180 days |

---

## Mobile Builds

```bash
cd mobile

# Android APK (internal distribution)
eas build --profile preview --platform android

# iOS (requires Apple Developer account)
eas build --profile preview --platform ios

# Production builds
eas build --profile production --platform all
```

| Profile | Android | iOS | API |
|---|---|---|---|
| `development` | Dev client | Simulator | localhost:8000 |
| `preview` | APK | Simulator | Production API |
| `production` | App Bundle | Archive | Production API |

---

## Adding a Data Source Connector

1. Create `backend/apps/ingestion/connectors/mysource.py`
2. Implement `BaseConnector.extract()` yielding normalized dicts
3. Decorate with `@register_connector` and set a unique `key`
4. Import in `connectors/__init__.py`
5. Add a `DataSource` record via `seed_sources.py` or the admin panel

---

## License

Private — all rights reserved.
