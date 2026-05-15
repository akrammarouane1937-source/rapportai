import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ChatMessage, ToolCallCard } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { ChatInput } from "@/components/chat-input";
import { useReportStore } from "@/lib/store";
import { useGenerate } from "@/hooks/use-generate";
import { Download, Share2, Loader2, CheckCircle2 } from "lucide-react";
import { generateDocx, downloadBlob } from "@/lib/generateDocx";
import { generatePdf } from "@/lib/generatePdf";
import { API_BASE } from "@/lib/apiBase";

type Phase = "apports" | "perspectives" | "generating_conclusion" | "generating_abbrevs" | "done";
type Msg = { role: "agent" | "user"; content: React.ReactNode };

function totalWords(r: ReturnType<typeof useReportStore>["report"]) {
  return [r.dedicaces, r.remerciements, r.resumeFr, r.abstractEn, r.introduction, r.partieI, r.partieII, r.conclusion]
    .join(" ").split(/\s+/).filter(Boolean).length;
}

export default function Step9() {
  const { report, updateReport } = useReportStore();
  const { generate, isGenerating, toolCalls, streamedContent } = useGenerate();
  const [phase, setPhase] = useState<Phase>("apports");
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [exported, setExported] = useState(false);
  const wc = totalWords(report);
  const pages = Math.max(1, Math.round(wc / 250));

  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "agent",
      content: (
        <div>
          <p>Dernière étape 🎯 Ton rapport est presque complet.</p>
          {wc > 0 && (
            <div className="mt-2 p-3 rounded-lg bg-muted text-sm grid grid-cols-2 gap-2">
              <div><span className="font-semibold">{wc.toLocaleString("fr-FR")}</span> mots</div>
              <div><span className="font-semibold">~{pages}</span> pages</div>
            </div>
          )}
          <p className="mt-3">Tu veux mentionner des apports ou limites spécifiques ? (ou tape "génère" pour que l'IA s'en charge)</p>
        </div>
      ),
    },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, toolCalls, isGenerating]);

  const push = (...m: Msg[]) => setMsgs((p) => [...p, ...m]);

  const handleSend = async (text: string) => {
    const t = text.trim();
    const auto = /^(génère|genere|auto|ia|ai|non|passer)$/i.test(t) || !t;

    if (phase === "apports") {
      if (!auto) updateReport({ checkpoints: { ...report.checkpoints, apports: t } });
      push(
        { role: "user", content: auto ? "Laisser l'IA générer" : t },
        { role: "agent", content: "Des perspectives futures à inclure ? (ou 'génère' pour laisser l'IA)" }
      );
      setPhase("perspectives");
    } else if (phase === "perspectives") {
      const perspectives = auto ? "" : t;
      push(
        { role: "user", content: auto ? "Laisser l'IA générer" : t },
        { role: "agent", content: "Je génère la conclusion en synthétisant tout ton rapport..." }
      );
      setPhase("generating_conclusion");
      const prompt = [
        report.checkpoints?.apports ? `Apports: ${report.checkpoints.apports}` : "",
        perspectives ? `Perspectives: ${perspectives}` : "",
      ].filter(Boolean).join(" | ") || undefined;
      const finalConclusion = await generate("conclusion", report, prompt);
      updateReport({ conclusion: finalConclusion });
      push({
        role: "agent",
        content: (
          <div>
            <p>Conclusion générée ✅</p>
            <div className="mt-2 p-3 rounded-lg bg-muted text-sm">
              <span className="font-semibold">{finalConclusion.split(/\s+/).filter(Boolean).length.toLocaleString("fr-FR")} mots</span>
            </div>
          </div>
        ),
      });
      // Auto-trigger abbreviation agent
      push({
        role: "agent",
        content: (
          <div>
            <p>🔔 Je génère maintenant ta liste des abréviations. Je lis tout le rapport et recherche chaque terme...</p>
          </div>
        ),
      });
      setPhase("generating_abbrevs");
      const abbrevRaw = await generate("abbreviations", { ...report, conclusion: finalConclusion });
      try {
        const parsed = JSON.parse(abbrevRaw);
        if (Array.isArray(parsed)) {
          updateReport({ abreviations: parsed, abbreviationsGenerated: true });
          push({
            role: "agent",
            content: (
              <div>
                <p>Liste des abréviations complète ✅</p>
                <div className="mt-2 space-y-1">
                  {parsed.map((a: { abbr: string; sig: string }) => (
                    <div key={a.abbr} className="flex gap-2 text-sm">
                      <span className="font-semibold w-16 flex-shrink-0">{a.abbr}</span>
                      <span className="text-muted-foreground">— {a.sig}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-sm">Tu veux modifier quelque chose ou ajouter une abréviation ?</p>
              </div>
            ),
          });
        } else {
          throw new Error("not array");
        }
      } catch {
        push({ role: "agent", content: "Abréviations générées ✅ Ton rapport est prêt à exporter." });
      }
      setPhase("done");
    } else if (phase === "done") {
      push({ role: "user", content: t });
      push({ role: "agent", content: "Je révise..." });
      const conclusion = await generate("conclusion", report, t);
      if (conclusion) {
        updateReport({ conclusion });
        push({ role: "agent", content: "Section mise à jour ✅" });
      } else {
        push({ role: "agent", content: "❌ Révision échouée. Réessaie." });
      }
    }
  };

  const handleExportDocx = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const blob = await generateDocx(report as any);
      const slug = report.theme?.slice(0, 40).replace(/\s+/g, "-").replace(/[^a-z0-9\-]/gi, "") || "rapport";
      downloadBlob(blob, `RapportAI-${slug}.docx`);
      setExported(true);
      setTimeout(() => setExported(false), 4000);
    } finally {
      setExporting(false);
    }
  };

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const res = await fetch(`${API_BASE}/api/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      });
      if (!res.ok) throw new Error("Erreur");
      const { id } = await res.json();
      const url = `${window.location.origin}/share/${id}`;
      setShareUrl(url);
      navigator.clipboard.writeText(url).catch(() => {});
    } finally {
      setSharing(false);
    }
  };

  const previewContent = report.conclusion || streamedContent;

  return (
    <Layout
      stepName="Conclusion & Export"
      stepNumber={9}
      previewPanel={<PreviewPanel activeSection="conclusion" content={previewContent} />}
    >
      <div className="flex-1 overflow-y-auto py-4 px-2 md:py-5 md:px-3">
        {msgs.map((m, i) => <ChatMessage key={i} role={m.role} content={m.content} />)}
        {toolCalls.map((tc, i) => <ToolCallCard key={i} name={tc.name} status={tc.status} />)}
        {isGenerating && (
          <ChatMessage
            role="agent"
            content={phase === "generating_abbrevs" ? "Recherche des abréviations..." : "Rédaction de la conclusion..."}
            isTyping
          />
        )}

        {phase === "done" && !isGenerating && (
          <div className="ml-11 mb-6 space-y-3">
            <div className="p-4 rounded-xl border border-primary/20 bg-background">
              <p className="text-sm font-semibold text-foreground mb-3">Ton rapport est prêt 🎉</p>
              <div className="flex gap-2">
                <button
                  onClick={handleExportDocx}
                  disabled={exporting}
                  className="flex-1 h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-white transition-all disabled:opacity-70"
                  style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 4px 16px rgba(22,163,74,0.35)" }}
                >
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : exported ? <CheckCircle2 className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                  {exporting ? "Export..." : exported ? "Téléchargé !" : "Word .docx"}
                </button>
                <button
                  onClick={() => { generatePdf(report as any); }}
                  className="flex-1 h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-white transition-all"
                  style={{ background: "linear-gradient(135deg, #dc2626, #b91c1c)", boxShadow: "0 4px 16px rgba(220,38,38,0.35)" }}
                >
                  <Download className="w-4 h-4" /> PDF
                </button>
              </div>
              <button
                onClick={handleShare}
                disabled={sharing}
                className="w-full mt-2 h-10 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 border transition-all"
              >
                {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                {sharing ? "Création du lien..." : "Partager mon rapport"}
              </button>
              {shareUrl && (
                <div className="mt-2 p-2 rounded-lg bg-muted text-xs font-mono break-all">{shareUrl}</div>
              )}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="shrink-0 border-t" style={{ borderColor: "#1e293b" }}>
        <ChatInput
          onSend={handleSend}
          disabled={isGenerating || phase === "generating_conclusion" || phase === "generating_abbrevs"}
          placeholder={
            phase === "apports" ? "Apports et limites (ou 'génère')..." :
            phase === "perspectives" ? "Perspectives futures (ou 'génère')..." :
            phase === "done" ? "Demander une modification..." : ""
          }
        />
      </div>
    </Layout>
  );
}
