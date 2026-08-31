// Swipe feed — vertical scroll-snap through chapters, Instagram/Reels-style.
// Virtualized: only a small window of chapters is ever mounted in the DOM;
// slides are appended/prepended on demand as the user nears an edge, using
// scroll position (not IntersectionObserver) since every slide is a fixed
// 100dvh, so activeIndex = firstIndex + round(scrollTop / slideHeight).
const el = (id) => document.getElementById(id);
const feed = el("feed");

const CANON_LABEL = {
  protocanonical: "Protocanonical",
  deuterocanonical: "Deuterocanonical",
  "kjv-apocrypha-only": "KJV Apocrypha (not Catholic canon)",
};

let allRefs = [];              // every ref, canonical order
let metaByRef = new Map();     // ref -> { book, chapter, canon, status }
let mountedRefs = [];          // refs currently in the DOM, in order
let firstIndex = -1;           // index into allRefs of mountedRefs[0]
let activeIndex = -1;
let activeRef = null;
const slideEls = new Map();    // ref -> section element
const chapterCache = new Map();// ref -> chapter JSON (or in-flight promise)

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

function loadChapter(ref) {
  if (!chapterCache.has(ref)) {
    chapterCache.set(ref, window.companionData.getChapter(ref).catch(() => null));
  }
  return chapterCache.get(ref);
}

function slideHeight() {
  return feed.clientHeight || window.innerHeight;
}

// ---------- slide DOM ----------

function makeSkeleton(ref) {
  const meta = metaByRef.get(ref) || {};
  const section = document.createElement("section");
  section.className = "slide";
  section.id = `slide-${ref}`;
  section.dataset.ref = ref;
  section.innerHTML = `
    <div class="slide-head">
      <h2>${meta.book || ref} ${meta.chapter || ""}</h2>
      <span class="badge canonBadge" hidden></span>
    </div>
    <div class="slide-body">
      <p class="summary muted">Loading…</p>
    </div>
  `;
  return section;
}

function renderVerses(container, verses) {
  container.innerHTML = "";
  for (const v of verses) {
    const span = document.createElement("span");
    span.className = "verse";
    span.dataset.vn = v.n;
    span.innerHTML = `<span class="vnum">${v.n}</span>`;
    span.appendChild(document.createTextNode(v.text + " "));
    container.appendChild(span);
  }
}

function renderCrossRefs(box, refs) {
  box.innerHTML = "";
  if (!refs || !refs.length) return;
  for (const r of refs) {
    const wrap = document.createElement("div");
    wrap.className = "crossref";

    const btn = document.createElement("button");
    btn.className = "cr-label";
    btn.textContent = r.label || r.target;
    const canGo = metaByRef.has(r.target);
    btn.disabled = !canGo;
    if (canGo) btn.addEventListener("click", () => jumpTo(r.target, r.verses));
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

function renderNotes(box, notes) {
  box.innerHTML = "";
  if (!notes || !notes.length) return;
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

function populateSlide(section, c) {
  const badge = section.querySelector(".canonBadge");
  badge.textContent = CANON_LABEL[c.canon] || c.canon;
  badge.hidden = c.canon === "protocanonical";

  const status = c.authoring && c.authoring.status;
  const pill = status && status !== "cleric-reviewed"
    ? `<span class="pill">${status === "placeholder" ? "Placeholder — layout demo" : status}</span>`
    : "";

  const hasCompanion = !!c.summary;
  section.querySelector(".slide-body").innerHTML = `
    ${pill}
    <p class="summary${hasCompanion ? "" : " muted"}">${hasCompanion ? c.summary : "Companion not authored yet."}</p>
    ${(c.takeaways || []).length ? `
      <div class="block">
        <h3>Takeaways</h3>
        <ol class="takeaways"></ol>
      </div>` : ""}
    <details class="verses-fold" open>
      <summary>Read the chapter</summary>
      <div class="verses"></div>
    </details>
    ${(c.crossRefs || []).length ? `
      <div class="block">
        <h3>Connections</h3>
        <div class="crossrefs"></div>
      </div>` : ""}
    ${(c.interpretationNotes || []).length ? `
      <div class="block">
        <h3>Interpretation</h3>
        <div class="notes"></div>
      </div>` : ""}
    <p class="feed-foot">Catholic-oriented, not Catholic-approved. Every interpretation is attributed; traditions are labeled.</p>
  `;

  const list = section.querySelector(".takeaways");
  if (list) for (const t of c.takeaways || []) {
    const li = document.createElement("li");
    li.textContent = t;
    list.appendChild(li);
  }
  renderVerses(section.querySelector(".verses"), c.verses);
  const crBox = section.querySelector(".crossrefs");
  if (crBox) renderCrossRefs(crBox, c.crossRefs);
  const notesBox = section.querySelector(".notes");
  if (notesBox) renderNotes(notesBox, c.interpretationNotes);
}

async function fillSlide(ref, section) {
  const c = await loadChapter(ref);
  if (!c) {
    section.querySelector(".slide-body").innerHTML = `<p class="summary muted">Could not load ${ref}.</p>`;
    return;
  }
  populateSlide(section, c);
}

// ---------- window management ----------

function appendOne() {
  const idx = firstIndex + mountedRefs.length;
  if (idx >= allRefs.length) return;
  const ref = allRefs[idx];
  const section = makeSkeleton(ref);
  feed.appendChild(section);
  slideEls.set(ref, section);
  mountedRefs.push(ref);
  fillSlide(ref, section);
}

function prependOne() {
  if (firstIndex <= 0) return;
  const idx = firstIndex - 1;
  const ref = allRefs[idx];
  const section = makeSkeleton(ref);
  feed.insertBefore(section, feed.firstChild);
  slideEls.set(ref, section);
  mountedRefs.unshift(ref);
  firstIndex = idx;
  feed.scrollTop += slideHeight(); // compensate so the visible slide doesn't shift
  fillSlide(ref, section);
}

function setActive(idx) {
  if (idx === activeIndex) return;
  activeIndex = idx;
  activeRef = allRefs[idx];
  const q = `?ref=${encodeURIComponent(activeRef)}`;
  history.replaceState(null, "", q);
  const meta = metaByRef.get(activeRef);
  if (meta) document.title = `${meta.book} ${meta.chapter} — Companion`;
  const desk = el("deskLink");
  if (desk) desk.href = `./read.html?ref=${encodeURIComponent(activeRef)}`;
}

function onScroll() {
  const H = slideHeight();
  if (!H || !mountedRefs.length) return;
  const rawIdx = Math.round(feed.scrollTop / H);
  const clamped = Math.max(0, Math.min(mountedRefs.length - 1, rawIdx));
  setActive(firstIndex + clamped);

  if (clamped <= 0) prependOne();
  if (clamped >= mountedRefs.length - 1) appendOne();
}

let scrollTicking = false;
feed.addEventListener("scroll", () => {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(() => {
    onScroll();
    scrollTicking = false;
  });
});

function goBy(delta) {
  feed.scrollTo({ top: feed.scrollTop + delta * slideHeight(), behavior: "smooth" });
}
el("navUp").addEventListener("click", () => goBy(-1));
el("navDown").addEventListener("click", () => goBy(1));
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); goBy(-1); }
  else if (e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); goBy(1); }
});

// Rebuild the mounted window around a target ref (used for cross-ref jumps
// that land outside the currently mounted range) and highlight cited verses.
async function jumpTo(ref, verses) {
  const targetIdx = allRefs.indexOf(ref);
  if (targetIdx < 0) return;

  if (!slideEls.has(ref)) {
    feed.innerHTML = "";
    slideEls.clear();
    mountedRefs = [];
    const start = Math.max(0, targetIdx - 1);
    const end = Math.min(allRefs.length - 1, targetIdx + 2);
    firstIndex = start;
    for (let i = start; i <= end; i++) {
      const r = allRefs[i];
      const section = makeSkeleton(r);
      feed.appendChild(section);
      slideEls.set(r, section);
      mountedRefs.push(r);
      fillSlide(r, section);
    }
    feed.scrollTop = (targetIdx - firstIndex) * slideHeight();
    activeIndex = -1; // force setActive to run
  } else {
    feed.scrollTo({ top: (targetIdx - firstIndex) * slideHeight(), behavior: "smooth" });
  }
  setActive(targetIdx);

  if (verses) {
    await loadChapter(ref);
    const section = slideEls.get(ref);
    const nums = parseVerses(verses);
    let first = null;
    section.querySelectorAll(".verse.hl").forEach((n) => n.classList.remove("hl"));
    for (const n of nums) {
      const span = section.querySelector(`[data-vn="${n}"]`);
      if (!span) continue;
      span.classList.add("hl");
      if (!first) first = span;
    }
    if (first) {
      setTimeout(() => {
        // Scroll only the slide's own internal container, not scrollIntoView
        // (which would also nudge the outer snap feed and break alignment).
        // offsetTop is unreliable here (resolves against the nearest positioned
        // ancestor, not necessarily this scroll container), so use rendered
        // rects instead.
        const sectionRect = section.getBoundingClientRect();
        const verseRect = first.getBoundingClientRect();
        const delta = (verseRect.top - sectionRect.top) - section.clientHeight / 2 + verseRect.height / 2;
        section.scrollTo({ top: section.scrollTop + delta, behavior: "smooth" });
      }, 350);
    }
  }
}

// ---------- init ----------

async function init() {
  try {
    const { books } = await window.companionData.getIndex();
    if (!books.length) {
      el("message").hidden = false;
      el("message").textContent = 'No text yet. Run "npm run ingest -- MAT".';
      return;
    }
    for (const b of books) {
      for (const c of b.chapters) {
        allRefs.push(c.ref);
        metaByRef.set(c.ref, { book: b.book, chapter: c.chapter, canon: b.canon, status: c.status });
      }
    }

    const params = new URLSearchParams(location.search);
    const wanted = params.get("ref");
    const startIdx = wanted && metaByRef.has(wanted) ? allRefs.indexOf(wanted) : 0;

    const start = Math.max(0, startIdx - 1);
    const end = Math.min(allRefs.length - 1, startIdx + 2);
    firstIndex = start;
    for (let i = start; i <= end; i++) {
      const ref = allRefs[i];
      const section = makeSkeleton(ref);
      feed.appendChild(section);
      slideEls.set(ref, section);
      mountedRefs.push(ref);
      fillSlide(ref, section);
    }

    requestAnimationFrame(() => {
      feed.scrollTop = (startIdx - firstIndex) * slideHeight();
      setActive(startIdx);
    });
  } catch {
    el("message").hidden = false;
    el("message").textContent = 'Chapter data unavailable. Run "npm run build:data".';
  }
}

init();
