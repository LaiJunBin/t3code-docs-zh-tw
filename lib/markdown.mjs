// Small dependency-free Markdown renderer covering what docs/ uses: headings,
// paragraphs, nested lists, tables, fenced code, blockquotes, rules, inline
// formatting, plus `:::kind title` containers for the site's own blocks.

const CJK = "\\u3000-\\u303f\\u3400-\\u9fff\\uff00-\\uffef";
const CJK_JOIN = new RegExp(`([${CJK}])\\n(?=[${CJK}])`, "g");

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(new RegExp(`[^a-z0-9${CJK}\\s-]`, "g"), "")
    .trim()
    .replace(/\s+/g, "-");
}

const FENCE = /^(\s*)(`{3,}|~{3,})\s*([\w+-]*)\s*$/;
const CONTAINER_OPEN = /^:::\s*([a-z]+)\s*(.*)$/;
const CONTAINER_CLOSE = /^:::\s*$/;
const HEADING = /^(#{1,6})\s+(.*?)\s*(?:\{#([\w-]+)\})?\s*$/;
const RULE = /^\s*(-{3,}|\*{3,})\s*$/;
const QUOTE = /^\s*>\s?/;
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])(\s+)(.*)$/;
const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

const indentOf = (line) => line.match(/^\s*/)[0].length;

function splitRow(line) {
  const cells = [];
  let current = "";
  let inCode = false;
  const text = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\" && text[i + 1] === "|") {
      current += "|";
      i++;
    } else if (ch === "`") {
      inCode = !inCode;
      current += ch;
    } else if (ch === "|" && !inCode) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function isBlockStart(lines, i) {
  const line = lines[i];
  return (
    FENCE.test(line) ||
    CONTAINER_OPEN.test(line) ||
    CONTAINER_CLOSE.test(line) ||
    HEADING.test(line) ||
    RULE.test(line) ||
    QUOTE.test(line) ||
    LIST_ITEM.test(line) ||
    (line.includes("|") && i + 1 < lines.length && TABLE_DIVIDER.test(lines[i + 1]))
  );
}

function renderInline(source, ctx) {
  const stash = [];
  const keep = (html) => `\u0000${stash.push(html) - 1}\u0000`;
  const anchor = (rawHref, attrs = "") => {
    const link = ctx.resolveLink(rawHref);
    const external = link.external ? ' target="_blank" rel="noopener"' : "";
    const cls = link.className ? ` class="${link.className}"` : "";
    return `<a href="${escapeHtml(link.href)}"${cls}${external}${attrs}>`;
  };

  let text = source.replace(/(`+)(.+?)\1(?!`)/g, (_, _ticks, code) =>
    keep(`<code>${escapeHtml(code.trim())}</code>`),
  );
  text = text.replace(/\\([\\`*_{}[\]()#+\-.!|<>~:])/g, (_, ch) => keep(escapeHtml(ch)));
  text = text.replace(/<(https?:\/\/[^>\s]+)>/g, (_, url) => keep(`${anchor(url)}${escapeHtml(url)}</a>`));
  text = escapeHtml(text);
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => {
    const link = ctx.resolveLink(src.replace(/&amp;/g, "&"));
    return keep(`<img src="${escapeHtml(link.href.replace("/blob/", "/raw/"))}" alt="${alt}" loading="lazy">`);
  });
  text = text.replace(
    /\[((?:[^[\]]|\[[^\]]*\])*)\]\(([^()\s]*(?:\([^)]*\)[^()\s]*)*)\)/g,
    (_, label, href) => `${keep(anchor(href.replace(/&amp;/g, "&")))}${label}${keep("</a>")}`,
  );
  // Reference-style links: [label][ref] and the [ref] shortcut, when a definition exists.
  text = text.replace(/\[([^\[\]]+)\](?:\[([^\[\]]*)\])?/g, (whole, label, ref) => {
    const target = ctx.references.get((ref || label).toLowerCase());
    return target ? `${keep(anchor(target))}${label}${keep("</a>")}` : whole;
  });
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/(?<![\w*])\*(?=\S)(.+?)(?<=\S)\*(?![\w*])/g, "<em>$1</em>");
  text = text.replace(/(?<![\w])_(?=\S)(.+?)(?<=\S)_(?![\w])/g, "<em>$1</em>");
  while (/\u0000\d+\u0000/.test(text)) {
    text = text.replace(/\u0000(\d+)\u0000/g, (_, index) => stash[Number(index)]);
  }
  return text;
}

function joinLines(lines) {
  return lines
    .map((line) => line.trim())
    .join("\n")
    .replace(CJK_JOIN, "$1")
    .replace(/\n/g, " ");
}

function renderBlocks(lines, ctx, tight = false) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    let match;

    if ((match = line.match(FENCE))) {
      const indent = match[1].length;
      const close = new RegExp(`^\\s*${match[2][0]}{${match[2].length},}\\s*$`);
      const body = [];
      i++;
      while (i < lines.length && !close.test(lines[i])) {
        body.push(lines[i].slice(Math.min(indent, indentOf(lines[i]))));
        i++;
      }
      i++;
      const lang = match[3] ? ` class="language-${match[3]}"` : "";
      out.push(`<pre><code${lang}>${escapeHtml(body.join("\n"))}</code></pre>`);
      continue;
    }

    if ((match = line.match(CONTAINER_OPEN))) {
      const body = [];
      let depth = 1;
      i++;
      while (i < lines.length) {
        if (CONTAINER_OPEN.test(lines[i])) depth++;
        else if (CONTAINER_CLOSE.test(lines[i]) && --depth === 0) break;
        body.push(lines[i]);
        i++;
      }
      i++;
      out.push(
        ctx.container({
          kind: match[1],
          title: match[2].trim(),
          lines: body,
          render: (inner) => renderBlocks(inner, ctx),
          inline: (inner) => renderInline(inner, ctx),
        }),
      );
      continue;
    }

    if ((match = line.match(HEADING))) {
      const level = match[1].length;
      const html = renderInline(match[2], ctx);
      const plain = html.replace(/<[^>]+>/g, "");
      let id = match[3] || slugify(plain) || `section-${ctx.headings.length + 1}`;
      while (ctx.headings.some((heading) => heading.id === id)) id += "-2";
      ctx.headings.push({ level, id, text: plain });
      out.push(
        level === 1
          ? `<h1>${html}</h1>`
          : `<h${level} id="${id}">${html}<a class="heading-anchor" href="#${id}" aria-label="本段連結">#</a></h${level}>`,
      );
      i++;
      continue;
    }

    if (RULE.test(line)) {
      out.push("<hr>");
      i++;
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && TABLE_DIVIDER.test(lines[i + 1])) {
      const head = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map((cell) =>
        /^:.*:$/.test(cell) ? "center" : /:$/.test(cell) ? "right" : "",
      );
      const cell = (tag, value, index) =>
        `<${tag}${aligns[index] ? ` style="text-align:${aligns[index]}"` : ""}>${renderInline(value, ctx)}</${tag}>`;
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      out.push(
        `<div class="table-wrapper"><table><thead><tr>${head.map((value, index) => cell("th", value, index)).join("")}</tr></thead><tbody>${rows
          .map((row) => `<tr>${head.map((_, index) => cell("td", row[index] ?? "", index)).join("")}</tr>`)
          .join("")}</tbody></table></div>`,
      );
      continue;
    }

    if (QUOTE.test(line)) {
      const body = [];
      while (i < lines.length && QUOTE.test(lines[i])) {
        body.push(lines[i].replace(QUOTE, ""));
        i++;
      }
      out.push(`<blockquote>${renderBlocks(body, ctx)}</blockquote>`);
      continue;
    }

    if ((match = line.match(LIST_ITEM))) {
      const baseIndent = match[1].length;
      const ordered = /\d/.test(match[2]);
      const start = ordered ? Number.parseInt(match[2], 10) : 1;
      const items = [];
      let loose = false;
      while (i < lines.length) {
        const itemMatch = lines[i].match(LIST_ITEM);
        if (!itemMatch || itemMatch[1].length !== baseIndent || /\d/.test(itemMatch[2]) !== ordered) break;
        const contentIndent = baseIndent + itemMatch[2].length + itemMatch[3].length;
        const body = [itemMatch[4]];
        i++;
        while (i < lines.length) {
          const current = lines[i];
          if (!current.trim()) {
            let next = i + 1;
            while (next < lines.length && !lines[next].trim()) next++;
            if (next >= lines.length) break;
            if (indentOf(lines[next]) >= contentIndent) {
              body.push("");
              i++;
              continue;
            }
            const sibling = lines[next].match(LIST_ITEM);
            if (sibling && sibling[1].length === baseIndent && /\d/.test(sibling[2]) === ordered) {
              loose = true;
              i = next;
            }
            break;
          }
          if (indentOf(current) >= contentIndent) {
            body.push(current.slice(contentIndent));
          } else if (body[body.length - 1] !== "" && !isBlockStart(lines, i)) {
            body.push(current.trim());
          } else {
            break;
          }
          i++;
        }
        items.push(body);
      }
      const tag = ordered ? "ol" : "ul";
      const startAttr = ordered && start !== 1 ? ` start="${start}"` : "";
      out.push(
        `<${tag}${startAttr}>${items.map((body) => `<li>${renderBlocks(body, ctx, !loose)}</li>`).join("")}</${tag}>`,
      );
      continue;
    }

    const paragraph = [];
    while (i < lines.length && lines[i].trim() && (paragraph.length === 0 || !isBlockStart(lines, i))) {
      paragraph.push(lines[i]);
      i++;
    }
    const html = renderInline(joinLines(paragraph), ctx);
    out.push(tight && out.length === 0 ? html : `<p>${html}</p>`);
  }
  return out.join("\n");
}

export function renderMarkdown(source, { resolveLink, container }) {
  const ctx = { resolveLink, container, headings: [], references: new Map() };
  let fenced = false;
  const lines = source
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => {
      if (FENCE.test(line)) fenced = !fenced;
      const definition = fenced ? null : line.match(/^\[([^\]]+)\]:\s+(\S+)\s*$/);
      if (definition) ctx.references.set(definition[1].toLowerCase(), definition[2]);
      return !definition;
    });
  const html = renderBlocks(lines, ctx);
  return { html, headings: ctx.headings };
}
