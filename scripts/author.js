// Phase 2 authoring pipeline — STUB (not implemented yet).
//
// Content is authored per session, chapter-by-chapter, on request — never as a
// bulk canon batch. You name the chapters for a given session, e.g.:
//
//   npm run author -- MAT.16 MAT.5
//
// When implemented, for each ref the pipeline will:
//   1. Load the chapter's KJV text from the DB.
//   2. Retrieve grounding — public-domain Haydock, Church Fathers (Catena-style),
//      and Catechism references for those verses.
//   3. Generate the structured companion record (summary, 3 takeaways, explained
//      cross-refs, interpretation notes) with attribution + Catholic/Protestant
//      tradition labels.
//   4. Write it via upsertChapter() with authoring.status = "draft".

const refs = process.argv.slice(2);

if (refs.length === 0) {
  console.log("Usage: npm run author -- <REF> [<REF> ...]   e.g. npm run author -- MAT.16");
  console.log("Phase 2 not implemented yet. Name the chapters to author this session.");
  process.exit(0);
}

console.log(`Requested authoring for: ${refs.join(", ")}`);
console.log("Phase 2 pipeline not implemented yet — placeholder.");
process.exit(0);
