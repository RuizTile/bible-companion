// Load every JSON chapter record in data/ into the SQLite database.
// Run: npm run seed
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { upsertChapter } from "../server/db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");

const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
let count = 0;
for (const f of files) {
  const chapter = JSON.parse(readFileSync(join(DATA_DIR, f), "utf8"));
  upsertChapter(chapter);
  count += 1;
  console.log(`seeded ${chapter.ref}  (${f})`);
}
console.log(`\nDone. ${count} chapter record(s) loaded.`);
