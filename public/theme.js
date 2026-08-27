// Shared light/dark theme toggle. The no-flash initial set happens inline in
// each page's <head>; this only wires the toggle button(s) and persists choice.
(function () {
  const root = document.documentElement;
  const current = () => (root.dataset.theme === "dark" ? "dark" : "light");

  function sync(theme) {
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      btn.textContent = theme === "dark" ? "☀" : "☾";
      btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
      btn.title = theme === "dark" ? "Switch to light" : "Switch to dark";
    });
  }

  function apply(theme) {
    root.dataset.theme = theme;
    try { localStorage.setItem("theme", theme); } catch (e) {}
    sync(theme);
  }

  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => apply(current() === "dark" ? "light" : "dark"));
  });
  sync(current());
})();
