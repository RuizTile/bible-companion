// Local web server using Node's built-in node:http — no express, no deps.
// Serves the static frontend + a small JSON API. The frontend only ever talks
// to /api/*, so moving this to a free personal host later (Cloudflare Workers,
// Fly, Render) changes nothing on the client. See docs/PRD.md §6/§8.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize, extname, sep } from "node:path";
import { getChapter, listBooks, listChapters, getIndex } from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");
const PORT = process.env.PORT || 3000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
};

function sendJson(res, status, obj) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

async function serveStatic(res, urlPath) {
  const rel = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = normalize(join(PUBLIC, rel));
  // path-traversal guard: resolved path must stay under PUBLIC
  if (filePath !== PUBLIC && !filePath.startsWith(PUBLIC + sep)) {
    res.writeHead(403);
    return res.end("forbidden");
  }
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "content-type": MIME[extname(filePath)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const p = decodeURIComponent(url.pathname);

  if (p === "/api/health") return sendJson(res, 200, { ok: true });
  if (p === "/api/index") return sendJson(res, 200, { books: getIndex() });
  if (p === "/api/books") return sendJson(res, 200, { books: listBooks() });

  let m = p.match(/^\/api\/books\/([^/]+)\/chapters$/);
  if (m) return sendJson(res, 200, { chapters: listChapters(m[1]) });

  m = p.match(/^\/api\/chapter\/([^/]+)$/);
  if (m) {
    const c = getChapter(m[1]);
    if (!c) return sendJson(res, 404, { error: "not_found", ref: m[1] });
    return sendJson(res, 200, c);
  }

  if (p.startsWith("/api/")) return sendJson(res, 404, { error: "not_found" });

  return serveStatic(res, p);
});

server.listen(PORT, () => {
  console.log(`Bible Companion → http://localhost:${PORT}`);
});
