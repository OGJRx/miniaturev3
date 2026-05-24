CREATE TABLE IF NOT EXISTS obd_codes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT    NOT NULL UNIQUE,
  description TEXT    NOT NULL,
  category    TEXT    NOT NULL DEFAULT 'General',
  subcategory TEXT    DEFAULT '',
  severity    TEXT    NOT NULL DEFAULT 'Low',
  raw_hex     TEXT    DEFAULT '',
  raw_decimal TEXT    DEFAULT '',
  sources_available TEXT DEFAULT '',
  created_at  TEXT    DEFAULT (datetime('now'))
);

CREATE VIRTUAL TABLE IF NOT EXISTS obd_codes_fts USING fts5(
  code, description, category, subcategory, content=obd_codes, content_rowid=id
);

CREATE INDEX IF NOT EXISTS idx_obd_category ON obd_codes(category);
CREATE INDEX IF NOT EXISTS idx_obd_severity ON obd_codes(severity);
CREATE INDEX IF NOT EXISTS idx_obd_code ON obd_codes(code);
