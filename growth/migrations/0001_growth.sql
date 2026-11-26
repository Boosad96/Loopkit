CREATE TABLE opportunities (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  original_url TEXT NOT NULL UNIQUE,
  fingerprint TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  problem TEXT NOT NULL,
  tool_slug TEXT NOT NULL,
  score INTEGER NOT NULL CHECK(score BETWEEN 0 AND 100),
  draft TEXT NOT NULL,
  published_at INTEGER NOT NULL,
  discovered_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','approved','dismissed','archived')),
  reviewed_by TEXT,
  reviewed_at INTEGER
);
CREATE INDEX opportunities_recent ON opportunities(published_at DESC, id DESC);
CREATE INDEX opportunities_review ON opportunities(status, published_at DESC, id DESC, score);

CREATE TABLE opportunity_totals (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  total INTEGER NOT NULL DEFAULT 0,
  pending INTEGER NOT NULL DEFAULT 0
);
INSERT INTO opportunity_totals(id) VALUES (1);
CREATE TRIGGER opportunity_insert AFTER INSERT ON opportunities BEGIN
  UPDATE opportunity_totals SET total=total+1, pending=pending+(NEW.status='new') WHERE id=1;
END;
CREATE TRIGGER opportunity_review AFTER UPDATE OF status ON opportunities BEGIN
  UPDATE opportunity_totals SET pending=pending+(NEW.status='new')-(OLD.status='new') WHERE id=1;
END;
CREATE TRIGGER opportunity_delete AFTER DELETE ON opportunities BEGIN
  UPDATE opportunity_totals SET total=total-1, pending=pending-(OLD.status='new') WHERE id=1;
END;

CREATE TABLE scans (
  id TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  state TEXT NOT NULL CHECK(state IN ('running','success','partial','skipped','error')),
  trigger TEXT NOT NULL,
  source TEXT,
  found INTEGER NOT NULL DEFAULT 0,
  inserted INTEGER NOT NULL DEFAULT 0,
  message TEXT
);
CREATE INDEX scans_recent ON scans(started_at DESC);
CREATE INDEX scans_success ON scans(state, finished_at DESC);

CREATE TABLE engine (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  lease_owner TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  launched_at INTEGER,
  next_job INTEGER NOT NULL DEFAULT 0,
  manual_day TEXT,
  manual_count INTEGER NOT NULL DEFAULT 0
);
INSERT INTO engine(id) VALUES (1);

CREATE TABLE source_health (
  source TEXT PRIMARY KEY,
  checked_at INTEGER NOT NULL,
  state TEXT NOT NULL,
  message TEXT,
  cooldown_until INTEGER NOT NULL DEFAULT 0,
  remaining INTEGER
);

CREATE TABLE limits (
  bucket TEXT NOT NULL,
  window TEXT NOT NULL,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY(bucket, window)
);
CREATE INDEX limits_expiry ON limits(expires_at);

CREATE TABLE reports (
  period INTEGER PRIMARY KEY,
  created_at INTEGER NOT NULL,
  payload TEXT NOT NULL
);

CREATE TABLE search_cache (
  key TEXT PRIMARY KEY,
  etag TEXT,
  checked_at INTEGER NOT NULL,
  next_page TEXT
);
CREATE INDEX search_cache_expiry ON search_cache(checked_at);
