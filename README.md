# 👁️ ARGUS by googleadsagent.ai
### Algorithmic Authenticity Analysis Platform
**VirusTotal for fake social media profiles — free, open source, Cloudflare-native**

---

## What It Does

ARGUS analyzes any social media profile or post across LinkedIn, Reddit, Instagram, X, and Facebook and returns a trust score (0–100) with full reasoning. Flagged profiles get a public landing page indexed by Google. All analysis is framed as algorithmic opinion — not a verdict. Profile owners can dispute at any time.

**Every page that goes live has been reviewed and approved by a human (you).**

---

## Architecture

```
Browser Extension (Chrome MV3)
    ↓ real-time badge injection
Cloudflare Worker API
    ↓ D1 database + KV cache
Analysis Queue (CF Queues)
    ↓ async processing
Detection Pipeline
    ├── Image Engine    (Hive AI + C2PA + EXIF)
    ├── Text Engine     (GPTZero + stylometrics)
    ├── Behavioral      (account age, footprint, patterns)
    └── Network Graph   (coordination detection via D1)
    ↓
Admin Approval Dashboard
    ↓ human review — you approve/reject
Public Landing Pages (Next.js on CF Pages)
    ↓
Google Indexing API (auto-triggered on publish)
    ↓
Evidence Vault (R2 — immutable archive)
```

---

## Cloudflare Services Used

| Service | Purpose | Free Tier |
|---------|---------|-----------|
| **D1** | SQLite database | 5GB + 25M reads/day |
| **R2** | Evidence vault storage | 10GB + 10M ops/month |
| **KV** | Score cache + rate limiting | 100K reads/day |
| **Workers** | API + pipeline orchestration | 100K req/day |
| **Queues** | Async analysis jobs | 1M messages/month |
| **Pages** | Next.js frontend | Unlimited |

**Monthly cost at scale: ~$0–$5**

---

## Setup

### 1. Prerequisites
```bash
npm install -g wrangler
wrangler login
```

### 2. Create Cloudflare resources
```bash
# D1 database
wrangler d1 create argus-db

# R2 buckets
wrangler r2 bucket create argus-evidence-vault
wrangler r2 bucket create argus-screenshots

# KV namespaces
wrangler kv:namespace create SCORE_CACHE
wrangler kv:namespace create RATE_LIMITER
wrangler kv:namespace create SESSION

# Queues
wrangler queues create argus-analysis-queue
wrangler queues create argus-notify-queue
```

### 3. Update wrangler.toml
Paste the IDs from step 2 into `wrangler.toml`.

### 4. Initialize database
```bash
wrangler d1 execute argus-db --file=./schema/d1_schema.sql
```

### 5. Set secrets
```bash
wrangler secret put ADMIN_SECRET_KEY      # Your private admin key
wrangler secret put HIVE_API_KEY          # hive.ai free tier
wrangler secret put GPTZERO_API_KEY       # gptzero.me free tier
wrangler secret put SEARCH_CONSOLE_KEY    # Google Search Console
wrangler secret put EMAIL_API_KEY         # Resend or Cloudflare Email
```

### 6. Deploy Worker API
```bash
wrangler deploy workers/api/index.js
```

### 7. Deploy Pages (Next.js frontend)
```bash
cd pages
npm install
npm run build
wrangler pages deploy .next
```

### 8. Load browser extension
- Open Chrome → `chrome://extensions`
- Enable Developer Mode
- Load Unpacked → select `extension/` folder

---

## Admin Dashboard

Access at: `https://argus.googleadsagent.ai/admin`

The admin dashboard is your approval queue. Nothing goes public without your sign-off.

**Approval flow:**
1. Community submits a profile URL via `/submit`
2. System runs full analysis pipeline
3. You get an email notification
4. You review the score, signals, and evidence in the dashboard
5. One click to approve (publish + Google index) or reject
6. Submitter gets notified of outcome if they provided email

---

## Legal Architecture

Every page is protected by five elements:

1. **"Algorithmic analysis, not a verdict"** — displayed on every page
2. **Full methodology disclosure** — open source, publicly auditable
3. **Confidence + false positive rate shown** — transparency in scoring
4. **Prominent dispute mechanism** — above the fold, not buried
5. **Human editorial review** — you approved every published page

Language used throughout: "flagged for review", "high risk", "scored X/100 based on these signals" — never "fake", "fraud", or "criminal".

---

## Dispute / Opt-Out Process

Anyone can submit a dispute at `/dispute`. Evidence tiers:

| Tier | Evidence | Outcome |
|------|---------|---------|
| **Tier 1** | Government ID + platform verification | Auto-approve removal |
| **Tier 2** | Cross-platform presence, employer confirmation | Human review |
| **Tier 3** | "I am real" with no evidence | Dispute denied |

Resolved disputes convert the page to a "dispute resolved" notice — retained for transparency, score removed from public display.

---

## Repository Structure

```
argus/
├── workers/
│   ├── api/index.js          ← Main Cloudflare Worker API
│   ├── pipeline/analyze.js   ← Detection engine pipeline
│   └── lib/
│       ├── utils.js          ← ID generation, rate limiting
│       ├── evidence.js       ← R2 evidence archiving
│       ├── seo.js            ← Sitemap + Google indexing
│       └── notify.js         ← Email notifications
├── pages/
│   └── app/
│       ├── admin/page.js     ← Admin approval dashboard
│       ├── profiles/[slug]/  ← Public profile pages
│       ├── submit/page.js    ← Community submission form
│       └── dispute/page.js   ← Dispute submission form
├── extension/
│   ├── manifest.json         ← Chrome MV3 manifest
│   ├── content_script.js     ← Badge injection
│   └── background.js         ← Service worker
├── schema/
│   └── d1_schema.sql         ← Cloudflare D1 schema
├── wrangler.toml             ← Full CF bindings config
└── README.md
```

---

## Detection Engines

| Engine | Tools | Detects |
|--------|-------|---------|
| **Image** | Hive AI, C2PA SDK, ExifTool | GAN faces, missing provenance, EXIF anomalies |
| **Text** | GPTZero, stylometrics | AI-generated text, agenda concentration |
| **Behavioral** | Custom scoring | Age/activity ratio, footprint, posting patterns |
| **Network** | D1 graph queries | Coordinated networks, flagged clusters |

**Score weights:** Network (35%) > Behavioral (30%) > Image (20%) > Text (15%)

---

## MIT License

Open source. Community maintained. PRs welcome.

**github.com/itallstartedwithaidea/argus**
