// Reading progress + last-read pointer. Per-viewer, localStorage only —
// nothing here reaches a server.
(function () {
  "use strict";

  const READ_KEY = "companion.read.v1";
  const LAST_KEY = "companion.lastRead.v1";

  function readSet() {
    try {
      const raw = localStorage.getItem(READ_KEY);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch (e) {
      return new Set();
    }
  }

  function saveSet(set) {
    try {
      localStorage.setItem(READ_KEY, JSON.stringify([...set]));
    } catch (e) {}
  }

  function isRead(ref) {
    return readSet().has(ref);
  }

  function markRead(ref) {
    const set = readSet();
    if (set.has(ref)) return;
    set.add(ref);
    saveSet(set);
  }

  function markUnread(ref) {
    const set = readSet();
    if (!set.has(ref)) return;
    set.delete(ref);
    saveSet(set);
  }

  function toggleRead(ref) {
    if (isRead(ref)) {
      markUnread(ref);
      return false;
    }
    markRead(ref);
    return true;
  }

  function getLastRead() {
    try {
      const raw = localStorage.getItem(LAST_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setLastRead(entry) {
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify(entry));
    } catch (e) {}
  }

  window.companionProgress = Object.freeze({
    readSet,
    isRead,
    markRead,
    markUnread,
    toggleRead,
    getLastRead,
    setLastRead,
  });
}());
