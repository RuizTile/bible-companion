// Static data adapter. One small manifest loads first; full chapter records
// load once per book and remain cached for this page session.
(function () {
  "use strict";

  const dataRoot = new URL("./data/", document.baseURI);
  const bookCache = new Map();
  let indexPromise;
  let topicsPromise;
  let searchPromise;

  async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    return response.json();
  }

  function getIndex() {
    if (!indexPromise) indexPromise = fetchJson(new URL("index.json", dataRoot));
    return indexPromise;
  }

  function loadBook(code) {
    if (!bookCache.has(code)) {
      const url = new URL(`books/${encodeURIComponent(code)}.json`, dataRoot);
      bookCache.set(code, fetchJson(url).catch((error) => {
        bookCache.delete(code);
        throw error;
      }));
    }
    return bookCache.get(code);
  }

  async function getBooks() {
    const { books } = await getIndex();
    return {
      books: books.map(({ code, book, canon, total }) => ({
        code,
        book,
        canon,
        chapters: total,
      })),
    };
  }

  async function getChapters(bookName) {
    const { books } = await getIndex();
    const book = books.find((candidate) => candidate.book === bookName);
    if (!book) throw new Error(`Unknown book: ${bookName}`);
    return { chapters: book.chapters.map(({ ref, chapter }) => ({ ref, chapter })) };
  }

  async function getChapter(ref) {
    const { books } = await getIndex();
    const book = books.find((candidate) => candidate.chapters.some((chapter) => chapter.ref === ref));
    if (!book) throw new Error(`Unknown chapter: ${ref}`);
    const payload = await loadBook(book.code);
    const chapter = payload.chapters.find((candidate) => candidate.ref === ref);
    if (!chapter) throw new Error(`Missing chapter payload: ${ref}`);
    return chapter;
  }

  function getTopics() {
    if (!topicsPromise) topicsPromise = fetchJson(new URL("topics.json", dataRoot));
    return topicsPromise;
  }

  function getSearchIndex() {
    if (!searchPromise) searchPromise = fetchJson(new URL("search-index.json", dataRoot));
    return searchPromise;
  }

  window.companionData = Object.freeze({
    getIndex,
    getBooks,
    getChapters,
    getChapter,
    getTopics,
    getSearchIndex,
  });
}());
