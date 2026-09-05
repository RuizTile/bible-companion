// Client-side full-text search over authored chapters (summary + takeaways +
// verse text). Index is fetched once, lazily, and matched in memory —
// corpus is small enough (authored chapters only) that this stays instant.
const el = (id) => document.getElementById(id);

let index = null;
let indexPromise = null;

function loadIndex() {
  if (!indexPromise) {
    indexPromise = window.companionData.getSearchIndex().then((data) => {
      index = data;
      return data;
    });
  }
  return indexPromise;
}

function snippet(text, term) {
  const lower = text.toLowerCase();
  const i = term ? lower.indexOf(term) : -1;
  if (i === -1) return text.length > 200 ? `${text.slice(0, 200)}…` : text;
  const start = Math.max(0, i - 60);
  const end = Math.min(text.length, i + term.length + 120);
  return (start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "");
}

// Common words that appear in nearly every chapter's KJV text — counting
// them equally with content words would bury exact-phrase matches under
// chapters that just happen to be long.
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "in", "on", "to", "is", "it", "as",
  "at", "be", "by", "for", "not", "that", "this", "with", "his", "her",
  "he", "she", "him", "them", "they", "was", "were", "will", "shall",
]);

function search(query) {
  const phrase = query.toLowerCase().trim();
  const allTerms = phrase.split(/\s+/).filter(Boolean);
  if (!allTerms.length || !index) return [];
  const meaningful = allTerms.filter((t) => !STOPWORDS.has(t));
  const terms = meaningful.length ? meaningful : allTerms;

  const scored = [];
  for (const entry of index) {
    const lower = entry.text.toLowerCase();
    let score = 0;
    if (allTerms.length > 1 && lower.includes(phrase)) score += 1000;
    for (const term of terms) {
      let pos = lower.indexOf(term);
      while (pos !== -1) {
        score += 1;
        pos = lower.indexOf(term, pos + term.length);
      }
    }
    if (score > 0) scored.push({ entry, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 40);
}

function message(text) {
  const box = el("results");
  box.innerHTML = "";
  const p = document.createElement("p");
  p.className = "message";
  p.textContent = text;
  box.appendChild(p);
}

function render(results, query) {
  if (!results.length) {
    message(query ? "No matches." : "Type to search across every authored chapter.");
    return;
  }
  const box = el("results");
  box.innerHTML = "";
  const phrase = query.toLowerCase().trim();
  const firstTerm = phrase.split(/\s+/).filter((t) => !STOPWORDS.has(t))[0] || phrase.split(/\s+/)[0];
  for (const { entry } of results) {
    const a = document.createElement("a");
    a.className = "search-hit";
    a.href = `./read.html?ref=${encodeURIComponent(entry.ref)}`;

    const label = document.createElement("span");
    label.className = "hit-ref";
    label.textContent = entry.label;

    const snip = document.createElement("p");
    snip.className = "hit-snippet";
    const anchor = entry.text.toLowerCase().includes(phrase) ? phrase : firstTerm;
    snip.textContent = snippet(entry.text, anchor);

    a.appendChild(label);
    a.appendChild(snip);
    box.appendChild(a);
  }
}

async function init() {
  const input = el("searchInput");
  const params = new URLSearchParams(location.search);
  const q0 = params.get("q") || "";
  input.value = q0;

  message("Loading search index…");
  try {
    await loadIndex();
  } catch {
    message('Search index unavailable. Run "npm run build:data".');
    return;
  }
  render(search(q0), q0);

  input.addEventListener("input", () => {
    const q = input.value;
    const qs = q ? `?q=${encodeURIComponent(q)}` : location.pathname;
    history.replaceState(null, "", qs);
    render(search(q), q);
  });
  input.focus();
}

init();
