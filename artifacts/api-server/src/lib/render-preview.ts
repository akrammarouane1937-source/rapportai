/**
 * Renders page-de-garde.md to a PNG preview (A4, 794×1123px @ 2× scale).
 * Used so the page-de-garde agent can compare its output against the uploaded template.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import puppeteer from "puppeteer";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractComment(md: string, key: string): string {
  const match = md.match(new RegExp(`<!--\\s*${key}:\\s*([^>]+?)\\s*-->`));
  return match ? match[1].trim() : "";
}

function embedImage(imgPath: string): string {
  if (!existsSync(imgPath)) return "";
  const buf = readFileSync(imgPath);
  const ext = imgPath.split(".").pop()?.toLowerCase() ?? "png";
  const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

// ─── Markdown → HTML ──────────────────────────────────────────────────────────

function mdToHtml(md: string, workDir: string, accentColor: string): string {
  // Strip HTML comments (metadata only — already parsed above)
  let s = md.replace(/<!--[\s\S]*?-->/g, "");

  // Inline images — detect lines with 1 or 2 images, render as logo-row div
  s = s.replace(/^(!\[[^\]]*\]\([^)]+\)\s*){1,2}$/gm, (line) => {
    const imgMatches = [...line.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];
    const tags = imgMatches.map(([, alt, src]) => {
      const imgPath = path.isAbsolute(src) ? src : path.join(workDir, src);
      const b64 = embedImage(imgPath);
      return b64
        ? `<img src="${b64}" alt="${alt}" class="logo-img">`
        : `<span class="logo-placeholder">[${alt}]</span>`;
    });
    return tags.length === 2
      ? `<div class="logo-row">${tags[0]}${tags[1]}</div>`
      : `<div class="logo-center">${tags[0]}</div>`;
  });

  // Headings
  s = s
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Bold / italic
  s = s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Separators (━━━ or ---)
  const hrHtml = `<hr style="border-color:${accentColor}">`;
  s = s
    .replace(/^[━─═]{3,}$/gm, hrHtml)
    .replace(/^-{3,}$/gm, hrHtml);

  // Bullet lists
  s = s.replace(/^[•·–\-\*]\s+(.+)$/gm, "<li>$1</li>");
  s = s.replace(/(<li>[^<]*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);

  // Paragraphs — split on blank lines, skip already-tagged blocks
  const blocks = s.split(/\n{2,}/).map((block) => {
    const t = block.trim();
    if (!t) return "";
    const isBlock = /^<(h[1-6]|ul|div|hr)/.test(t);
    if (isBlock) return t;
    return `<p>${t.replace(/\n/g, "<br>")}</p>`;
  });

  return blocks.filter(Boolean).join("\n");
}

// ─── A4 HTML wrapper ──────────────────────────────────────────────────────────

function buildHtml(body: string, accentColor: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:794px; background:white; }
  .page {
    width:794px;
    min-height:1123px;
    padding:56px 60px;
    font-family:"Times New Roman", Times, serif;
    font-size:12pt;
    line-height:1.6;
    background:white;
  }
  h1 { font-size:16pt; text-align:center; color:${accentColor}; text-transform:uppercase; margin:14px 0 8px; }
  h2 { font-size:13pt; text-align:center; color:${accentColor}; margin:10px 0; }
  h3 { font-size:12pt; text-align:center; margin:8px 0; }
  p  { text-align:center; margin:5px 0; }
  hr { border:none; border-top:2px solid ${accentColor}; margin:18px 0; }
  ul { list-style:none; text-align:center; margin:8px 0; }
  li::before { content:"• "; }
  .logo-row   { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
  .logo-center{ text-align:center; margin-bottom:16px; }
  .logo-img   { max-height:80px; max-width:170px; object-fit:contain; }
  .logo-placeholder { font-size:9pt; color:#999; border:1px dashed #ccc; padding:6px 12px; }
  strong { font-weight:bold; }
  em     { font-style:italic; }
</style>
</head>
<body>
<div class="page">
${body}
</div>
</body>
</html>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Renders page-de-garde.md → page-de-garde-preview.png inside workDir.
 * Returns the preview path on success, null on any error.
 */
export async function renderPageDeGardePreview(workDir: string): Promise<string | null> {
  const mdPath = path.join(workDir, "page-de-garde.md");
  if (!existsSync(mdPath)) return null;

  try {
    const md = readFileSync(mdPath, "utf-8");
    const accentColor = extractComment(md, "color") || "#1e3a5f";
    const body = mdToHtml(md, workDir, accentColor);
    const html = buildHtml(body, accentColor);

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
      await page.setContent(html, { waitUntil: "networkidle0", timeout: 15_000 });

      const previewPath = path.join(workDir, "page-de-garde-preview.png");
      await page.screenshot({ path: previewPath as `${string}.png`, fullPage: true });
      return previewPath;
    } finally {
      await browser.close();
    }
  } catch {
    return null;
  }
}
