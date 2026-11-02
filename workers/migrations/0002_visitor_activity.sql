-- Visitor sessions are independent of enquiries. No contact data or lead foreign keys.
CREATE TABLE IF NOT EXISTS visitor_sessions (
  id TEXT PRIMARY KEY, first_seen TEXT NOT NULL, last_seen TEXT NOT NULL,
  entry_page TEXT NOT NULL, last_page TEXT NOT NULL, last_sequence INTEGER NOT NULL,
  last_type TEXT NOT NULL DEFAULT 'page_view', stage INTEGER NOT NULL DEFAULT 0, device TEXT NOT NULL, source TEXT NOT NULL,
  country TEXT NOT NULL, event_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS visitor_sessions_recent ON visitor_sessions(last_seen DESC, id);
CREATE TABLE IF NOT EXISTS visitor_events (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL, sequence INTEGER NOT NULL,
  occurred_at TEXT NOT NULL, received_at TEXT NOT NULL,
  type TEXT NOT NULL, page TEXT NOT NULL, seconds INTEGER NOT NULL DEFAULT 0,
  scroll INTEGER NOT NULL DEFAULT 0, UNIQUE(session_id, sequence)
);
CREATE INDEX IF NOT EXISTS visitor_events_received ON visitor_events(received_at);
CREATE TABLE IF NOT EXISTS visitor_limits (
  bucket TEXT PRIMARY KEY, requests INTEGER NOT NULL DEFAULT 0,
  events INTEGER NOT NULL DEFAULT 0, expires_at INTEGER NOT NULL
);
