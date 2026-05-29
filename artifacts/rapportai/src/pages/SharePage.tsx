import { useState, useEffect, useCallback } from "react";
import { useParams } from "wouter";
import {
  Download, Link2, Check, Loader2, AlertCircle,
  BookOpen, GraduationCap, Building2, Calendar, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { markdownToHtml } from "@/lib/markdownToHtml";
import { generateDocx, downloadBlob } from "@/lib/generateDocx";
import { generatePdf } from "@/lib/generatePdf";
import type { ReportData } from "@/lib/reportStore";

import { API_BASE as BASE_PATH } from "@/lib/apiBase";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function wordCount(text?: string) {
  return text?.trim() ? text.trim().split(/\s+/).length : 0;
}

// ─── Section block ────────────────────────────────────────────────────────────

function Section({
  title, markdown, color = "#7c3aed",
}: { title: string; markdown?: string; color?: string }) {
  if (!markdown?.trim()) return null;
  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-5">
        <div className="h-px flex-1" style={{ background: color + "30" }} />
        <h2 className="text-base font-black uppercase tracking-widest px-1"
            style={{ color, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {title}
        </h2>
        <div className="h-px flex-1" style={{ background: color + "30" }} />
      </div>
      <div
        className="prose prose-sm max-w-none text-gray-800 leading-relaxed"
        style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: "13px", lineHeight: "1.9" }}
        dangerouslySetInnerHTML={{ __html: markdownToHtml(markdown) }}
      />
    </div>
  );
}

// ─── Copy-link button ─────────────────────────────────────────────────────────

function CopyLinkButton() {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border"
      style={{
        background: copied ? "#ecfdf5" : "white",
        borderColor: copied ? "#10b981" : "#e5e7eb",
        color: copied ? "#10b981" : "#6b7280",
      }}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
      {copied ? "Lien copié !" : "Copier le lien"}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SharePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!id) { setError("Identifiant manquant."); setLoading(false); return; }
    fetch(`${BASE_PATH}/api/share/${id}`)
      .then((r) => {
        if (!r.ok) return r.json().then((e: { error: string }) => Promise.reject(e.error));
        return r.json() as Promise<ReportData>;
      })
      .then((data) => { setReport(data); setLoading(false); })
      .catch((msg: string) => { setError(msg ?? "Erreur inconnue"); setLoading(false); });
  }, [id]);

  const handleDownload = useCallback(async () => {
    if (!report || exporting) return;
    setExporting(true);
    try {
      const blob = await generateDocx(report as any);
      const theme = report.theme?.slice(0, 40).replace(/\s+/g, "-").replace(/[^a-z0-9-]/gi, "") || "rapport";
      downloadBlob(blob, `RapportAI-${theme}.docx`);
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  }, [report, exporting]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f9f8ff]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Chargement du rapport…</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f9f8ff]">
        <div className="text-center max-w-sm mx-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-red-50">
            <AlertCircle className="w-7 h-7 text-red-400" />
          </div>
          <h2 className="text-lg font-black text-gray-900 mb-2">Rapport introuvable</h2>
          <p className="text-sm text-gray-500 mb-6">{error ?? "Ce lien est expiré ou invalide."}</p>
          <a href="/" className="text-sm font-semibold text-purple-600 hover:underline">
            Créer mon propre rapport →
          </a>
        </div>
      </div>
    );
  }

  // ── Computed ──
  const sections = [
    report.introduction, report.partieI, report.partieII,
    report.conclusion, report.resume,
  ];
  const totalWords = sections.reduce((acc, s) => acc + wordCount(s), 0);
  const estimatedPages = Math.max(1, Math.round(totalWords / 250));

  // ── Report view ──
  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Sticky top bar ── */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-4">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2 flex-shrink-0">
            <img src="/logo.svg" alt="RapportAI" className="w-7 h-7" />
            <span className="font-black text-gray-900 text-sm" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              RapportAI
            </span>
          </a>

          <span className="text-gray-200 text-lg select-none">|</span>

          <span className="text-xs text-gray-500 truncate flex-1 min-w-0">
            {report.theme ?? "Rapport académique"}
          </span>

          {/* Stats */}
          <span className="hidden sm:block text-xs text-gray-400 flex-shrink-0 tabular-nums">
            ~{estimatedPages} pages · {totalWords.toLocaleString("fr-FR")} mots
          </span>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <CopyLinkButton />
            <Button
              onClick={handleDownload}
              disabled={exporting}
              className="h-8 px-3 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl gap-1.5"
            >
              {exporting
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <Download className="w-3 h-3" />}
              .docx
            </Button>
            <Button
              onClick={() => report && void generatePdf(report)}
              variant="outline"
              className="h-8 px-3 text-xs font-bold rounded-xl gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
            >
              <FileText className="w-3 h-3" />
              PDF
            </Button>
          </div>
        </div>
      </div>

      {/* ── Report body ── */}
      <div className="max-w-3xl mx-auto px-6 py-10">

        {/* ── Cover card ── */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10 mb-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-6"
               style={{ background: "#f5f0ff", color: "#7c3aed" }}>
            <BookOpen className="w-3.5 h-3.5" />
            {report.reportType?.toUpperCase() ?? "RAPPORT"}
          </div>

          <h1 className="text-2xl font-black text-gray-900 mb-2 leading-tight"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {report.theme ?? "Titre du rapport"}
          </h1>

          <p className="text-sm text-gray-400 mb-8">{report.annee}</p>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-600">
            {report.studentName && (
              <span className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-purple-400" />
                {report.studentName}
              </span>
            )}
            {report.school && (
              <span className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-400" />
                {report.school}
              </span>
            )}
            {report.entreprise && (
              <span className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-green-400" />
                {report.entreprise}
              </span>
            )}
            {report.ville && (
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                {report.ville}
              </span>
            )}
          </div>

          {report.motsCles && report.motsCles.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center mt-6">
              {report.motsCles.map((kw) => (
                <span key={kw}
                  className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ background: "#f5f0ff", color: "#7c3aed" }}>
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Content sections ── */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 px-10 py-10">

          <Section title="Résumé" markdown={report.resume} color="#6366f1" />
          <Section title="Introduction Générale" markdown={report.introduction} color="#7c3aed" />
          <Section title="Partie I" markdown={report.partieI} color="#2563eb" />
          <Section title="Partie II" markdown={report.partieII} color="#0891b2" />
          <Section title="Conclusion Générale" markdown={report.conclusion} color="#059669" />

          {/* Apports / Perspectives */}
          {(report.apports || report.perspectives) && (
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-px flex-1" style={{ background: "#05966930" }} />
                <h2 className="text-base font-black uppercase tracking-widest px-1"
                    style={{ color: "#059669", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Apports & Perspectives
                </h2>
                <div className="h-px flex-1" style={{ background: "#05966930" }} />
              </div>
              {report.apports && (
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-gray-700 mb-2">Apports et limites</h3>
                  <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed"
                       style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: "13px" }}
                       dangerouslySetInnerHTML={{ __html: markdownToHtml(report.apports) }} />
                </div>
              )}
              {report.perspectives && (
                <div>
                  <h3 className="text-sm font-bold text-gray-700 mb-2">Perspectives futures</h3>
                  <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed"
                       style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: "13px" }}
                       dangerouslySetInnerHTML={{ __html: markdownToHtml(report.perspectives) }} />
                </div>
              )}
            </div>
          )}

          {/* Bibliographie */}
          {report.bibliographie && report.bibliographie.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-px flex-1 bg-gray-100" />
                <h2 className="text-base font-black uppercase tracking-widest px-1 text-gray-500"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Bibliographie
                </h2>
                <div className="h-px flex-1 bg-gray-100" />
              </div>
              <div className="space-y-3">
                {report.bibliographie.map((e, i) => (
                  <p key={i} className="text-sm text-gray-700 leading-relaxed pl-6 -indent-6"
                     style={{ fontFamily: "'Times New Roman', Times, serif" }}>
                    {e.author} ({e.year}). <em>{e.title}</em>. {e.journal}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer badge ── */}
        <div className="text-center mt-8 pb-4">
          <a href="/" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold text-purple-600 hover:text-purple-700 transition-colors"
             style={{ background: "#f5f0ff" }}>
            <div className="w-4 h-4 rounded-md flex items-center justify-center font-black text-white text-[9px]"
                 style={{ background: "#7c3aed" }}>R</div>
            Généré avec RapportAI · Créez votre propre rapport en 30 minutes
          </a>
          <p className="text-xs text-gray-400 mt-2">
            Ce lien expire dans 7 jours
          </p>
        </div>
      </div>
    </div>
  );
}
