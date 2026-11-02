-- Optional browser-reported architecture; no fingerprint or exact-model identifier.
ALTER TABLE visitor_sessions ADD COLUMN cpu_architecture TEXT NOT NULL DEFAULT '';
