/**
 * Streaming-safe markdown → HTML converter.
 * Handles: ## H2, ### H3, **bold**, *italic*, `code`,
 *          | tables |, - unordered lists, 1. ordered lists.
 */
export function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let paragraphBuf = "";
  let listBuf: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let tableBuf: string[][] = [];

  const flushParagraph = () => {
    const t = paragraphBuf.trim();
    if (t) out.push(`<p>${inlineFormat(t)}</p>`);
    paragraphBuf = "";
  };

  const flushList = () => {
    if (listBuf.length === 0) return;
    const tag = listType === "ol" ? "ol" : "ul";
    const items = listBuf.map((item) => `<li>${inlineFormat(item)}</li>`).join("");
    out.push(`<${tag}>${items}</${tag}>`);
    listBuf = [];
    listType = null;
  };

  const flushTable = () => {
    if (tableBuf.length === 0) return;
    let html = '<table class="md-table"><thead>';
    tableBuf.forEach((row, idx) => {
      if (idx === 1) html += "</thead><tbody>";
      html += "<tr>";
      row.forEach((cell) => {
        const tag = idx === 0 ? "th" : "td";
        html += `<${tag}>${inlineFormat(cell.trim())}</${tag}>`;
      });
      html += "</tr>";
    });
    html += "</tbody></table>";
    out.push(html);
    tableBuf = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Table row — must start and contain at least one |
    if (line.startsWith("|") && line.includes("|", 1)) {
      flushParagraph();
      flushList();
      // Skip separator rows like | --- | :---: |
      if (/^\|[\s\-:|]+\|$/.test(line)) continue;
      const cells = line
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|");
      tableBuf.push(cells);
      continue;
    }

    // Non-table line — flush pending table
    if (tableBuf.length > 0) flushTable();

    if (line.startsWith("### ")) {
      flushParagraph(); flushList();
      out.push(`<h3>${inlineFormat(line.slice(4).trim())}</h3>`);
    } else if (line.startsWith("## ")) {
      flushParagraph(); flushList();
      out.push(`<h2>${inlineFormat(line.slice(3).trim())}</h2>`);
    } else if (line.startsWith("# ")) {
      flushParagraph(); flushList();
      out.push(`<h2>${inlineFormat(line.slice(2).trim())}</h2>`);
    } else if (/^\d+\. /.test(line)) {
      flushParagraph();
      if (listType !== "ol") { flushList(); listType = "ol"; }
      listBuf.push(line.replace(/^\d+\. /, ""));
    } else if (/^[-*] /.test(line)) {
      flushParagraph();
      if (listType !== "ul") { flushList(); listType = "ul"; }
      listBuf.push(line.slice(2));
    } else if (line === "") {
      flushParagraph();
      flushList();
    } else {
      if (listType) flushList();
      paragraphBuf += (paragraphBuf ? " " : "") + line;
    }
  }

  flushParagraph();
  flushList();
  flushTable();

  return out.join("\n");
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}
