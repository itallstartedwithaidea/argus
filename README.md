# 👁️ ARGUS by googleadsagent.ai

[English](README.md) | [Français](README.fr.md) | [Español](README.es.md) | [中文](README.zh.md) | [Nederlands](README.nl.md) | [Русский](README.ru.md) | [한국어](README.ko.md)

### Algorithmic Authenticity Analysis Platform

**VirusTotal for fake social media profiles & posts — free, open source, Cloudflare-native**

🔗 **Live**: [googleadsagent.ai/tools/argus](https://googleadsagent.ai/tools/argus/)
📊 **Reports**: [googleadsagent.ai/tools/argus/reports](https://googleadsagent.ai/tools/argus/reports)

---

## What It Does

ARGUS analyzes any social media profile, post, or engagement pattern across LinkedIn, Reddit, Instagram, X, Facebook, YouTube, Quora, TikTok, and Pinterest. It returns a **weighted trust score (0–100)** with full reasoning, detection engine breakdowns, commenter analysis, and penalty explanations.

Flagged content gets a public landing page indexed by Google with SEO-friendly URLs. All analysis is framed as algorithmic opinion — not a verdict. Profile owners can dispute at any time.

**Every page that goes live has been reviewed and approved by a human.**

---

## Key Features

- **4 Detection Engines**: Image, Text, Behavioral, Network — each scored independently
- **Commenter Analysis**: Every visible commenter analyzed for bot patterns, coordination, authenticity
- **Weighted Scoring Algorithm**: `Network(35%) + Behavioral(30%) + Image(20%) + Text(15%) - Penalties`
- **Penalty System**: Automatic deductions for unverifiable data, bot patterns, fake engagement, etc.
- **Private Profile Mode**: Paste content + screenshots for profiles ARGUS can't scrape
- **Claude AI Analysis**: Powered by Anthropic Claude for deep content analysis
- **Dynamic Public Reports**: Wiki-style pages generated on-the-fly via Cloudflare Workers
- **SEO-Friendly URLs**: `/report/reddit-landing-page-navigation-conversion-85`
- **Admin Dashboard**: OAuth-protected with Chart.js analytics, grouping, dispute resolution
- **Evidence Upload**: R2 storage for dispute evidence files
- **Email Notifications**: Detailed analysis results sent to submitters via Resend
- **Dynamic Sitemap**: Auto-generated from published reports
- **Browser Extension**: Chrome extension for quick analysis

---

## Architecture

```
Community Submission Form / Private Mode / Browser Extension
    ↓
Cloudflare Pages Function API (/api/argus)
    ├── Submit → KV queue + rate limiting
    ├── Analyze → Claude AI + weighted scoring algorithm
    ├── Approve → SEO slug generation + email + sitemap
    └── Dispute → R2 evidence upload + resolution workflow
    ↓
Admin Dashboard (OAuth-protected)
    ├── Queue management with full detail view
    ├── Analytics: Chart.js charts (platform, scores, risk, timeline)
    ├── Grouping: Repeat posters, submitter activity tracking
    └── Score breakdown: composite, penalties, Claude raw vs final
    ↓
Dynamic Public Report Pages (Cloudflare Workers)
    ├── Trust score with SVG gauge
    ├── 4 engine breakdowns with signal tables
    ├── Commenter analysis table
    ├── Bot/AI/Fake engagement detection cards
    ├── Poster profile section
    ├── Score calculation transparency
    └── Full SEO: Schema.org, Open Graph, breadcrumbs
    ↓
Google Indexing (via sitemap + robots.txt)
```

---

## Scoring Algorithm

Unlike generic AI scoring, ARGUS uses a **deterministic weighted composite**:

```
Final Score = Weighted Composite - Penalties

Weighted Composite:
  Network Engine  × 0.35
  Behavioral      × 0.30
  Image           × 0.20
  Text            × 0.15

Penalties (applied automatically):
  Account age unverifiable:      -8
  No visible posting history:    -10
  Private submission:            -15
  Page couldn't be fetched:      -12
  Very limited content:          -10
  Bot activity detected:         -up to 20
  AI-generated content:          -up to 15
  Fake engagement detected:      -up to 20
  >50% suspicious comments:      -15
  High followers + few posts:    -18
  New account + high engagement: -20
```

---

## Cloudflare Services Used

| Service     | Purpose                              | Free Tier            |
|-------------|--------------------------------------|----------------------|
| **Pages**   | Static pages + Functions API         | Unlimited            |
| **KV**      | Submissions, disputes, config cache  | 100K reads/day       |
| **R2**      | Evidence vault (dispute file uploads)| 10GB + 10M ops/month |
| **Workers** | Dynamic report generation, sitemap   | 100K req/day         |

**Monthly cost: ~$0–$5**

---

## Repository Structure

```
argus/
├── functions/
│   ├── api/
│   │   ├── argus.js              ← Main API: submit, analyze, approve, reject, dispute, stats
│   │   └── argus-sitemap.js      ← Dynamic XML sitemap from published reports
│   └── tools/argus/
│       ├── admin.js              ← Admin page security headers middleware
│       ├── reports.js            ← Public reports directory (dynamic listing)
│       └── report/[[id]].js      ← Dynamic public report pages (slug + ID routing)
├── pages/argus/
│   ├── index.html                ← Landing page
│   ├── app.html                  ← Submission form (URL + private mode)
│   ├── admin.html                ← Admin dashboard (OAuth + Chart.js analytics)
│   ├── dispute.html              ← Dispute form (with R2 file upload)
│   └── docs.html                 ← Documentation
├── extension/
│   └── popup.html                ← Chrome extension popup
├── analyze.js                    ← Original detection pipeline (reference)
├── content_script.js             ← Chrome extension content script
├── d1_schema.sql                 ← Database schema (reference)
├── index.js                      ← Original Worker API (reference)
├── manifest.json                 ← Chrome MV3 manifest
├── page.js                       ← Original admin page (reference)
├── wrangler.toml                 ← Cloudflare bindings config
└── README.md
```

---

## Setup (Integrated with googleadsagent.ai)

ARGUS runs as part of the [googleadsagent.ai](https://googleadsagent.ai) Cloudflare Pages deployment.

### Prerequisites

```bash
npm install -g wrangler
wrangler login
```

### Required KV Namespaces

- `SESSIONS` — submissions, disputes, config, rate limiting
- `USERS` — OAuth session storage

### Required R2 Bucket

- `FILES` — evidence file uploads for disputes

### Required Secrets

```bash
wrangler pages secret put ANTHROPIC_API_KEY    # Claude API key (or use universal localStorage)
wrangler pages secret put RESEND_API_KEY       # Email notifications
```

### Required OAuth

Google OAuth configured via `/api/auth` for admin dashboard access.

---

## API Endpoints

### Public

| Method | Endpoint | Action | Description |
|--------|----------|--------|-------------|
| POST | `/api/argus?action=submit` | submit | Submit URL or private content for analysis |
| POST | `/api/argus?action=dispute` | dispute | File a dispute with evidence |
| POST | `/api/argus?action=upload` | upload | Upload evidence files to R2 |
| GET | `/api/argus?action=submission&id=X` | submission | Get published submission |
| GET | `/api/argus?action=published` | published | List all published reports |
| GET | `/api/argus-sitemap` | — | Dynamic XML sitemap |

### Admin (OAuth required)

| Method | Endpoint | Action | Description |
|--------|----------|--------|-------------|
| POST | `/api/argus?action=analyze` | analyze | Run Claude analysis on submission |
| POST | `/api/argus?action=approve` | approve | Publish with SEO slug + email |
| POST | `/api/argus?action=reject` | reject | Reject submission |
| POST | `/api/argus?action=dispute_resolve` | dispute_resolve | Resolve dispute + notify claimant |
| GET | `/api/argus?action=queue` | queue | Get all submissions |
| GET | `/api/argus?action=disputes` | disputes | Get all disputes |
| GET | `/api/argus?action=stats` | stats | Analytics data (charts, grouping) |

---

## Detection Engines

| Engine | Analyzes | Key Signals |
|--------|----------|-------------|
| **Image** | Profile pics, post images | GAN artifacts, stock photos, C2PA provenance, EXIF anomalies |
| **Text** | Bio, posts, comments | AI-generated text, stylometric consistency, templated language |
| **Behavioral** | Activity patterns | Account age vs activity, posting frequency, engagement ratios |
| **Network** | Connections, interactions | Follower ratios, coordination indicators, bot network signatures |

Additional analysis modules:
- **Bot Detection** — confidence score with specific indicators
- **AI Content Detection** — GPT/Claude pattern recognition
- **Fake Engagement** — like/comment/share manipulation detection
- **Comments Analysis** — individual commenter authenticity assessment
- **Poster Profile** — subject account assessment and history notes

---

## Legal Architecture

Every page is protected by:

1. **"Algorithmic analysis, not a verdict"** — displayed on every page
2. **Full methodology disclosure** — open source, publicly auditable
3. **Transparent scoring** — weighted composite with penalties shown
4. **Prominent dispute mechanism** — above the fold, not buried
5. **Human editorial review** — admin approves every published page

---

## Dispute / Opt-Out Process

Anyone can submit a dispute at `/tools/argus/dispute` with file uploads (R2).

| Tier | Evidence | Outcome |
|------|----------|---------|
| **Tier 1** | Government ID + platform verification | Auto-approve removal |
| **Tier 2** | Cross-platform presence, employer confirmation | Human review |
| **Tier 3** | "I am real" with no evidence | Dispute denied |

Resolved disputes: claimant is emailed, linked submission is flagged, page updated.

---

## Live URLs

- **Landing**: [googleadsagent.ai/tools/argus](https://googleadsagent.ai/tools/argus/)
- **Submit**: [googleadsagent.ai/tools/argus/app](https://googleadsagent.ai/tools/argus/app)
- **Reports**: [googleadsagent.ai/tools/argus/reports](https://googleadsagent.ai/tools/argus/reports)
- **Dispute**: [googleadsagent.ai/tools/argus/dispute](https://googleadsagent.ai/tools/argus/dispute)
- **Docs**: [googleadsagent.ai/tools/argus/docs](https://googleadsagent.ai/tools/argus/docs)
- **Sitemap**: [googleadsagent.ai/api/argus-sitemap](https://googleadsagent.ai/api/argus-sitemap)

---

## MIT License

Open source. Community maintained. PRs welcome.

**github.com/itallstartedwithaidea/argus**
