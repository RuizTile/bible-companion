// SQLite data layer using Node's built-in node:sqlite (Node 22.5+).
// No third-party driver, nothing to compile. Local file at db/companion.db.
// The API boundary here is what lets the app branch off to a hosted SQLite
// (Cloudflare D1 / Turso) later without touching the frontend. See docs/PRD.md §8.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DB_PATH = join(ROOT, "db", "companion.db");
const SCHEMA_PATH = join(ROOT, "db", "schema.sql");

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec(readFileSync(SCHEMA_PATH, "utf8"));

// Canonical display order (KJV+Apocrypha): 39 OT, 27 NT, then the Apocrypha/
// deuterocanon. Any code not listed sorts to the end, preserving insert order.
const BOOK_ORDER = [
  "GEN","EXO","LEV","NUM","DEU","JOS","JDG","RUT","1SA","2SA","1KI","2KI",
  "1CH","2CH","EZR","NEH","EST","JOB","PSA","PRO","ECC","SNG","ISA","JER",
  "LAM","EZK","DAN","HOS","JOL","AMO","OBA","JON","MIC","NAM","HAB","ZEP",
  "HAG","ZEC","MAL",
  "MAT","MRK","LUK","JHN","ACT","ROM","1CO","2CO","GAL","EPH","PHP","COL",
  "1TH","2TH","1TI","2TI","TIT","PHM","HEB","JAS","1PE","2PE","1JN","2JN",
  "3JN","JUD","REV",
  "1ES","2ES","TOB","JDT","ESG","WIS","SIR","BAR","LJE","S3Y","SUS","BEL",
  "MAN","1MA","2MA",
];
const orderIndex = (code) => {
  const i = BOOK_ORDER.indexOf(code);
  return i === -1 ? BOOK_ORDER.length : i;
};

function rowToChapter(row) {
  if (!row) return null;
  return {
    ref: row.ref,
    book: row.book,
    chapter: row.chapter,
    canon: row.canon,
    kjvNumbering: row.kjv_numbering,
    verses: JSON.parse(row.verses),
    summary: row.summary,
    takeaways: JSON.parse(row.takeaways),
    crossRefs: JSON.parse(row.cross_refs),
    interpretationNotes: JSON.parse(row.interpretation_notes),
    authoring: JSON.parse(row.authoring),
  };
}

const stmtGet = db.prepare("SELECT * FROM chapters WHERE ref = ?");
export function getChapter(ref) {
  return rowToChapter(stmtGet.get(ref));
}

const stmtBooks = db.prepare(
  "SELECT book, COUNT(*) AS chapters, MIN(canon) AS canon, MIN(ref) AS ref FROM chapters GROUP BY book"
);
export function listBooks() {
  return stmtBooks
    .all()
    .map((r) => ({ book: r.book, chapters: r.chapters, canon: r.canon, code: r.ref.split(".")[0] }))
    .sort((a, b) => orderIndex(a.code) - orderIndex(b.code));
}

const stmtChaptersOf = db.prepare(
  "SELECT ref, chapter FROM chapters WHERE book = ? ORDER BY chapter"
);
export function listChapters(book) {
  return stmtChaptersOf.all(book);
}

// Home-page index: every chapter with a coarse status, grouped by book in
// insertion order. status = authored | placeholder | text.
const stmtIndex = db.prepare(`
  SELECT ref, book, chapter, canon,
         json_extract(authoring, '$.status') AS astatus,
         CASE WHEN summary IS NOT NULL AND summary <> '' THEN 1 ELSE 0 END AS has_summary
  FROM chapters
  ORDER BY rowid, chapter
`);
export function getIndex() {
  const rows = stmtIndex.all();
  const byBook = new Map();
  for (const r of rows) {
    const code = r.ref.split(".")[0];
    let status = "text";
    if (r.astatus === "placeholder") status = "placeholder";
    else if (r.has_summary || ["draft", "self-reviewed", "cleric-reviewed"].includes(r.astatus)) status = "authored";

    if (!byBook.has(r.book)) {
      byBook.set(r.book, { code, book: r.book, canon: r.canon, chapters: [] });
    }
    byBook.get(r.book).chapters.push({ ref: r.ref, chapter: r.chapter, status });
  }
  const books = [...byBook.values()]
    .map((b) => {
      b.chapters.sort((a, c) => a.chapter - c.chapter);
      return {
        ...b,
        total: b.chapters.length,
        authored: b.chapters.filter((c) => c.status === "authored").length,
      };
    })
    .sort((a, b) => orderIndex(a.code) - orderIndex(b.code));
  return books;
}

// Companion-only upsert used by the authoring merge. Writes summary/takeaways/
// cross_refs/interpretation_notes/authoring; PRESERVES verses + book metadata.
const stmtUpsertCompanion = db.prepare(`
  INSERT INTO chapters (ref, book, chapter, canon, summary, takeaways, cross_refs, interpretation_notes, authoring)
  VALUES (@ref, @book, @chapter, @canon, @summary, @takeaways, @cross_refs, @interpretation_notes, @authoring)
  ON CONFLICT(ref) DO UPDATE SET
    summary=excluded.summary, takeaways=excluded.takeaways, cross_refs=excluded.cross_refs,
    interpretation_notes=excluded.interpretation_notes, authoring=excluded.authoring
`);
export function upsertCompanion(c) {
  stmtUpsertCompanion.run({
    ref: c.ref,
    book: c.book ?? c.ref.split(".")[0],
    chapter: c.chapter ?? Number(c.ref.split(".")[1]),
    canon: c.canon ?? "protocanonical",
    summary: c.summary ?? null,
    takeaways: JSON.stringify(c.takeaways ?? []),
    cross_refs: JSON.stringify(c.crossRefs ?? []),
    interpretation_notes: JSON.stringify(c.interpretationNotes ?? []),
    authoring: JSON.stringify(c.authoring ?? {}),
  });
}

const stmtUpsert = db.prepare(`
  INSERT INTO chapters
    (ref, book, chapter, canon, kjv_numbering, verses, summary, takeaways, cross_refs, interpretation_notes, authoring)
  VALUES
    (@ref, @book, @chapter, @canon, @kjv_numbering, @verses, @summary, @takeaways, @cross_refs, @interpretation_notes, @authoring)
  ON CONFLICT(ref) DO UPDATE SET
    book=excluded.book, chapter=excluded.chapter, canon=excluded.canon,
    kjv_numbering=excluded.kjv_numbering, verses=excluded.verses, summary=excluded.summary,
    takeaways=excluded.takeaways, cross_refs=excluded.cross_refs,
    interpretation_notes=excluded.interpretation_notes, authoring=excluded.authoring
`);

// node:sqlite binds bare object keys to @-named parameters (allowBareNamedParameters
// defaults to true). null must be passed explicitly, not undefined.
// Text-only upsert used by the ingest pipeline. Writes verses + book metadata
// but PRESERVES any existing companion content (summary/takeaways/cross_refs/
// interpretation_notes/authoring) on a row that already exists — so re-ingesting
// text never clobbers authored work.
const stmtUpsertText = db.prepare(`
  INSERT INTO chapters (ref, book, chapter, canon, kjv_numbering, verses)
  VALUES (@ref, @book, @chapter, @canon, @kjv_numbering, @verses)
  ON CONFLICT(ref) DO UPDATE SET
    book=excluded.book, chapter=excluded.chapter, canon=excluded.canon,
    kjv_numbering=excluded.kjv_numbering, verses=excluded.verses
`);

export function upsertChapterText(c) {
  stmtUpsertText.run({
    ref: c.ref,
    book: c.book,
    chapter: c.chapter,
    canon: c.canon ?? "protocanonical",
    kjv_numbering: c.kjvNumbering ?? c.ref,
    verses: JSON.stringify(c.verses ?? []),
  });
}

export function upsertChapter(c) {
  stmtUpsert.run({
    ref: c.ref,
    book: c.book,
    chapter: c.chapter,
    canon: c.canon ?? "protocanonical",
    kjv_numbering: c.kjvNumbering ?? c.ref,
    verses: JSON.stringify(c.verses ?? []),
    summary: c.summary ?? null,
    takeaways: JSON.stringify(c.takeaways ?? []),
    cross_refs: JSON.stringify(c.crossRefs ?? []),
    interpretation_notes: JSON.stringify(c.interpretationNotes ?? []),
    authoring: JSON.stringify(c.authoring ?? {}),
  });
}

export default db;
