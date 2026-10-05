#!/usr/bin/env node
// Builds the zh-TW docs site from content/ into dist/.
//
// The translation is checked against a checkout of the upstream repository:
// T3CODE_REPO points at it (default: ../t3code next to this folder). The
// commit the content was translated from is in site.config.mjs.
//
//   node build.mjs            build dist/
//   node build.mjs status     list docs/ files that are untranslated or stale
//   node build.mjs stamp <content file...>   record the current source hash

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { escapeHtml, renderMarkdown } from "./lib/markdown.mjs";
import config from "./site.config.mjs";

const SITE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(process.env.T3CODE_REPO || path.join(SITE, "..", "t3code"));
const CONTENT = path.join(SITE, "content");
const DIST = path.join(SITE, "dist");
const SHOTS = path.join(SITE, "screenshots");
const GLOSSARY = "guide/glossary";
const SHOT_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"];
const SUPPLEMENTS = { example: "範例", note: "補充說明", plain: "白話解釋" };
const CALLOUTS = { warning: "注意", tip: "提示" };

const posix = path.posix;
const DISCLAIMER =
  "非官方翻譯，與 T3 Code 的維護者無關。內容由 AI 翻譯並補充，未經逐頁人工校對，可能有錯誤或已經過時，請以英文原文為準。";

const warnings = [];
const missingShots = [];

function walk(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, base);
    return entry.name.endsWith(".md") ? [path.relative(base, full).split(path.sep).join("/")] : [];
  });
}

function blobHash(file) {
  const data = fs.readFileSync(file);
  return createHash("sha1").update(`blob ${data.length}\0`).update(data).digest("hex");
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { meta: {}, body: raw };
  const meta = {};
  for (const line of match[1].split("\n")) {
    const pair = line.match(/^(\w+):\s*(.*)$/);
    if (pair) meta[pair[1]] = pair[2].trim();
  }
  return { meta, body: raw.slice(match[0].length) };
}

function git(...args) {
  try {
    return execFileSync("git", ["-C", REPO, ...args], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function requireUpstream() {
  if (fs.existsSync(path.join(REPO, "docs"))) return;
  console.error(`找不到 upstream 的 docs/：${REPO}\n請把 T3CODE_REPO 指到 pingdotgg/t3code 的 checkout（譯文依據的版本是 ${config.upstream}）。`);
  process.exit(1);
}

function loadPages() {
  return walk(CONTENT).map((file) => {
    const { meta, body } = parseFrontmatter(fs.readFileSync(path.join(CONTENT, file), "utf8"));
    const slug = file.replace(/\.md$/, "");
    const source = meta.source || null;
    let stale = false;
    if (source) {
      const sourceFile = path.join(REPO, source);
      if (!fs.existsSync(sourceFile)) warnings.push(`${file}: 原文 ${source} 已不存在`);
      else stale = blobHash(sourceFile) !== meta.source_hash;
    }
    return {
      file,
      slug,
      url: `${slug}.html`,
      title: meta.title || slug,
      nav: meta.nav || meta.title || slug,
      lead: meta.lead || "",
      source,
      sourceHash: meta.source_hash || "",
      stale,
      body,
    };
  });
}

function status() {
  requireUpstream();
  const pages = loadPages();
  const bySource = new Map(pages.filter((page) => page.source).map((page) => [page.source, page]));
  const sources = walk(path.join(REPO, "docs")).map((file) => `docs/${file}`);
  const untranslated = sources.filter((source) => !bySource.has(source));
  const stale = pages.filter((page) => page.stale);
  console.log(`原文 ${sources.length} 份，已翻譯 ${sources.length - untranslated.length} 份`);
  if (stale.length) console.log(`\n原文已更新、譯文待同步（${stale.length}）：`);
  for (const page of stale) console.log(`  content/${page.file}  <-  ${page.source}`);
  if (untranslated.length) console.log(`\n尚未翻譯（${untranslated.length}）：`);
  for (const source of untranslated) console.log(`  ${source}`);
  for (const warning of warnings) console.log(`警告：${warning}`);
}

function stamp(files) {
  for (const input of files) {
    const file = path.resolve(input);
    const raw = fs.readFileSync(file, "utf8");
    const { meta } = parseFrontmatter(raw);
    if (!meta.source) {
      console.log(`略過 ${input}（沒有 source）`);
      continue;
    }
    const hash = blobHash(path.join(REPO, meta.source));
    const next = /^source_hash:.*$/m.test(raw)
      ? raw.replace(/^source_hash:.*$/m, `source_hash: ${hash}`)
      : raw.replace(/^(source:.*)$/m, `$1\nsource_hash: ${hash}`);
    fs.writeFileSync(file, next);
    console.log(`${input} -> ${hash.slice(0, 10)}`);
  }
}

// Terms come from the newcomer glossary: every `### Term {#id}` heading plus
// the first paragraph under it.
function loadTerms(pages) {
  const glossary = pages.find((page) => page.slug === GLOSSARY);
  if (!glossary) return [];
  const terms = [];
  const pattern = /^### (.+?)\s*\{#([\w-]+)\}\n+([^\n]+)/gm;
  for (const match of glossary.body.matchAll(pattern)) {
    const names = match[1].split(/[（(]/)[0].split(" / ");
    const tip = match[3].replace(/[`*]/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
    for (const name of names) terms.push({ name: name.trim(), id: match[2], tip });
  }
  return terms.sort((a, b) => b.name.length - a.name.length);
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function linkTerms(html, terms, glossaryHref) {
  const seen = new Set();
  const skipTags = /^<(\/?)(a|code|pre|h[1-6]|figure|button)\b/i;
  let depth = 0;
  return html
    .split(/(<[^>]+>)/)
    .map((part) => {
      if (part.startsWith("<")) {
        const tag = part.match(skipTags);
        if (tag) depth += tag[1] ? -1 : 1;
        return part;
      }
      if (depth > 0 || !part.trim()) return part;
      const hits = [];
      for (const term of terms) {
        if (seen.has(term.id)) continue;
        const found = new RegExp(`(?<![A-Za-z0-9_-])${escapeRegExp(term.name)}(?![A-Za-z0-9_-])`, "i").exec(part);
        if (found) hits.push({ term, start: found.index, end: found.index + found[0].length });
      }
      hits.sort((a, b) => a.start - b.start || b.end - a.end);
      let cursor = 0;
      let out = "";
      for (const hit of hits) {
        if (hit.start < cursor || seen.has(hit.term.id)) continue;
        seen.add(hit.term.id);
        out += `${part.slice(cursor, hit.start)}<a class="term" href="${glossaryHref}#${hit.term.id}" title="${escapeHtml(hit.term.tip)}">${part.slice(hit.start, hit.end)}</a>`;
        cursor = hit.end;
      }
      return out + part.slice(cursor);
    })
    .join("");
}

function sidebarGroups(pages) {
  const bySlug = new Map(pages.map((page) => [page.slug, page]));
  return config.groups
    .map((group) => {
      const listed = group.order.filter((slug) => bySlug.has(slug));
      const rest = pages
        .map((page) => page.slug)
        .filter((slug) => slug.startsWith(`${group.dir}/`) && !group.order.includes(slug))
        .sort();
      return { ...group, pages: [...listed, ...rest].map((slug) => bySlug.get(slug)) };
    })
    .filter((group) => group.pages.length > 0);
}

function build() {
  requireUpstream();
  const pages = loadPages();
  const bySlug = new Map(pages.map((page) => [page.slug, page]));
  const groups = sidebarGroups(pages);
  const ordered = groups.flatMap((group) => group.pages);
  const terms = loadTerms(pages);
  const head = git("log", "-1", "--format=%h %cs");
  const searchIndex = [];
  const anchorChecks = [];

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(path.join(DIST, "assets"), { recursive: true });
  const theme = (name) => fs.readFileSync(path.join(SITE, "theme", name), "utf8");
  fs.writeFileSync(path.join(DIST, "assets", "style.css"), theme("base.css") + theme("site.css"));
  fs.copyFileSync(path.join(SITE, "theme", "app.js"), path.join(DIST, "assets", "app.js"));

  for (const page of pages) {
    const root = "../".repeat(page.slug.split("/").length - 1);
    const virtualDir = posix.dirname(`docs/${page.file}`);
    const blob = (target) => `${config.repo}/blob/${config.branch}/${target}`;

    const resolveLink = (href) => {
      if (/^(https?:|mailto:)/.test(href)) return { href, external: true };
      if (href.startsWith("#")) {
        anchorChecks.push({ from: page, to: page, hash: href.slice(1) });
        return { href };
      }
      const [target, hash = ""] = href.split("#");
      const resolved = posix.normalize(posix.join(virtualDir, target));
      const suffix = hash ? `#${hash}` : "";
      if (resolved === "docs/README.md" || /^docs(\/[\w-]+)?\/?$/.test(resolved)) return { href: `${root}index.html` };
      if (resolved.startsWith("docs/") && resolved.endsWith(".md")) {
        const translated = bySlug.get(resolved.slice(5, -3));
        if (translated) {
          if (hash) anchorChecks.push({ from: page, to: translated, hash });
          return { href: `${root}${translated.url}${suffix}` };
        }
        return { href: `${blob(resolved)}${suffix}`, external: true, className: "untranslated" };
      }
      if (resolved.startsWith("..")) {
        warnings.push(`${page.file}: 連結超出專案範圍 ${href}`);
        return { href };
      }
      const full = path.join(REPO, resolved);
      if (!fs.existsSync(full)) warnings.push(`${page.file}: 連結目標不存在 ${href}`);
      const kind = fs.existsSync(full) && fs.statSync(full).isDirectory() ? "tree" : "blob";
      return { href: `${config.repo}/${kind}/${config.branch}/${resolved}${suffix}`, external: true };
    };

    const container = ({ kind, title, lines, render, inline }) => {
      if (kind === "screenshot") {
        const caption = render(lines);
        const extension = SHOT_EXTENSIONS.find((ext) => fs.existsSync(path.join(SHOTS, `${title}.${ext}`)));
        if (!extension) {
          // Left out of the page until the image exists; the build log lists them.
          missingShots.push({ id: title, page: page.file });
          return "";
        }
        fs.mkdirSync(path.join(DIST, "screenshots"), { recursive: true });
        fs.copyFileSync(path.join(SHOTS, `${title}.${extension}`), path.join(DIST, "screenshots", `${title}.${extension}`));
        return `<figure class="shot"><img src="${root}screenshots/${title}.${extension}" alt="${escapeHtml(caption.replace(/<[^>]+>/g, ""))}" loading="lazy"><figcaption>${caption}</figcaption></figure>`;
      }
      if (kind === "track") {
        return `<section class="track-card"><h2>${inline(title)}</h2>${render(lines)}</section>`;
      }
      if (SUPPLEMENTS[kind]) {
        const heading = title ? `<span class="supp-title">${inline(title)}</span>` : "";
        return `<aside class="supp supp-${kind}"><div class="supp-header"><span class="supp-kind">${SUPPLEMENTS[kind]}</span>${heading}<span class="supp-badge" title="這一塊是本站加上的說明，不在官方英文文件裡">本站補充</span></div>${render(lines)}</aside>`;
      }
      if (CALLOUTS[kind]) {
        return `<div class="callout ${kind}"><div class="callout-header">${title ? inline(title) : CALLOUTS[kind]}</div>${render(lines)}</div>`;
      }
      warnings.push(`${page.file}: 未知的區塊類型 :::${kind}`);
      return render(lines);
    };

    const rendered = renderMarkdown(page.body, { resolveLink, container });
    page.headings = rendered.headings;
    page.root = root;
    page.html = rendered.html.replace(/<h1>[\s\S]*?<\/h1>\n?/, "");

    if (page.slug !== "index") {
      const sections = page.html.split(/(?=<h[23] id=")/);
      for (const section of sections) {
        const heading = section.match(/^<h[23] id="([^"]+)">([\s\S]*?)<a class="heading-anchor"/);
        const text = section
          .replace(/<a class="heading-anchor"[\s\S]*?<\/a>/g, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, "&")
          .replace(/\s+/g, " ")
          .trim();
        if (!text) continue;
        searchIndex.push({
          u: page.url + (heading ? `#${heading[1]}` : ""),
          p: page.title,
          h: heading ? heading[2].replace(/<[^>]+>/g, "") : "",
          x: text,
        });
      }
    }
    if (page.slug !== GLOSSARY && bySlug.has(GLOSSARY)) {
      page.html = linkTerms(page.html, terms, `${root}${GLOSSARY}.html`);
    }
  }

  for (const check of anchorChecks) {
    if (!check.to.headings.some((heading) => heading.id === check.hash)) {
      warnings.push(`${check.from.file}: 找不到錨點 ${check.to.file}#${check.hash}`);
    }
  }

  const sidebar = (current) =>
    `<a href="${current.root}index.html" class="sidebar-link sidebar-home${current.slug === "index" ? " active" : ""}">文件首頁</a>` +
    groups
      .map((group) => {
        const open = group.pages.includes(current) || current.slug === "index" ? " open" : "";
        const note = group.note ? `<span class="sidebar-group-note">${group.note}</span>` : "";
        const links = group.pages
          .map(
            (page) =>
              `<a href="${current.root}${page.url}" class="sidebar-link${page === current ? " active" : ""}">${escapeHtml(page.nav)}</a>`,
          )
          .join("");
        return `<details class="sidebar-nav-group" data-group="${group.dir}"${open}><summary class="sidebar-group-title">${group.title}${note}</summary>${links}</details>`;
      })
      .join("");

  const siteFooter = `<footer class="site-footer"><p>${DISCLAIMER}</p><p>原文 © T3 Tools Inc.，以 MIT 授權釋出；本站為其<a href="${config.repo}" target="_blank" rel="noopener">官方 repository</a> 中 docs/ 的翻譯。<a href="${config.site}" target="_blank" rel="noopener">本站原始碼與問題回報</a></p></footer>`;

  const layout = (page, main) => `<!DOCTYPE html>
<html lang="zh-Hant-TW" data-root="${page.root}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(page.slug === "index" ? config.title : `${page.title} · ${config.title}`)}</title>
<script>(function(){try{var d=document.documentElement,t=localStorage.getItem("theme");d.dataset.theme=t||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");if(localStorage.getItem("supp")==="off")d.dataset.supp="off"}catch(e){}})()</script>
<link rel="stylesheet" href="${page.root}assets/style.css">
</head>
<body>
<header class="site-header">
  <div class="brand-wrapper">
    <button class="mobile-menu-btn" aria-label="開啟選單">☰</button>
    <a class="brand-link" href="${page.root}index.html"><span class="brand-logo">T3</span><span class="brand-title">T3 Code</span><span class="brand-badge">中文文件・非官方</span></a>
  </div>
  <div class="header-actions">
    <button class="search-trigger" type="button"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><span>搜尋文件</span><span class="search-shortcut">Ctrl K</span></button>
    <button class="supp-toggle-btn" type="button" aria-pressed="true" title="顯示或隱藏本站加上的範例與說明">補充</button>
    <button class="theme-toggle-btn" type="button" aria-label="切換深淺色"></button>
  </div>
</header>
<div class="docs-container">
<aside class="docs-sidebar">${sidebar(page)}</aside>
${main.replace("</main>", `${siteFooter}</main>`)}
</div>
<div class="search-modal-backdrop"><div class="search-modal-content">
  <div class="search-input-header"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input type="text" class="search-modal-input" placeholder="輸入關鍵字，可用空白分隔多個詞"></div>
  <div class="search-results-list"></div>
</div></div>
<script src="${page.root}assets/app.js"></script>
</body>
</html>
`;

  for (const page of pages) {
    let main;
    if (page.slug === "index") {
      main = `<main class="docs-content home"><section class="hero-section"><h1 class="hero-title">${escapeHtml(page.title)}</h1><p class="hero-desc">${escapeHtml(page.lead)}</p></section><div class="callout warning"><div class="callout-header">閱讀前請留意</div><p>${DISCLAIMER}</p></div><article class="docs-article">${page.html}</article><p class="build-note">依據 upstream <code>${escapeHtml(head)}</code> 的 docs/ 翻譯。T3 Code 還在早期版本，變動很快，之後的改動不一定已經反映在這裡。</p></main>`;
    } else {
      const group = groups.find((entry) => entry.pages.includes(page));
      const index = ordered.indexOf(page);
      const previous = index > 0 ? ordered[index - 1] : null;
      const next = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : null;
      const toc = page.headings.filter((heading) => heading.level === 2 || heading.level === 3);
      const sourceNote = page.source
        ? `本頁譯自 <a href="${config.repo}/blob/${config.branch}/${page.source}" target="_blank" rel="noopener">${page.source}</a>（英文原文，版本 <code>${page.sourceHash.slice(0, 7) || "未記錄"}</code>）。標示「本站補充」的區塊不在原文裡。`
        : "本頁是本站自行撰寫的新手內容，不是官方文件的翻譯。";
      const staleBanner = page.stale
        ? `<div class="callout warning"><div class="callout-header">英文原文已更新</div><p>這一頁的譯文還沒跟上最新原文，內容可能有出入，請以<a href="${config.repo}/blob/${config.branch}/${page.source}" target="_blank" rel="noopener">英文原文</a>為準。</p></div>`
        : "";
      main = `<main class="docs-content">
<nav class="breadcrumb"><a href="${page.root}index.html">首頁</a><span>›</span><span>${group ? group.title : ""}</span></nav>
<article class="docs-article">
<h1>${escapeHtml(page.title)}</h1>
${staleBanner}${page.html}
<p class="page-source">${sourceNote}</p>
<div class="page-navigation">
${previous ? `<div class="page-nav-link"><span class="page-nav-label">上一篇</span><a href="${page.root}${previous.url}" class="page-nav-title">← ${escapeHtml(previous.nav)}</a></div>` : ""}
${next ? `<div class="page-nav-link next"><span class="page-nav-label">下一篇</span><a href="${page.root}${next.url}" class="page-nav-title">${escapeHtml(next.nav)} →</a></div>` : ""}
</div>
</article>
</main>
${toc.length > 1 ? `<aside class="docs-toc"><div class="toc-title">本頁目錄</div>${toc.map((heading) => `<a href="#${heading.id}" class="toc-link toc-level-${heading.level}">${escapeHtml(heading.text)}</a>`).join("")}</aside>` : ""}`;
    }
    const output = path.join(DIST, page.url);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, layout(page, main));
  }

  fs.writeFileSync(path.join(DIST, "assets", "search-index.js"), `window.SEARCH_INDEX=${JSON.stringify(searchIndex)};`);

  if (head && !config.upstream.startsWith(head.split(" ")[0])) {
    warnings.push(`upstream 目前在 ${head}，與 site.config.mjs 記錄的 ${config.upstream.slice(0, 10)} 不同`);
  }
  console.log(`已產生 ${pages.length} 頁 -> ${path.relative(process.cwd(), DIST) || "."}`);
  const stale = pages.filter((page) => page.stale);
  if (stale.length) console.log(`原文已更新、譯文待同步：${stale.map((page) => page.file).join(", ")}`);
  if (missingShots.length) {
    console.log(`待補截圖（目前不顯示；放進 screenshots/<名稱>.png 後重新建置）：`);
    for (const shot of missingShots) console.log(`  ${shot.id}  (${shot.page})`);
  }
  for (const warning of warnings) console.log(`警告：${warning}`);
}

const [command, ...rest] = process.argv.slice(2);
if (command === "status") status();
else if (command === "stamp") stamp(rest);
else build();
