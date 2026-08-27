// Reader — opens ?ref=<REF> (e.g. read.html?ref=GEN.22), with book/chapter pickers.
const el = (id) => document.getElementById(id);
const CANON_LABEL = {
  protocanonical: "Protocanonical",
  deuterocanonical: "Deuterocanonical",
  "kjv-apocrypha-only": "KJV Apocrypha (not Catholic canon)",
};

let books = [];
let allRefs = [];      // every ref in canonical order, for prev/next nav
let currentRef = null;

async function api(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

function tag(tradition) {
  const t = tradition || "shared";
  const span = document.createElement("span");
  span.className = `tag ${t}`;
  span.textContent = t;
  return span;
}

function sourcesLine(sources) {
  const span = document.createElement("span");
  span.className = "sources";
  span.textContent = sources && sources.length ? `— ${sources.join(", ")}` : "";
  return span;
}

function renderVerses(verses) {
  const box = el("verses");
  box.innerHTML = "";
  for (const v of verses) {
    const span = document.createElement("span");
    span.className = "verse";
    span.id = `v${v.n}`;
    span.innerHTML = `<span class="vnum">${v.n}</span>`;
    span.appendChild(document.createTextNode(v.text + " "));
    box.appendChild(span);
  }
}

// Parse a cross-ref verse spec into sorted verse numbers.
// Accepts "18" | "20-22" | "13,16" | "1-3,7".
function parseVerses(spec) {
  const out = new Set();
  if (!spec) return [];
  for (const part of String(spec).split(",")) {
    const seg = part.trim();
    const range = seg.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const a = +range[1], b = +range[2];
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) out.add(i);
    } else if (/^\d+$/.test(seg)) {
      out.add(+seg);
    }
  }
  return [...out].sort((x, y) => x - y);
}

// Highlight + scroll to the cited verses in the currently rendered chapter.
function highlightVerses(spec) {
  document.querySelectorAll(".verse.hl").forEach((n) => n.classList.remove("hl"));
  const nums = parseVerses(spec);
  let first = null;
  for (const n of nums) {
    const span = document.getElementById(`v${n}`);
    if (!span) continue;
    span.classList.add("hl");
    if (!first) first = span;
  }
  if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderCrossRefs(refs) {
  const box = el("crossRefs");
  box.innerHTML = "";
  if (!refs || !refs.length) {
    box.innerHTML = '<p class="summary muted">No connections yet.</p>';
    return;
  }
  const available = new Set(books.flatMap((b) => b._refs || []));
  for (const r of refs) {
    const wrap = document.createElement("div");
    wrap.className = "crossref";

    const btn = document.createElement("button");
    btn.className = "cr-label";
    btn.textContent = r.label || r.target;
    const canGo = available.has(r.target);
    btn.disabled = !canGo;
    if (canGo) btn.addEventListener("click", () => load(r.target, r.verses));
    else btn.title = "Not ingested yet";
    wrap.appendChild(btn);

    const why = document.createElement("p");
    why.className = "cr-why";
    why.textContent = r.why || "";
    wrap.appendChild(why);

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.appendChild(tag(r.tradition));
    meta.appendChild(sourcesLine(r.sources));
    wrap.appendChild(meta);

    box.appendChild(wrap);
  }
}

function renderNotes(notes) {
  const box = el("notes");
  const block = el("notesBlock");
  box.innerHTML = "";
  if (!notes || !notes.length) {
    block.hidden = true;
    return;
  }
  block.hidden = false;
  for (const n of notes) {
    const wrap = document.createElement("div");
    wrap.className = "note";

    const claim = document.createElement("p");
    claim.className = "claim";
    claim.textContent = n.claim;
    wrap.appendChild(claim);

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.appendChild(tag(n.tradition));
    meta.appendChild(sourcesLine(n.sources));
    wrap.appendChild(meta);

    if (n.counterpoint) {
      const c = document.createElement("div");
      c.className = "counter";
      c.textContent = n.counterpoint.summary;
      const cmeta = document.createElement("div");
      cmeta.className = "meta";
      cmeta.appendChild(tag(n.counterpoint.tradition));
      cmeta.appendChild(sourcesLine(n.counterpoint.sources));
      c.appendChild(cmeta);
      wrap.appendChild(c);
    }
    box.appendChild(wrap);
  }
}

function renderChapter(c) {
  el("chapterTitle").textContent = `${c.book} ${c.chapter}`;
  const badge = el("canonBadge");
  badge.textContent = CANON_LABEL[c.canon] || c.canon;
  badge.hidden = c.canon === "protocanonical";

  const status = el("statusPill");
  const s = c.authoring && c.authoring.status;
  if (s && s !== "cleric-reviewed") {
    status.hidden = false;
    status.textContent = s === "placeholder" ? "Placeholder — layout demo" : s;
  } else {
    status.hidden = true;
  }

  renderVerses(c.verses);
  el("summary").textContent = c.summary || "Companion not authored yet.";
  el("summary").classList.toggle("muted", !c.summary);
  const list = el("takeaways");
  list.innerHTML = "";
  for (const t of c.takeaways || []) {
    const li = document.createElement("li");
    li.textContent = t;
    list.appendChild(li);
  }
  renderCrossRefs(c.crossRefs);
  renderNotes(c.interpretationNotes);

  el("layout").hidden = false;
  el("message").textContent = "";
  document.title = `${c.book} ${c.chapter} — Companion`;
}

function updateNav() {
  const i = allRefs.indexOf(currentRef);
  const prev = el("navPrev");
  const next = el("navNext");
  prev.hidden = next.hidden = false;
  prev.disabled = i <= 0;
  next.disabled = i < 0 || i >= allRefs.length - 1;
}

function navBy(delta) {
  const i = allRefs.indexOf(currentRef);
  if (i < 0) return;
  const target = allRefs[i + delta];
  if (target) load(target);
}

async function load(ref, verses) {
  try {
    const c = await api(`/api/chapter/${ref}`);
    el("bookSelect").value = c.book;
    await populateChapters(c.book);
    el("chapterSelect").value = ref;
    renderChapter(c);
    currentRef = ref;
    updateNav();
    const q = `?ref=${encodeURIComponent(ref)}` + (verses ? `&v=${encodeURIComponent(verses)}` : "");
    history.replaceState(null, "", q);
    if (verses) highlightVerses(verses);
    else window.scrollTo({ top: 0, behavior: "smooth" });
  } catch {
    el("layout").hidden = true;
    el("message").textContent = `Could not load ${ref}.`;
  }
}

async function populateChapters(book) {
  const { chapters } = await api(`/api/books/${encodeURIComponent(book)}/chapters`);
  const sel = el("chapterSelect");
  sel.innerHTML = "";
  for (const ch of chapters) {
    const opt = document.createElement("option");
    opt.value = ch.ref;
    opt.textContent = ch.chapter;
    sel.appendChild(opt);
  }
  const found = books.find((b) => b.book === book);
  if (found) found._refs = chapters.map((c) => c.ref);
}

async function init() {
  try {
    const data = await api("/api/books");
    books = data.books;
    if (!books.length) {
      el("message").textContent = 'No text yet. Run "npm run ingest -- MAT".';
      return;
    }
    const sel = el("bookSelect");
    for (const b of books) {
      const opt = document.createElement("option");
      opt.value = b.book;
      opt.textContent = b.book;
      sel.appendChild(opt);
    }
    for (const b of books) await populateChapters(b.book);
    allRefs = books.flatMap((b) => b._refs || []);

    sel.addEventListener("change", async () => {
      await populateChapters(sel.value);
      load(el("chapterSelect").value);
    });
    el("chapterSelect").addEventListener("change", () => load(el("chapterSelect").value));

    // on-screen arrows + keyboard (← / →) chapter navigation
    el("navPrev").addEventListener("click", () => navBy(-1));
    el("navNext").addEventListener("click", () => navBy(1));
    document.addEventListener("keydown", (e) => {
      const t = e.target.tagName;
      if (t === "SELECT" || t === "INPUT" || t === "TEXTAREA") return;
      if (e.key === "ArrowLeft") { e.preventDefault(); navBy(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); navBy(1); }
    });

    const params = new URLSearchParams(location.search);
    const wanted = params.get("ref");
    const wantedV = params.get("v");
    const known = new Set(books.flatMap((b) => b._refs || []));
    if (wanted && known.has(wanted)) load(wanted, wantedV);
    else load(books[0]._refs[0]);
  } catch {
    el("message").textContent = 'Server not reachable. Start it with "npm run dev".';
  }
}

init();
