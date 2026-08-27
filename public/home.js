// Home index — a warm, sectioned, collapsible index of every book.
const el = (id) => document.getElementById(id);

// Old Testament USFM codes (the 39 protocanonical OT books). Everything else
// protocanonical is New Testament; non-protocanonical goes in the Apocrypha group.
const OT = new Set([
  "GEN","EXO","LEV","NUM","DEU","JOS","JDG","RUT","1SA","2SA","1KI","2KI",
  "1CH","2CH","EZR","NEH","EST","JOB","PSA","PRO","ECC","SNG","ISA","JER",
  "LAM","EZK","DAN","HOS","JOL","AMO","OBA","JON","MIC","NAM","HAB","ZEP",
  "HAG","ZEC","MAL",
]);
const CANON_BADGE = {
  deuterocanonical: "Deuterocanon",
  "kjv-apocrypha-only": "not in Catholic canon",
};

function group(books) {
  const g = { ot: [], nt: [], apoc: [] };
  for (const b of books) {
    if (b.canon !== "protocanonical") g.apoc.push(b);
    else if (OT.has(b.code)) g.ot.push(b);
    else g.nt.push(b);
  }
  return g;
}

function bookRow(b) {
  const d = document.createElement("details");
  d.className = "book";

  const pct = b.total ? Math.round((b.authored / b.total) * 100) : 0;
  const badge = CANON_BADGE[b.canon]
    ? `<span class="book-badge">${CANON_BADGE[b.canon]}</span>`
    : "";

  const summary = document.createElement("summary");
  summary.className = "book-head";
  summary.innerHTML =
    `<span class="caret" aria-hidden="true">▸</span>` +
    `<span class="book-name">${b.book}</span>` +
    `<span class="book-meta">${badge}` +
    `<span class="progress" title="${b.authored} of ${b.total} with a companion"><i style="width:${pct}%"></i></span>` +
    `<span class="book-count">${b.authored}/${b.total}</span></span>`;
  d.appendChild(summary);

  const grid = document.createElement("div");
  grid.className = "chapter-grid";
  for (const c of b.chapters) {
    const a = document.createElement("a");
    a.className = `chip ${c.status}`;
    a.href = `./read.html?ref=${encodeURIComponent(c.ref)}`;
    a.textContent = c.chapter;
    a.title = `${b.book} ${c.chapter} — ${c.status === "authored" ? "companion" : c.status}`;
    grid.appendChild(a);
  }
  d.appendChild(grid);
  return d;
}

function sectionGroup(title, books, i) {
  if (!books.length) return null;
  const wrap = document.createElement("details");
  wrap.className = "section-group reveal";
  wrap.open = true;
  wrap.style.setProperty("--i", i);

  const authored = books.reduce((s, b) => s + b.authored, 0);
  const sum = document.createElement("summary");
  sum.className = "section-title";
  sum.innerHTML =
    `<span class="caret" aria-hidden="true">▸</span>` +
    `<span class="sec-name">${title}</span>` +
    `<span class="rule" aria-hidden="true"></span>` +
    `<span class="n">${books.length} books${authored ? ` · ${authored} with a companion` : ""}</span>`;
  wrap.appendChild(sum);

  const list = document.createElement("div");
  list.className = "book-list";
  for (const b of books) list.appendChild(bookRow(b));
  wrap.appendChild(list);
  return wrap;
}

async function init() {
  let books;
  try {
    ({ books } = await (await fetch("/api/index")).json());
  } catch {
    el("message").textContent = 'Server not reachable. Start it with "npm run dev".';
    return;
  }
  if (!books.length) {
    el("message").textContent = 'No text yet. Run "npm run ingest -- MAT" and refresh.';
    return;
  }

  const totalCh = books.reduce((s, b) => s + b.total, 0);
  const totalAuth = books.reduce((s, b) => s + b.authored, 0);
  el("progress").innerHTML =
    `<b>${totalAuth}</b> of ${totalCh.toLocaleString()} chapters now have a written companion.`;

  const g = group(books);
  const sections = el("sections");
  const groups = [
    ["Old Testament", g.ot],
    ["New Testament", g.nt],
    ["Apocrypha & Deuterocanon", g.apoc],
  ];
  let i = 0;
  for (const [title, bks] of groups) {
    const node = sectionGroup(title, bks, i);
    if (node) { sections.appendChild(node); i += 1; }
  }

  const setAll = (open) =>
    sections.querySelectorAll("details").forEach((d) => (d.open = open));
  el("expandAll").addEventListener("click", () => setAll(true));
  el("collapseAll").addEventListener("click", () => setAll(false));
}

init();
