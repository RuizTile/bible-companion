import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = join(ROOT, "public", "data");
const BOOKS_DIR = join(DATA_DIR, "books");
const manifest = JSON.parse(await readFile(join(DATA_DIR, "index.json"), "utf8"));
const files = new Set(await readdir(BOOKS_DIR));
const seenRefs = new Set();
let chapterCount = 0;

if (!Array.isArray(manifest.books) || !manifest.books.length) {
  throw new Error("Static manifest has no books");
}
if (files.size !== manifest.books.length) {
  throw new Error(`Book payload count mismatch: ${files.size} files for ${manifest.books.length} books`);
}

for (const book of manifest.books) {
  const file = `${book.code}.json`;
  if (!files.has(file)) throw new Error(`Missing book payload: ${file}`);
  const payload = JSON.parse(await readFile(join(BOOKS_DIR, file), "utf8"));
  if (payload.book !== book.book || !Array.isArray(payload.chapters)) {
    throw new Error(`${file}: manifest/payload mismatch`);
  }
  if (payload.chapters.length !== book.total || book.chapters.length !== book.total) {
    throw new Error(`${file}: chapter count mismatch`);
  }
  const manifestRefs = new Set(book.chapters.map((chapter) => chapter.ref));

  for (const chapter of payload.chapters) {
    if (seenRefs.has(chapter.ref)) throw new Error(`Duplicate ref: ${chapter.ref}`);
    if (!manifestRefs.has(chapter.ref)) throw new Error(`${file}: ${chapter.ref} missing from manifest`);
    if (!Array.isArray(chapter.verses) || !chapter.verses.length) {
      throw new Error(`${chapter.ref}: missing verses`);
    }
    seenRefs.add(chapter.ref);
    chapterCount += 1;
  }
}

console.log(`Static data verified: ${manifest.books.length} books, ${chapterCount} unique chapters.`);
