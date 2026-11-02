-- Technical metadata for consented visitor sessions only. Old sessions stay unknown.
ALTER TABLE visitor_sessions ADD COLUMN ip_address TEXT NOT NULL DEFAULT '';
ALTER TABLE visitor_sessions ADD COLUMN browser TEXT NOT NULL DEFAULT '';
ALTER TABLE visitor_sessions ADD COLUMN browser_major TEXT NOT NULL DEFAULT '';
ALTER TABLE visitor_sessions ADD COLUMN operating_system TEXT NOT NULL DEFAULT '';
ALTER TABLE visitor_sessions ADD COLUMN notice_version INTEGER NOT NULL DEFAULT 1;
