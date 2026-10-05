// Docs site behaviour: theme, supplement toggle, full-text search, sidebar state.
const root = document.documentElement;
const ROOT_PREFIX = root.dataset.root || "";

function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode, file:// policies); the page still works.
  }
  return null;
}

const SUN =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>';
const MOON =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

function initTheme() {
  const button = document.querySelector(".theme-toggle-btn");
  if (!button) return;
  const paint = () => {
    button.innerHTML = root.dataset.theme === "dark" ? SUN : MOON;
  };
  paint();
  button.addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    store("theme", root.dataset.theme);
    paint();
  });
}

function initSupplementToggle() {
  const button = document.querySelector(".supp-toggle-btn");
  if (!button) return;
  if (!document.querySelector(".supp")) {
    button.hidden = true;
    return;
  }
  const paint = () => button.setAttribute("aria-pressed", String(root.dataset.supp !== "off"));
  paint();
  button.addEventListener("click", () => {
    if (root.dataset.supp === "off") delete root.dataset.supp;
    else root.dataset.supp = "off";
    store("supp", root.dataset.supp === "off" ? "off" : "on");
    paint();
  });
}

function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlight(text, tokens) {
  let html = escapeHtml(text);
  for (const token of tokens) {
    const pattern = escapeHtml(token).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    html = html.replace(new RegExp(pattern, "gi"), "<mark>$&</mark>");
  }
  return html;
}

function initSearch() {
  const backdrop = document.querySelector(".search-modal-backdrop");
  const input = document.querySelector(".search-modal-input");
  const results = document.querySelector(".search-results-list");
  if (!backdrop || !input || !results) return;
  let selected = 0;
  let loading = null;

  // The index is a plain script so search also works when opened from file://.
  const loadIndex = () => {
    if (window.SEARCH_INDEX) return Promise.resolve();
    loading ??= new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = `${ROOT_PREFIX}assets/search-index.js`;
      script.onload = resolve;
      script.onerror = resolve;
      document.head.appendChild(script);
    });
    return loading;
  };

  const render = () => {
    const tokens = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      results.innerHTML = '<div class="search-empty">輸入關鍵字搜尋全部文件內容，例如 worktree、權限、t3 serve</div>';
      return;
    }
    const matches = [];
    for (const entry of window.SEARCH_INDEX || []) {
      const heading = `${entry.p} ${entry.h}`.toLowerCase();
      const body = entry.x.toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (heading.includes(token)) score += 10;
        else if (body.includes(token)) score += 1;
        else {
          score = -1;
          break;
        }
      }
      if (score > 0) matches.push({ entry, score, at: body.indexOf(tokens[0]) });
    }
    matches.sort((a, b) => b.score - a.score);
    if (matches.length === 0) {
      results.innerHTML = '<div class="search-empty">找不到相符的內容</div>';
      return;
    }
    selected = 0;
    results.innerHTML = matches
      .slice(0, 30)
      .map(({ entry, at }, index) => {
        const start = Math.max(0, at - 30);
        const snippet = (start > 0 ? "…" : "") + entry.x.slice(start, start + 110) + "…";
        return `<a class="search-result-item${index === 0 ? " selected" : ""}" href="${ROOT_PREFIX}${entry.u}">
          <div class="search-result-page">${escapeHtml(entry.p)}</div>
          <div class="search-result-title">${highlight(entry.h || entry.p, tokens)}</div>
          <div class="search-result-snippet">${highlight(snippet, tokens)}</div>
        </a>`;
      })
      .join("");
  };

  const open = () => {
    backdrop.classList.add("open");
    input.value = "";
    render();
    input.focus();
    loadIndex().then(render);
  };
  const close = () => backdrop.classList.remove("open");
  const move = (delta) => {
    const items = results.querySelectorAll(".search-result-item");
    if (items.length === 0) return;
    items[selected]?.classList.remove("selected");
    selected = (selected + delta + items.length) % items.length;
    items[selected].classList.add("selected");
    items[selected].scrollIntoView({ block: "nearest" });
  };

  document.querySelectorAll(".search-trigger").forEach((trigger) => trigger.addEventListener("click", open));
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop || event.target.closest(".search-result-item")) close();
  });
  input.addEventListener("input", render);
  window.addEventListener("keydown", (event) => {
    const isOpen = backdrop.classList.contains("open");
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      isOpen ? close() : open();
    } else if (!isOpen) {
      return;
    } else if (event.key === "Escape") {
      close();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      move(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter" && !event.isComposing) {
      results.querySelectorAll(".search-result-item")[selected]?.click();
    }
  });
}

function initCopyCode() {
  document.querySelectorAll(".docs-article pre").forEach((pre) => {
    const button = document.createElement("button");
    button.className = "copy-code-btn";
    button.type = "button";
    button.textContent = "複製";
    button.addEventListener("click", () => {
      const code = pre.querySelector("code");
      navigator.clipboard.writeText(code ? code.innerText : pre.innerText).then(() => {
        button.textContent = "已複製";
        setTimeout(() => {
          button.textContent = "複製";
        }, 2000);
      });
    });
    pre.appendChild(button);
  });
}

function initSidebar() {
  const button = document.querySelector(".mobile-menu-btn");
  const sidebar = document.querySelector(".docs-sidebar");
  if (!sidebar) return;
  button?.addEventListener("click", () => sidebar.classList.toggle("open"));
  document.addEventListener("click", (event) => {
    if (!sidebar.contains(event.target) && !button?.contains(event.target)) sidebar.classList.remove("open");
  });
  // Remember which groups the reader opened; the current page's group always stays open.
  sidebar.querySelectorAll("details[data-group]").forEach((group) => {
    const key = `nav:${group.dataset.group}`;
    if (store(key) === "open") group.open = true;
    group.addEventListener("toggle", () => store(key, group.open ? "open" : "closed"));
  });
  sidebar.querySelector(".sidebar-link.active")?.scrollIntoView({ block: "nearest" });
}

function initScrollSpy() {
  const links = document.querySelectorAll(".toc-link");
  const headings = document.querySelectorAll(".docs-article h2[id], .docs-article h3[id]");
  if (links.length === 0 || headings.length === 0) return;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        links.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${entry.target.id}`));
      }
    },
    { rootMargin: "0px 0px -70% 0px" },
  );
  headings.forEach((heading) => observer.observe(heading));
}

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initSupplementToggle();
  initSearch();
  initCopyCode();
  initSidebar();
  initScrollSpy();
});
