// Merge authored companion records (data/authored/<REF>.json) into the DB.
// Companion-only write: preserves the ingested verse text. Run after reviewing
// the authored JSON files.
//   npm run merge            (merge all data/authored/*.json)
//   npm run merge -- GEN.22  (merge specific refs)
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { upsertCompanion } from "../server/db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = join(__dirname, "..", "data", "authored");

if (!existsSync(DIR)) {
  console.log("No data/authored/ directory yet — nothing to merge.");
  process.exit(0);
}

const only = new Set(process.argv.slice(2).map((s) => s.toUpperCase()));
const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".json"))
  .filter((f) => only.size === 0 || only.has(f.replace(/\.json$/i, "").toUpperCase()));

let n = 0;
for (const f of files) {
  const rec = JSON.parse(readFileSync(join(DIR, f), "utf8"));
  upsertCompanion(rec);
  n += 1;
  console.log(`merged ${rec.ref}  (status: ${rec.authoring?.status ?? "?"})`);
}
console.log(`\nDone. ${n} companion record(s) merged.`);
