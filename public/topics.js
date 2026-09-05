// Topical index — browse authored chapters grouped by theme tag.
const el = (id) => document.getElementById(id);
let topicsData = null;

function renderTopicList(topics, active) {
  const box = el("topicList");
  box.innerHTML = "";
  const names = Object.keys(topics).sort(
    (a, b) => topics[b].length - topics[a].length || a.localeCompare(b),
  );
  for (const name of names) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `topic-chip${name === active ? " active" : ""}`;
    btn.textContent = `${name} (${topics[name].length})`;
    btn.addEventListener("click", () => selectTopic(name));
    box.appendChild(btn);
  }
}

function renderChapterList(entries, name) {
  const title = el("topicTitle");
  const box = el("topicChapters");
  box.innerHTML = "";
  if (!entries) {
    title.textContent = "";
    el("message").textContent = "Pick a topic to see every chapter tagged with it.";
    return;
  }
  title.textContent = name;
  el("message").textContent = "";
  for (const entry of entries) {
    const a = document.createElement("a");
    a.className = "begin-pill";
    a.href = `./read.html?ref=${encodeURIComponent(entry.ref)}`;

    const bk = document.createElement("span");
    bk.className = "bk";
    bk.textContent = entry.book;
    const ch = document.createElement("span");
    ch.className = "ch";
    ch.textContent = entry.chapter;

    a.appendChild(bk);
    a.appendChild(ch);
    box.appendChild(a);
  }
}

function selectTopic(name) {
  const qs = `?t=${encodeURIComponent(name)}`;
  history.replaceState(null, "", qs);
  renderTopicList(topicsData.topics, name);
  renderChapterList(topicsData.topics[name], name);
}

async function init() {
  try {
    topicsData = await window.companionData.getTopics();
  } catch {
    el("message").textContent = 'Topic index unavailable. Run "npm run build:data".';
    return;
  }
  renderTopicList(topicsData.topics, null);
  const params = new URLSearchParams(location.search);
  const wanted = params.get("t");
  if (wanted && topicsData.topics[wanted]) selectTopic(wanted);
  else renderChapterList(null);
}

init();
