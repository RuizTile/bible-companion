# Bible Chapter Companion

A local-first, single-user KJV **Catholic-oriented** Bible chapter companion.
Each chapter shows the KJV text alongside a two-minute summary, three takeaways,
and a few **explained** cross-references — every interpretation attributed and
each tradition (Catholic / Protestant) labeled.

> **Personal project.** Not affiliated with Gridworks. No work Azure tenant, no
> Gridworks database or hosting. Runs entirely on your machine; SQLite is just a
> local file. Future cloud is optional and free-tier (Cloudflare D1 / Turso).

> **Positioning:** "Catholic-oriented," **not** "Catholic-approved" (the KJV is
> not on the USCCB approved list). See `docs/PRD.md` §1.

## Quickstart

**No `npm install` needed — zero third-party dependencies.** Uses Node's
built-in HTTP server and `node:sqlite`. Requires **Node ≥ 22.5** (you're on 24).

```bash
npm run seed      # loads data/*.json into db/companion.db
npm run dev       # serves http://localhost:3000
```

(`node:sqlite` runs behind `--experimental-sqlite`, already set in the npm
scripts; it prints one harmless ExperimentalWarning on startup.)

Open http://localhost:3000. It loads the seeded chapter (Matthew 16) with the
companion panel.

> The seeded Matthew 16 record is a **placeholder** (marked as such in the UI) —
> verses 13–20 of real public-domain KJV text, but the summary/takeaways/notes
> are layout stand-ins, not authored content. Real content comes from the
> Phase 2 authoring pipeline.

## Layout

```
bible-companion/
├── docs/            PRD.md, research.md
├── data/            chapter records (JSON) → seeded into SQLite
├── db/              schema.sql + companion.db (gitignored)
├── server/          Express server + SQLite data layer (index.js, db.js)
├── scripts/         seed.js (load data), author.js (Phase 2 stub)
└── public/          frontend (index.html, styles.css, app.js)
```

## Data model

One record per chapter (see `docs/PRD.md` §4). Key fields: `canon`
(protocanonical / deuterocanonical / kjv-apocrypha-only), per-cross-ref `why` +
`sources` + `tradition`, `interpretationNotes` with a labeled `counterpoint`,
and `authoring.status` (placeholder → draft → self-reviewed → cleric-reviewed).

## Content authoring (Phase 2)

Content is authored **per session, chapter by chapter, on request** — not as a
bulk run. Name the chapters for the session:

```bash
npm run author -- MAT.16 MAT.5
```

(Pipeline not implemented yet — `scripts/author.js` is a documented stub.)

## Roadmap

Phase 0 (this scaffold) → 1 full KJV text ingest → 2 authoring pipeline →
3 companion UI polish → 4 run the 10-chapter scorecard. Full detail in
`docs/PRD.md` §10.
