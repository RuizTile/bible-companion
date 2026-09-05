-- One row per chapter. JSON-typed fields are stored as TEXT (SQLite has no
-- array/object type) and parsed back in server/db.js. Mirrors PRD §4.
CREATE TABLE IF NOT EXISTS chapters (
  ref                   TEXT PRIMARY KEY,          -- canonical id, e.g. "MAT.16"
  book                  TEXT NOT NULL,
  chapter               INTEGER NOT NULL,
  canon                 TEXT NOT NULL DEFAULT 'protocanonical', -- protocanonical | deuterocanonical | kjv-apocrypha-only
  kjv_numbering         TEXT,                       -- reconcile KJV vs Catholic numbering
  verses                TEXT NOT NULL DEFAULT '[]',  -- JSON: [{ "n": int, "text": str }]
  summary               TEXT,
  takeaways             TEXT NOT NULL DEFAULT '[]',  -- JSON: [str]
  cross_refs            TEXT NOT NULL DEFAULT '[]',  -- JSON: [{ target, label, why, sources[], tradition }]
  interpretation_notes  TEXT NOT NULL DEFAULT '[]',  -- JSON: [{ claim, tradition, sources[], counterpoint }]
  topics                TEXT NOT NULL DEFAULT '[]',  -- JSON: [str] controlled-vocabulary tags
  authoring             TEXT NOT NULL DEFAULT '{}'   -- JSON: { model, generatedAt, reviewedBy, status }
);

CREATE INDEX IF NOT EXISTS idx_chapters_book ON chapters(book, chapter);
