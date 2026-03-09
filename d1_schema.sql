-- ============================================================
-- ARGUS by googleadsagent.ai
-- Cloudflare D1 Schema (SQLite)
-- ============================================================

-- PROFILES — every analyzed account
CREATE TABLE IF NOT EXISTS profiles (
  id                TEXT PRIMARY KEY,           -- UUID
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now')),

  -- Identity
  platform          TEXT NOT NULL,              -- linkedin|reddit|instagram|x|facebook
  handle            TEXT NOT NULL,
  profile_url       TEXT NOT NULL,
  display_name      TEXT,
  bio_text          TEXT,
  profile_photo_url TEXT,

  -- Scores (0-100, lower = more suspicious)
  trust_score       INTEGER NOT NULL DEFAULT 50,
  confidence        INTEGER NOT NULL DEFAULT 0,
  image_score       INTEGER,
  text_score        INTEGER,
  behavioral_score  INTEGER,
  network_score     INTEGER,

  -- Verdict
  risk_level        TEXT NOT NULL DEFAULT 'unknown', -- low|medium|high|critical
  verdict_summary   TEXT,
  signals           TEXT DEFAULT '{}',          -- JSON signal breakdown
  raw_analysis      TEXT DEFAULT '{}',          -- Full engine output JSON

  -- Evidence (R2 keys)
  wayback_url       TEXT,
  screenshot_r2_key TEXT,
  photo_hash        TEXT,
  evidence_r2_key   TEXT,

  -- Publishing
  status            TEXT NOT NULL DEFAULT 'pending', -- pending|approved|rejected|disputed|removed
  published_at      TEXT,
  approved_by       TEXT DEFAULT 'admin',
  admin_notes       TEXT,
  slug              TEXT UNIQUE,

  -- Submission
  submitted_by      TEXT DEFAULT 'system',      -- system|extension|community|api
  submitter_email   TEXT,

  -- Model metadata
  model_version     TEXT DEFAULT '1.0.0',
  engines_run       TEXT DEFAULT '[]',           -- JSON array
  processing_ms     INTEGER,

  -- SEO
  indexed           INTEGER DEFAULT 0,           -- boolean

  UNIQUE(platform, handle)
);

-- DISPUTES — opt-out and challenge requests
CREATE TABLE IF NOT EXISTS disputes (
  id                TEXT PRIMARY KEY,
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now')),

  profile_id        TEXT NOT NULL REFERENCES profiles(id),

  claimant_name     TEXT NOT NULL,
  claimant_email    TEXT NOT NULL,

  dispute_type      TEXT NOT NULL,               -- false_positive|opt_out|data_correction
  reason            TEXT NOT NULL,
  evidence_tier     TEXT,                        -- tier1|tier2|tier3

  evidence_r2_keys  TEXT DEFAULT '[]',           -- JSON array of R2 keys
  evidence_notes    TEXT,

  status            TEXT NOT NULL DEFAULT 'pending', -- pending|approved|rejected|appealed
  resolved_at       TEXT,
  resolved_by       TEXT,
  resolution_note   TEXT
);

-- NETWORKS — coordinated account clusters
CREATE TABLE IF NOT EXISTS networks (
  id                TEXT PRIMARY KEY,
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now')),

  cluster_id        TEXT UNIQUE NOT NULL,        -- e.g. cluster-447
  name              TEXT,
  description       TEXT,

  coordination_score INTEGER NOT NULL DEFAULT 0,
  confidence         INTEGER NOT NULL DEFAULT 0,
  account_count      INTEGER NOT NULL DEFAULT 0,

  patterns          TEXT DEFAULT '[]',           -- JSON array of pattern objects
  primary_topic     TEXT,
  active_since      TEXT,
  last_active       TEXT,
  platforms         TEXT DEFAULT '[]',           -- JSON array

  status            TEXT NOT NULL DEFAULT 'pending',
  published_at      TEXT,
  slug              TEXT UNIQUE
);

-- NETWORK_MEMBERS — profiles in a network
CREATE TABLE IF NOT EXISTS network_members (
  id          TEXT PRIMARY KEY,
  network_id  TEXT NOT NULL REFERENCES networks(id),
  profile_id  TEXT NOT NULL REFERENCES profiles(id),
  added_at    TEXT DEFAULT (datetime('now')),
  confidence  INTEGER DEFAULT 0,
  UNIQUE(network_id, profile_id)
);

-- COMMUNITY_REPORTS — crowdsourced flags
CREATE TABLE IF NOT EXISTS community_reports (
  id              TEXT PRIMARY KEY,
  created_at      TEXT DEFAULT (datetime('now')),
  profile_id      TEXT NOT NULL REFERENCES profiles(id),
  reporter_ip     TEXT,
  reporter_email  TEXT,
  report_reason   TEXT,
  platform_source TEXT
);

-- SUBMISSIONS — incoming analysis queue
CREATE TABLE IF NOT EXISTS submissions (
  id              TEXT PRIMARY KEY,
  created_at      TEXT DEFAULT (datetime('now')),

  input_url       TEXT NOT NULL,
  input_type      TEXT NOT NULL,                 -- profile|post|image|audio|text
  platform        TEXT,

  submitter_email TEXT,
  submitter_ip    TEXT,
  submitted_by    TEXT DEFAULT 'community',      -- community|extension|api|admin

  status          TEXT NOT NULL DEFAULT 'queued', -- queued|processing|complete|failed
  profile_id      TEXT REFERENCES profiles(id),   -- set when analysis complete
  error_message   TEXT,
  
  -- Admin approval
  admin_status    TEXT DEFAULT 'pending',         -- pending|approved|rejected
  admin_reviewed_at TEXT,
  admin_notes     TEXT,
  notify_email    TEXT                            -- email to notify on approval
);

-- WATCHLIST — profiles being monitored
CREATE TABLE IF NOT EXISTS watchlist (
  id              TEXT PRIMARY KEY,
  created_at      TEXT DEFAULT (datetime('now')),
  profile_id      TEXT NOT NULL REFERENCES profiles(id),
  watcher_email   TEXT,
  last_checked    TEXT,
  last_score      INTEGER,
  alert_threshold INTEGER DEFAULT 40,            -- alert if score drops below this
  active          INTEGER DEFAULT 1
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_platform_handle ON profiles(platform, handle);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_risk_level ON profiles(risk_level);
CREATE INDEX IF NOT EXISTS idx_profiles_trust_score ON profiles(trust_score);
CREATE INDEX IF NOT EXISTS idx_disputes_profile_id ON disputes(profile_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_admin_status ON submissions(admin_status);
CREATE INDEX IF NOT EXISTS idx_network_members_network ON network_members(network_id);
CREATE INDEX IF NOT EXISTS idx_community_reports_profile ON community_reports(profile_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_active ON watchlist(active);
