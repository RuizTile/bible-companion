// Export SQLite content as browser-ready, per-book JSON payloads.
// Authored files overlay DB companion fields so reviewed drafts can be
// previewed without mutating the local database first.
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getChapter, listBooks, listChapters } from "../server/db.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const AUTHORED_DIR = join(ROOT, "data", "authored");
const OUTPUT_DIR = join(ROOT, "public", "data");
const BOOKS_DIR = join(OUTPUT_DIR, "books");
const COMPANION_FIELDS = [
  "summary",
  "takeaways",
  "crossRefs",
  "interpretationNotes",
  "authoring",
];

async function readAuthoredOverlays() {
  const overlays = new Map();
  let files = [];
  try {
    files = (await readdir(AUTHORED_DIR)).filter((file) => file.endsWith(".json"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  for (const file of files) {
    const record = JSON.parse(await readFile(join(AUTHORED_DIR, file), "utf8"));
    if (!record.ref) throw new Error(`${file}: missing ref`);
    overlays.set(record.ref, record);
  }
  return overlays;
}

function applyOverlay(chapter, overlay) {
  if (!overlay) return chapter;
  const merged = { ...chapter };
  for (const field of COMPANION_FIELDS) {
    if (Object.hasOwn(overlay, field)) merged[field] = overlay[field];
  }
  return merged;
}

function chapterStatus(chapter) {
  const status = chapter.authoring?.status;
  if (status === "placeholder") return "placeholder";
  if (chapter.summary || ["draft", "self-reviewed", "cleric-reviewed"].includes(status)) {
    return "authored";
  }
  return "text";
}

const overlays = await readAuthoredOverlays();
const books = listBooks();
const manifestBooks = [];
let chapterCount = 0;
let authoredCount = 0;

await rm(OUTPUT_DIR, { recursive: true, force: true });
await mkdir(BOOKS_DIR, { recursive: true });

for (const book of books) {
  const chapters = listChapters(book.book).map(({ ref }) => {
    const chapter = getChapter(ref);
    if (!chapter) throw new Error(`DB index references missing chapter: ${ref}`);
    return applyOverlay(chapter, overlays.get(ref));
  });

  const chapterIndex = chapters.map((chapter) => ({
    ref: chapter.ref,
    chapter: chapter.chapter,
    status: chapterStatus(chapter),
  }));
  const authored = chapterIndex.filter((chapter) => chapter.status === "authored").length;

  manifestBooks.push({
    code: book.code,
    book: book.book,
    canon: book.canon,
    chapters: chapterIndex,
    total: chapters.length,
    authored,
  });

  await writeFile(
    join(BOOKS_DIR, `${book.code}.json`),
    JSON.stringify({ code: book.code, book: book.book, chapters }),
    "utf8",
  );
  chapterCount += chapters.length;
  authoredCount += authored;
}

await writeFile(
  join(OUTPUT_DIR, "index.json"),
  JSON.stringify({ books: manifestBooks }),
  "utf8",
);

console.log(`Static data built: ${books.length} books, ${chapterCount} chapters, ${authoredCount} companions.`);
