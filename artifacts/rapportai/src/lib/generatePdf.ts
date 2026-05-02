import type { ReportData } from "./reportStore";

/** Convert naive markdown to safe HTML (bold, italic, headings, lists) */
function mdToHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br>")
    .replace(/^(?!<[hul])(.+)$/, "<p>$1</p>");
}

function section(title: string, content: string, color = "#7c3aed"): string {
  if (!content?.trim()) return "";
  return `
    <div class="section">
      <div class="section-title" style="color:${color};border-color:${color}20">${title}</div>
      <div class="body">${mdToHtml(content)}</div>
    </div>`;
}

export function generatePdf(report: ReportData): void {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) { alert("Autorisez les pop-ups pour télécharger le PDF."); return; }

  const bibHtml = (report.bibliographie ?? [])
    .map((e) => `<p class="bib-entry">${e.author} (${e.year}). <em>${e.title}</em>. ${e.journal}</p>`)
    .join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>${report.theme ?? "Rapport"} — RapportAI</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  @page{size:A4;margin:25mm 20mm 25mm 25mm}
  body{font-family:"Times New Roman",Times,serif;font-size:12pt;color:#111;line-height:1.8;background:#fff}
  
  /* Cover page */
  .cover{page-break-after:always;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:2cm}
  .cover-badge{display:inline-block;background:#f5f0ff;color:#7c3aed;border-radius:999px;padding:6px 18px;font-size:10pt;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:2cm;font-family:'Plus Jakarta Sans',sans-serif}
  .cover-school{font-size:11pt;color:#555;margin-bottom:1.5cm;font-weight:600}
  .cover-title{font-family:'Plus Jakarta Sans',sans-serif;font-size:22pt;font-weight:900;color:#1a1a2e;line-height:1.25;margin-bottom:1.5cm;max-width:16cm}
  .cover-meta{font-size:10.5pt;color:#444;line-height:2}
  .cover-meta strong{color:#111}
  .cover-line{width:6cm;height:2px;background:#7c3aed30;margin:1.5cm auto}
  .cover-keywords{margin-top:1.5cm;display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
  .kw{background:#f5f0ff;color:#7c3aed;border-radius:999px;padding:3px 12px;font-size:9pt;font-weight:600}
  .cover-footer{position:fixed;bottom:1.5cm;left:0;right:0;text-align:center;font-size:8.5pt;color:#999;font-family:'Plus Jakarta Sans',sans-serif}

  /* Content */
  .section{page-break-inside:avoid;margin-bottom:1.8cm}
  .section-title{font-family:'Plus Jakarta Sans',sans-serif;font-size:12pt;font-weight:900;text-transform:uppercase;letter-spacing:.1em;border-bottom:2px solid;padding-bottom:4pt;margin-bottom:.6cm}
  .body p{margin-bottom:8pt}
  .body h1,.body h2,.body h3{font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;margin-bottom:4pt;margin-top:10pt}
  .body h1{font-size:14pt}.body h2{font-size:13pt}.body h3{font-size:12pt}
  .body ul{padding-left:1.5em;margin-bottom:8pt}
  .body li{margin-bottom:3pt}
  .body strong{font-weight:700}.body em{font-style:italic}

  /* Bib */
  .bib-entry{margin-bottom:8pt;text-indent:-1.5em;padding-left:1.5em}

  /* Watermark */
  .watermark{text-align:center;font-size:8.5pt;color:#aaa;margin-top:1.5cm;font-family:'Plus Jakarta Sans',sans-serif}

  @media print{
    .no-print{display:none!important}
    .cover{page-break-after:always}
  }
</style>
</head>
<body>

<!-- Print toolbar -->
<div class="no-print" style="position:fixed;top:0;left:0;right:0;z-index:999;background:#7c3aed;color:#fff;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;font-family:sans-serif;font-size:13px">
  <span style="font-weight:700">RapportAI — Aperçu PDF</span>
  <button onclick="window.print()" style="background:#fff;color:#7c3aed;border:none;padding:7px 20px;border-radius:999px;font-weight:700;cursor:pointer;font-size:13px">⬇ Enregistrer en PDF</button>
</div>
<div class="no-print" style="height:45px"></div>

<!-- Cover page -->
<div class="cover">
  <div class="cover-badge">${report.reportType ?? "Rapport de Stage"}</div>
  ${report.school ? `<div class="cover-school">${report.school}</div>` : ""}
  <div class="cover-title">${report.theme ?? "Titre du rapport"}</div>
  <div class="cover-line"></div>
  <div class="cover-meta">
    ${report.studentName ? `<div>Préparé par : <strong>${report.studentName}</strong></div>` : ""}
    ${report.encadrantPeda ? `<div>Encadrant pédagogique : <strong>${report.encadrantPeda}</strong></div>` : ""}
    ${report.encadrantPro ? `<div>Encadrant professionnel : <strong>${report.encadrantPro}</strong></div>` : ""}
    ${report.entreprise ? `<div>Entreprise d'accueil : <strong>${report.entreprise}</strong></div>` : ""}
    ${report.annee ? `<div>Année universitaire : <strong>${report.annee}</strong></div>` : ""}
  </div>
  ${(report.motsCles ?? []).length > 0 ? `
    <div class="cover-keywords">
      ${(report.motsCles ?? []).map((k) => `<span class="kw">${k}</span>`).join("")}
    </div>` : ""}
  <div class="cover-footer">Généré avec RapportAI · rapportai.replit.app</div>
</div>

<!-- Body sections -->
${section("Résumé", report.resume ?? "", "#6366f1")}
${section("Introduction Générale", report.introduction ?? "", "#7c3aed")}
${section("Partie I", report.partieI ?? "", "#2563eb")}
${section("Partie II", report.partieII ?? "", "#0891b2")}
${section("Conclusion Générale", report.conclusion ?? "", "#059669")}
${report.apports ? section("Apports et Limites", report.apports, "#d97706") : ""}
${report.perspectives ? section("Perspectives Futures", report.perspectives, "#d97706") : ""}
${bibHtml ? `<div class="section"><div class="section-title" style="color:#6b7280;border-color:#e5e7eb">Bibliographie</div><div class="body">${bibHtml}</div></div>` : ""}

<div class="watermark">Généré avec RapportAI — ${new Date().toLocaleDateString("fr-MA", { day:"2-digit", month:"long", year:"numeric" })}</div>

<script>
  // Give fonts a moment to load before printing if triggered by URL param
  if(window.location.search.includes('autoprint')){
    window.addEventListener('load',()=>setTimeout(()=>window.print(),800));
  }
</script>
</body>
</html>`;

  w.document.write(html);
  w.document.close();
}
