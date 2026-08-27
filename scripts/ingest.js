// Deterministic USFM -> SQLite ingest. NO language model, NO memory-typed text.
// Verse text is taken verbatim from the eBible KJV+Apocrypha USFM files
// (data/source/eng-kjv_usfm/); this script only strips USFM markup.
//
// Run per section, book-by-book:
//   npm run ingest -- MAT           (one book)
//   npm run ingest -- MAT MRK LUK JHN
//   npm run ingest                  (no args -> prints usage + available codes)
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { upsertChapterText } from "../server/db.js";
import { canonOf, PROTO_CHAPTERS } from "./books.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "data", "source", "eng-kjv_usfm");

// Markup pairs whose CONTENT is dropped (notes, cross-refs, alternate numbers).
const CONTENT_PAIRS = ["f", "x", "fe", "ef", "va", "ca", "vp", "fig", "rq"];
// Markers that CONTINUE verse text on their own line (poetry, indented prose).
const TEXT_MARKERS = new Set([
  "q", "q1", "q2", "q3", "q4", "qc", "qr", "qm", "qm1", "qm2",
  "m", "mi", "pi", "pi1", "pi2", "pc", "pm", "pmo", "pmc", "pmr", "nb",
  "li", "li1", "li2", "p", "b",
]);

function cleanVerse(raw) {
  let t = raw;
  for (const tag of CONTENT_PAIRS) {
    t = t.replace(new RegExp(`\\\\${tag}\\b[\\s\\S]*?\\\\${tag}\\*`, "g"), "");
  }
  t = t.replace(/\|[a-z0-9\-]+="[^"]*"/gi, ""); // char attributes (e.g. strong="G0976")
  t = t.replace(/\\\+?[a-z]+\d*\*/gi, "");        // closing char markers: \w* \add* \nd* ...
  t = t.replace(/\\\+?[a-z]+\d*/gi, "");          // opening markers: \w \add \wj \nd \q1 ...
  t = t.replace(/¶/g, "");                         // paragraph pilcrow
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

function parseBook(text) {
  const lines = text.split(/\r?\n/);
  const chapters = new Map(); // chapterNum -> [{ n, text }]
  let ch = null, vn = null, buf = [], name = null, idCode = null;

  const flush = () => {
    if (ch != null && vn != null) {
      const cleaned = cleanVerse(buf.join(" "));
      const arr = chapters.get(ch) || [];
      arr.push({ n: /^\d+$/.test(vn) ? Number(vn) : vn, text: cleaned });
      chapters.set(ch, arr);
    }
    buf = [];
  };

  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;
    let m;
    if ((m = l.match(/^\\id\s+(\S+)/))) { idCode = m[1]; continue; }
    if ((m = l.match(/^\\h\s+(.+?)\s*$/))) { name = m[1]; continue; }
    if ((m = l.match(/^\\c\s+(\d+)/))) { flush(); ch = Number(m[1]); vn = null; continue; }
    if ((m = l.match(/^\\v\s+(\S+)\s?(.*)$/))) { flush(); vn = m[1]; buf = [m[2] || ""]; continue; }

    if (l.startsWith("\\")) {
      const mk = l.match(/^\\(\+?[a-z]+\d*)\b\s?(.*)$/i);
      if (mk && TEXT_MARKERS.has(mk[1].toLowerCase())) {
        if (vn != null && mk[2]) buf.push(mk[2]); // poetry/prose continuation
      }
      // any other leading-marker line (\s heading, \d, \r, \ms, \mt...) is skipped
    } else if (vn != null) {
      buf.push(l); // bare continuation text
    }
  }
  flush();
  return { name, idCode, chapters };
}

const args = process.argv.slice(2).map((s) => s.toUpperCase());
const files = readdirSync(SRC).filter((f) => f.endsWith(".usfm")).sort();
// filenames look like "70-MATeng-kjv.usfm" -> code "MAT"
const codeFromFile = (f) => (f.match(/^\d+-(.+)eng-kjv\.usfm$/i) || [])[1]?.toUpperCase() || null;

let codes;
if (args.includes("--ALL")) {
  codes = files.map(codeFromFile).filter(Boolean); // canonical order (files are numbered)
} else {
  codes = args.filter((a) => !a.startsWith("--"));
}

if (!codes.length) {
  console.log("Usage: npm run ingest -- <CODE> [<CODE> ...]   e.g. npm run ingest -- MAT");
  console.log("       npm run ingest -- --all           (every book, canonical order)");
  console.log(`\n${files.length} book files available in data/source/eng-kjv_usfm/`);
  process.exit(0);
}

function findFile(code) {
  return files.find((f) => f.includes(`${code}eng-kjv.usfm`)) || null;
}

const report = [];
let totalChapters = 0;
let totalVerses = 0;

for (const code of codes) {
  const file = findFile(code);
  if (!file) {
    report.push({ code, name: "—", canon: "—", chapters: 0, verses: 0, checksum: "NO FILE" });
    continue;
  }
  const { name, idCode, chapters } = parseBook(readFileSync(join(SRC, file), "utf8"));
  const canon = canonOf(idCode || code);
  const chapterNums = [...chapters.keys()].sort((a, b) => a - b);

  let bookVerses = 0;
  for (const cnum of chapterNums) {
    const verses = chapters.get(cnum);
    bookVerses += verses.length;
    upsertChapterText({
      ref: `${idCode}.${cnum}`,
      book: name,
      chapter: cnum,
      canon,
      kjvNumbering: `${idCode}.${cnum}`,
      verses,
    });
  }

  const expected = PROTO_CHAPTERS[idCode];
  const checksum =
    expected == null
      ? "n/a (apocrypha)"
      : chapterNums.length === expected
        ? `OK (${expected})`
        : `MISMATCH! got ${chapterNums.length}, expected ${expected}`;

  totalChapters += chapterNums.length;
  totalVerses += bookVerses;
  report.push({ code: idCode, name, canon, chapters: chapterNums.length, verses: bookVerses, checksum });
}

console.table(report);
console.log(`Totals: ${totalChapters} chapters, ${totalVerses} verses written.`);
const bad = report.filter((r) => r.checksum.startsWith("MISMATCH") || r.checksum === "NO FILE");
if (bad.length) {
  console.error(`\n⚠  ${bad.length} book(s) failed verification — inspect before continuing.`);
  process.exitCode = 1;
}
