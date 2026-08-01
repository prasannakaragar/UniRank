# UniRank College Scraper

A standalone, production-grade service that crawls Indian engineering college websites and extracts structured placement/admissions/academics data into MongoDB.

> **Phase 1 scope:** 15-20 sample colleges, Playwright crawler, Gemini LLM extraction, BullMQ job queue, admin review dashboard.

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | ≥ 18 |
| Docker + Docker Compose | any recent |
| MongoDB | shared with the main `backend/` |

---

## First-time setup

```bash
# 1. Install dependencies
cd scraper/
npm install

# 2. Install the Playwright browser (Chromium only)
npm run install:browser

# 3. Copy and fill in environment variables
cp .env.example .env
#    → Set MONGODB_URI (same as backend)
#    → Set GEMINI_API_KEY
#    → Set JWT_SECRET (same as backend, for admin dashboard auth)

# 4. Start Redis (required for BullMQ job queue)
docker compose up -d redis

# Verify Redis is healthy:
docker compose ps   # should show "healthy"
```

---

## Running the scraper

### Option A — single-college test (recommended first)
```bash
# Crawl one college end-to-end: crawl → extract → validate → upsert
node src/scripts/runOnce.js --college "IIT Bombay" --categories placements,admissions

# With verbose output:
node src/scripts/runOnce.js --college "VIT Vellore" --categories placements --verbose
```

### Option B — full worker pool (Phase 1+)
```bash
npm run dev   # starts BullMQ workers and enqueues all configured colleges
```

---

## Admin review dashboard

```bash
# Start the admin dashboard (separate process)
node src/admin/server.js

# Open in browser:
open http://localhost:5001
```

Auth: uses the same JWT token from the main UniRank backend. Log in at the main app, copy the token from localStorage, paste it when prompted in the dashboard.

---

## Architecture overview

```
URL/Sitemap Discovery
    ↓
BullMQ Job Queue (Redis) ──→ Dead-letter queue on N failures
    ↓ (Playwright worker)
Raw HTML/PDF snapshot ──→ scraper/data/snapshots/  (Phase 1 local FS)
    ↓
LLM Extraction (Gemini 1.5 Flash, JSON mode)
    ↓
Zod Schema Validation
    ↓
Confidence score < 0.70 → Admin review queue
Confidence score ≥ 0.70 → MongoDB upsert (verifiedByAdmin: false)
    ↓
Admin dashboard → Approve → verifiedByAdmin: true → public
```

---

## Environment variables

See [`.env.example`](.env.example) for the full list with descriptions.

---

## Folder structure

```
scraper/
├── docker-compose.yml        ← Redis only
├── package.json
├── .env.example
├── data/
│   └── snapshots/            ← raw HTML/text (git-ignored)
└── src/
    ├── index.js              ← entry point
    ├── config/
    │   ├── index.js          ← env config
    │   └── colleges.js       ← 15-college seed list
    ├── db/
    │   ├── connection.js     ← Mongoose connect
    │   ├── College.model.js  ← College schema (scraper-side)
    │   └── ScrapeLog.model.js
    ├── queue/
    │   ├── scrapeQueue.js    ← BullMQ queue
    │   └── workers.js        ← BullMQ worker
    ├── crawler/
    │   ├── playwrightCrawler.js
    │   └── circuitBreaker.js
    ├── storage/
    │   └── snapshotStore.js  ← abstraction (local FS → Phase 2: S3/R2)
    ├── extractor/
    │   ├── llmExtractor.js   ← Gemini structured extraction
    │   └── pdfExtractor.js   ← pdf-parse wrapper
    ├── schemas/
    │   ├── placements.schema.js
    │   ├── admissions.schema.js
    │   ├── basicInfo.schema.js
    │   ├── academics.schema.js
    │   └── index.js
    ├── pipeline/
    │   ├── scrapeJob.js      ← orchestrator
    │   └── contentHash.js    ← sha256 change detection
    ├── admin/
    │   ├── server.js
    │   ├── routes.js
    │   └── public/
    │       └── index.html
    └── scripts/
        └── runOnce.js
```
