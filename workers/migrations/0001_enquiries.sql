CREATE TABLE IF NOT EXISTS enquiries (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  request_id TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('general','activity','holiday','visa','contact')),
  name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL,
  product TEXT NOT NULL DEFAULT '',
  page TEXT NOT NULL,
  details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','follow_up','booked','closed')),
  notes TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL DEFAULT '',
  notification_status TEXT NOT NULL DEFAULT 'not_configured'
) STRICT;
CREATE INDEX IF NOT EXISTS enquiries_created ON enquiries(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS enquiries_status_created ON enquiries(status, created_at DESC, id DESC);
CREATE TABLE IF NOT EXISTS enquiry_rate_limits (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS enquiry_rate_expiry ON enquiry_rate_limits(expires_at);
