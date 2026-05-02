/**
 * Minimal streaming-safe markdown → HTML converter.
 * Handles: ## H2, ### H3, **bold**, *italic*, regular paragraphs.
 */
export function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let paragraphBuf = "";

  const flushParagraph = () => {
    const t = paragraphBuf.trim();
    if (t) {
      out.push(`<p>${inlineFormat(t)}</p>`);
    }
    paragraphBuf = "";
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.startsWith("### ")) {
      flushParagraph();
      out.push(`<h3>${inlineFormat(line.slice(4).trim())}</h3>`);
    } else if (line.startsWith("## ")) {
      flushParagraph();
      out.push(`<h2>${inlineFormat(line.slice(3).trim())}</h2>`);
    } else if (line.startsWith("# ")) {
      flushParagraph();
      out.push(`<h2>${inlineFormat(line.slice(2).trim())}</h2>`);
    } else if (line === "") {
      flushParagraph();
    } else {
      paragraphBuf += (paragraphBuf ? " " : "") + line;
    }
  }
  flushParagraph();

  return out.join("\n");
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}
