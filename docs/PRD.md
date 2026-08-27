# PRD — KJV Catholic-Oriented Bible Chapter Companion

*Draft v1 · 2026-07-23 · Author: Alejandro Ruiz*
*Source: `bible_chapter_companion_research.md` (same folder)*

---

## 1. Summary

A **local-first, single-user** Bible reading companion. For each chapter it gives:

1. The KJV text (with Apocrypha / deuterocanon).
2. A faithful **two-minute chapter summary**.
3. **Three memorable takeaways**.
4. **A few cross-references that explain *why* the passages connect** — not just a link list.
5. Every interpretation **attributed** to a named source; **Catholic vs. Protestant differences labeled fairly**.
6. A **calm, focused interface** — read → understand → connect → apply, all on one page.

This is the exact gap the research concludes no existing product fills. The product thesis (verbatim from the report):

> A focused KJV chapter companion for Christians who value Catholic tradition: a faithful two-minute summary, memorable takeaways, and a small number of explained connections, with every interpretation attributed and denominational differences clearly labeled.

### Design constraints from the brief

- **You are the only user at first.** Runs entirely on your machine (`localhost`), no auth, no cloud dependency required.
- **Multiple implementation options** are presented (§5, §6) so you pick the tradeoff you want.
- **Future flexibility to branch off** is a first-class requirement — the data model and API boundary are designed so the same content and code deploy to the cloud / multi-user / an influencer pitch **without a rewrite** (§8).
- **Cost is spelled out** (§7). Bottom line: the prototype costs **a few dollars, one time**; running it locally costs **~$0**.
- **Personal project, independent of Gridworks.** No work Azure tenant, no Gridworks database, no Gridworks hosting. Personal GitHub repo, personal Anthropic API key on personal billing. Local **SQLite is just a file** — it needs no cloud database at all, so the whole prototype has zero external dependency. Every future-cloud recommendation in this PRD is a **free personal-tier** service (§7, §8), and the two recommended ones (Cloudflare D1 / Turso) are literally SQLite, so branching off is a config change, not a rewrite.

### Positioning guardrail (from research §Catholic approval)

Never label it "Catholic-approved." The KJV is not on the USCCB approved list. Use **"Catholic-oriented"** / **"Catholic-compatible"** until/unless a cleric formally reviews it. This is baked into the copy and the data model (`tradition` labels).

---

## 2. Goals / Non-Goals

### Goals (prototype)
- Cover **one Gospel — Matthew (28 chapters)** end to end, per the research recommendation. Matthew stresses narrative, teaching, OT fulfillment, Peter/Church authority, and application — the hardest test cases.
- Prove the "one focused page per chapter" experience the two-app YouVersion+Catena combo can't deliver.
- Every summary/takeaway/cross-ref is **attributed** and **tradition-labeled**.
- Runs locally, offline-capable once content is authored.

### Non-Goals (prototype)
- Not all 73 books. Not multi-user. Not an app-store release. No accounts, no payments.
- No claim of theological accuracy without a reviewer (positioning guardrail above).
- Not a research library (that's Verbum's failure mode — avoid it).

### Success criteria
Adapted from the research's own 14-day scorecard. The prototype "wins" if, across the 10 benchmark chapters, you answer **yes on ≥5 of 7** for **≥8 of 10** chapters:

| # | Question |
|---|---|
| 1 | Useful two-minute summary? |
| 2 | Three memorable takeaways? |
| 3 | ≥3 explained connections to other passages? |
| 4 | Textual meaning distinguished from interpretation? |
| 5 | Catholic/Protestant differences labeled fairly? |
| 6 | Can I verify who/what supported the explanation? |
| 7 | Did it make me want to continue tomorrow? |

Benchmark chapters: Gen 22, Ps 22, Matt 5, Matt 16, John 6, Rom 8, Jas 2, 1 Cor 11, Rev 12, 2 Macc 12. (Prototype authors Matthew + these 10 spillover chapters so you can run the exact test.)

---

## 3. Core user flow

```
Pick book → pick chapter
      │
      ▼
┌─────────────────────────────────────────────┐
│  Matthew 16                                   │
│  ┌───────────────┐  ┌──────────────────────┐ │
│  │  KJV text      │  │  Companion (one page) │ │
│  │  (scrollable,  │  │  ── 2-min summary     │ │
│  │  verse nums,   │  │  ── 3 takeaways        │ │
│  │  deuterocanon  │  │  ── explained links    │ │
│  │  clearly       │  │      · why it connects │ │
│  │  marked)       │  │      · [source]        │ │
│  │                │  │      · [Catholic/Prot] │ │
│  └───────────────┘  └──────────────────────┘ │
│  next chapter →                                │
└─────────────────────────────────────────────┘
```

Everything for one chapter is on **one screen**. No leaving the page to understand it. Clicking a cross-reference navigates to that chapter *and* keeps the "why" explanation visible.

---

## 4. Data model (the crown jewel — same in every option)

This is the durable asset. It survives any stack change and is what you'd pitch. Store as SQLite (recommended) or JSON files.

```jsonc
// one record per chapter
{
  "ref": "MAT.16",                 // stable canonical id
  "book": "Matthew",
  "chapter": 16,
  "canon": "protocanonical",       // protocanonical | deuterocanonical | kjv-apocrypha-only
  "kjvNumbering": "MAT.16",        // reconcile KJV vs Catholic numbering (see §9)
  "verses": [ { "n": 18, "text": "..." } ],
  "summary": "≤ ~250 words, a faithful 2-minute read.",
  "takeaways": [
    "Memorable point 1.",
    "Memorable point 2.",
    "Memorable point 3."
  ],
  "crossRefs": [
    {
      "target": "ISA.22",          // clickable → loads that chapter
      "label": "Isaiah 22:22 — the key of the house of David",
      "why": "Explains WHY they connect: the keys given to Peter echo the...",
      "sources": ["Haydock", "Catena (Chrysostom)"],   // attribution, always present
      "tradition": "catholic"      // catholic | protestant | shared | contested
    }
  ],
  "interpretationNotes": [
    {
      "claim": "The 'rock' is Peter and his office.",
      "tradition": "catholic",
      "sources": ["Haydock on Matt 16:18", "CCC 552"],
      "counterpoint": {            // fair labeling of disagreement
        "tradition": "protestant",
        "summary": "Some read 'rock' as Peter's confession, not his person.",
        "sources": ["Enduring Word on Matt 16"]
      }
    }
  ],
  "authoring": {                   // provenance + reproducibility
    "model": "claude-opus-4-8",
    "generatedAt": "2026-07-23",
    "reviewedBy": null,            // set when a human/cleric signs off
    "status": "draft"             // draft | self-reviewed | cleric-reviewed
  }
}
```

Why this shape matters for your future branch-off: `sources`, `tradition`, `counterpoint`, and `authoring.status` are exactly the fields an influencer pitch and an eventual cleric review need. Building them in from day one means no migration later.

---

## 5. Content strategy — pick one (this is the real decision)

The chapter text is free/public-domain. **The authored summaries + takeaways + explained cross-refs are the product and the IP.** How they get created is the biggest choice.

| Option | How it works | Quality | Runtime cost | Offline | Best when |
|---|---|---|---|---|---|
| **A. Pre-authored, static** | Author all chapters once (by you, or AI-assisted), store in DB. App just reads. | Highest, fully controllable | **$0** | Yes | You want full editorial control + a reviewable, shippable artifact |
| **B. On-demand cloud AI + cache** | App calls Claude the first time you open a chapter, then caches the result forever. | High | ~$0.03–0.15 first open, $0 after | After first open | You want to explore quickly without pre-authoring everything |
| **C. On-demand local LLM (Ollama)** | Same as B but a local model (e.g. Llama/Qwen) — no API, no cost, fully private. | Lower on theological nuance | **$0** | Yes | Zero cost + total privacy matter more than depth |
| **D. Hybrid (recommended)** | Pre-author with a **Claude pipeline grounded in real Catholic sources (RAG)**, cache to DB, keep a "regenerate/ask" button for live questions. | Highest + flexible | ~$0 steady state | Yes | You want the best of A and B — this is the recommendation |

### Recommended: Option D, phased as A → D

1. **Phase 1:** Run an **offline authoring pipeline** once — grounds Claude Opus 4.8 on the actual KJV chapter text plus public-domain Catholic sources (Haydock, Catena/Church Fathers, Catechism references), and writes structured records to the DB. This is your Option A content, but generated with real grounding so it's faithful and attributable rather than made-up.
2. **Phase 2:** Add an optional **"ask about this chapter"** live button (Option B) for follow-up questions, reusing the same grounding. Cheap, per-use, cached.

Grounding sources (all public-domain / usable): **eBible KJV+Apocrypha** for text, **Haydock Catholic commentary** (PD), **Church Fathers / Catena-style** excerpts (PD), **Catechism** references. This is what makes the output *Catholic-oriented and attributed* instead of a generic neutral summary — the exact failure of BibleKey/BibleRef the research flagged.

> **Model note:** Default to **Claude Opus 4.8** (`claude-opus-4-8`) for authoring — theological nuance and fair both-sides labeling reward the strongest model, and one-time authoring cost is trivial. Use **Haiku 4.5** (`claude-haiku-4-5`) only if you want to slash the (already tiny) cost. Use the **Batch API** (−50%) for the full-canon run later.

---

## 6. App architecture — pick one

All three run locally now and are designed to branch off to the cloud later. Content (§4) is identical across them.

| Option | Stack | Local run | Branch-off path | Effort |
|---|---|---|---|---|
| **1. Static SPA + JSON** | Plain HTML/CSS/JS, content as JSON files, opened via a tiny static server | `npx serve` / any static server | Drop the folder on Azure Static Web Apps / Netlify — done | Lowest |
| **2. Local web app + SQLite (recommended)** | **Node/Express** + **SQLite** (local file) + vanilla JS frontend + a Node authoring script | `npm run dev` → `localhost:3000` | Deploy the same server+DB to a **free** personal host — Cloudflare Workers+D1 or Turso+Fly/Render (all SQLite-compatible). No Gridworks/Azure. | Medium |
| **3. Desktop app** | Tauri (or Electron) wrapping the same frontend + local SQLite | Double-click the app | Ship a signed installer; still local-only per user | Medium-High |

### Recommended: Option 2 — local Node/Express + SQLite + vanilla JS

Reasons tailored to you:
- **Uses skills you already have** (Node/Express + vanilla JS, and the headless-Chrome verify workflow for a frontend with "no local run") — but the project and infra are **entirely separate from Gridworks**: personal repo, personal API key, no work tenant.
- **Zero external dependency to run.** SQLite is a single local file — no database service, no cloud account, nothing to provision. `git clone` + `npm install` + `npm run dev` and it works offline.
- **A clean API boundary** (`GET /api/chapter/:ref`, `POST /api/ask`) is the single thing that makes future branch-off free — the frontend never changes when the backend later moves from `localhost` to a free personal host.
- **SQLite is the portable IP.** One file. The two recommended future hosts (**Cloudflare D1**, **Turso**) *are* SQLite — so "go to the cloud" is a connection-string change, not a data migration.
- **Single user now = no auth, no gating.** When you branch off to share it, add a free personal auth layer (Cloudflare Access free tier, or Clerk/Auth.js free tier) — no Gridworks access system involved.

Pick **Option 1** instead if you want the absolute simplest thing and are fine hand-authoring JSON. Pick **Option 3** only if you specifically want a double-click native app.

### Frontend direction
Calm, editorial, single-column-with-companion-panel. Not a dashboard, not template cards. Serif for scripture, clear hierarchy, generous spacing, restrained accent color. Deuterocanonical books visually but respectfully marked. (Design detail out of scope for this PRD; noted so it doesn't drift into "AI-slop template.")

---

## 7. Cost

Assumes ~12k input + ~3k output tokens per chapter (KJV text + grounding sources in, structured companion out). Opus 4.8 = $5/$25 per 1M in/out; Haiku 4.5 = $1/$5; Batch API = −50%.

### One-time authoring (Option A/D pipeline)

| Scope | Chapters | Opus 4.8 | Opus via Batch | Haiku 4.5 |
|---|---|---|---|---|
| **Prototype — Matthew + 10 benchmark chapters** | ~38 | **~$5** | ~$3 | ~$1 |
| One full Gospel | ~28 | ~$4 | ~$2 | ~$1 |
| Full KJV (66 books) | ~1,189 | ~$160 | ~$80 | ~$35 |
| Full Catholic + KJV Apocrypha | ~1,350 | ~$180–220 | ~$90–110 | ~$40 |

Prompt caching on the shared system prompt + reference corpus pushes these **lower** in practice.

### Runtime (steady state)

| Mode | Cost |
|---|---|
| Local, pre-authored + cached (recommended) | **~$0** |
| Optional live "ask this chapter" query | ~$0.02 (Haiku) – ~$0.15 (Opus) per question |
| Local LLM (Option C) | **$0** (needs a capable local GPU/RAM) |

### Infrastructure

| Item | Cost |
|---|---|
| KJV + Apocrypha text (eBible, public domain) | Free |
| Haydock / Church Fathers / Catechism refs (public domain) | Free |
| Local hosting (your machine, SQLite file) | $0 — no DB service, no account |
| Anthropic API (authoring) | Personal key, personal billing — the ~$5 above |
| Future cloud, **free personal tiers** (all non-Gridworks) | $0/mo on the free tiers below |

### Hosting & database cost (website hosting, DB hosting — the recurring bill)

**Now (local):** **$0/mo.** SQLite is a file on your machine; the app runs at `localhost`. No website host, no database service, no account.

**When you put it online** (personal accounts, no Gridworks/Azure). Free tiers comfortably cover just-you or a handful of testers:

| Component | Service (free tier) | Free-tier limit | Cost if you outgrow it |
|---|---|---|---|
| **Website hosting** (frontend) | Cloudflare Pages / Netlify / Vercel | Static hosting, generous bandwidth | ~$0; paid Pro ~$20/mo only at real scale |
| **Backend / API** | Cloudflare Workers | 100k requests/day | ~$5/mo (10M req) |
| **Database hosting** | **Cloudflare D1** (SQLite) *(recommended)* | 5 GB storage, 5M row-reads/day | pennies; ~$5/mo at scale |
| — or — | **Turso** (SQLite/libSQL) | ~9 GB, ~1B row-reads/mo, 500 DBs | $0 → usage-based |
| Auth (only if sharing) | Cloudflare Access / Clerk / Auth.js | Free personal tier | — |
| Custom domain (optional) | any registrar | — | ~$10–12/**year** |

**Realistic recurring hosting bill for you (or a few testers): $0/mo.** The only likely cost is a custom domain (~$1/mo) if you want one instead of a free `*.pages.dev` URL. You hit paid tiers only at thousands of daily users — an influencer-launch problem, not a prototype one. Because D1 and Turso *are* SQLite, moving your local DB file online is a connection swap, not a migration.

**Combined takeaway:** one-time API authoring is **~$5** (prototype) / **~$100** (full canon). Recurring **hosting + DB = $0/mo** local, and **$0/mo** online on free tiers. Nothing on a Gridworks account.

---

## 8. Future branch-off paths (designed in from day one)

The point of the API boundary + portable SQLite + rich data model is that each of these is an *addition*, not a rewrite:

| Branch | What changes | What stays the same |
|---|---|---|
| **Cloud, still just you** | Deploy Node server + SQLite to a free personal host (Cloudflare Workers+D1, or Turso+Fly/Render). No Gridworks/Azure. | Frontend, data model, content |
| **Multi-user / share with a few people** | Add a free personal auth layer (Cloudflare Access, Clerk, or Auth.js free tier) | Everything else |
| **Expand canon** | Run the authoring pipeline on more books (Batch API) | App code unchanged |
| **Cleric / theologian review** | Flip `authoring.status` per chapter, fill `reviewedBy`; surface a "reviewed" badge | Schema already has the fields |
| **Influencer pitch** | Turn 30 days of your own use + the attribution/citation policy into the pitch (research §Influencer-pitch readiness) | The product itself |
| **Native / mobile** | Wrap the same frontend in Tauri, or point a mobile client at the same API | Backend + content |

The one thing that makes all of this cheap: **content is data, interpretation is attributed data, and the frontend only ever talks to an API.** Keep those three and you can go anywhere.

---

## 9. Known complications to handle (from research)

1. **Canon ≠ KJV Apocrypha.** KJV Apocrypha includes 1 Esdras, 2 Esdras, Prayer of Manasses — *not* in the Roman Catholic canon. The `canon` field distinguishes `protocanonical` / `deuterocanonical` / `kjv-apocrypha-only`. Never call the extras "Catholic Scripture."
2. **Numbering reconciliation.** Additions to Esther and Daniel are arranged differently in KJV vs Catholic Bibles. `ref` (Catholic-canonical) + `kjvNumbering` fields plus reference aliases handle this.
3. **Licensing.** KJV is US public domain (American Bible Society); UK Crown rights (Cambridge) matter only for global commercial distribution — irrelevant while local/personal. Use a **verified public-domain source (eBible KJV+Apocrypha)** and do your own formatting; **do not scrape YouVersion's KJVAAE** (its typesetting is later, copyrighted work).
4. **Authored content = your IP.** Summaries, takeaways, and explained cross-refs are original work — the cleanest rights position and the actual differentiator.
5. **Positioning.** "Catholic-oriented," never "Catholic-approved," until a cleric reviews (§1).

---

## 10. Proposed build phases

- **Phase 0 — Scaffold (½ day):** Node/Express + SQLite skeleton, `GET /api/chapter/:ref`, empty schema, static frontend shell rendering one hard-coded chapter. Verify via headless Chrome (your existing workflow).
- **Phase 1 — Text ingest (½ day):** Load eBible KJV+Apocrypha into SQLite; render real KJV text with verse numbers; mark deuterocanon.
- **Phase 2 — Authoring pipeline (1–2 days):** Offline script grounds Claude Opus 4.8 on chapter text + Haydock/Fathers/Catechism, writes structured companion records. Author **Matthew + 10 benchmark chapters** (~$5).
- **Phase 3 — Companion UI (1 day):** Summary / takeaways / explained cross-refs / attribution / tradition labels on one page; cross-ref navigation.
- **Phase 4 — Run the scorecard:** Read the 10 benchmark chapters, fill the §2 table. Decide: expand, adjust grounding, or stop.
- **Phase 5 (optional):** Live "ask this chapter" button; then broaden canon via Batch API.

---

## 11. Decisions & open questions

**Decided:**
- **Content strategy:** Option D — **Hybrid, Claude RAG-grounded + cached** (§5). ✅
- **Independence:** Personal project, **not under Gridworks** — personal repo, personal Anthropic key, local SQLite, free personal-tier services only for any future cloud (§1, §7, §8). ✅
- **Next step:** Refine this PRD before writing code. ✅

**Still open:**
1. **Stack:** recommended **Option 2 (Node/Express + local SQLite)** — needs no cloud DB and no Gridworks account. Or the dead-simple **Option 1 (static + JSON files)** if you'd rather avoid even a local server. Which?
2. **Scope of first authoring run:** Matthew + the 10 benchmark chapters (recommended, ~$5), or Matthew only (~$4)?
3. **Anything else to change** before I stop refining and (on your go) start Phase 0?
