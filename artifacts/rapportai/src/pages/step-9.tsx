import { useState, useRef, useEffect } from "react";
import { useReportStore, type Report } from "@/lib/store";
import { useConversation } from "@/hooks/use-conversation";
import { Layout } from "@/components/layout";
import { ChatMessage, AgentSteps } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { ChatInput } from "@/components/chat-input";
import { Download, Share2, Loader2, CheckCircle2 } from "lucide-react";
import { generateDocx, downloadBlob } from "@/lib/generateDocx";
import { generatePdf } from "@/lib/generatePdf";
import { API_BASE } from "@/lib/apiBase";

function totalWords(r: Report) {
  return [r.dedicaces, r.remerciements, r.resumeFr, r.abstractEn, r.introduction, r.partieI, r.partieII, r.conclusion]
    .join(" ").split(/\s+/).filter(Boolean).length;
}

export default function Step9() {
  const { report, updateReport } = useReportStore();
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [exported, setExported] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const wc = totalWords(report);
  const pages = Math.max(1, Math.round(wc / 250));

  const wordSummary = wc > 0
    ? `\n\nTon rapport : **${wc.toLocaleString("fr-FR")} mots** (~${pages} pages).`
    : "";

  const { messages, send, abort, isThinking, isGenerating, toolCalls, thinkingText } = useConversation({
    step: 9,
    initialMessage: `Dernière étape 🎯 Ton rapport est presque complet.${wordSummary}\n\nTu veux mentionner des apports ou limites spécifiques ? (ou tape "génère" pour que l'IA s'en charge)`,
    onSectionGenerated: (section, content) => {
      if (section === "conclusion") updateReport({ conclusion: content });
      if (section === "bibliographie") updateReport({ bibliographie: content });
      if (section === "abbreviations") {
        try {
          // The agent returns raw JSON — extract it from the markdown if wrapped
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
          if (Array.isArray(parsed)) updateReport({ abreviations: parsed, abbreviationsGenerated: true });
        } catch { /* malformed JSON — ignore */ }
      }
    },
    onStepComplete: () => setExportDone(true),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolCalls, isThinking, isGenerating, exportDone]);

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

  return (
    <Layout stepName="Conclusion & Export" stepNumber={9}
      previewPanel={<PreviewPanel activeSection="conclusion" content={report.conclusion ?? ""} />}
    >
      <div className="flex-1 overflow-y-auto py-4 px-2 md:py-5 md:px-3">
        {messages.map((m) => <ChatMessage key={m.id} role={m.role} content={m.content} />)}
        <AgentSteps toolCalls={toolCalls} thinkingText={thinkingText} isGenerating={isGenerating} />
        {(isThinking || isGenerating) && <ChatMessage role="agent" content="" isTyping />}

        {exportDone && !isThinking && !isGenerating && (
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
                  onClick={() => void generatePdf(report as any)}
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
      <div className="shrink-0 border-t border-border">
        <ChatInput
          isGenerating={isThinking || isGenerating}
          onAbort={abort}
          onSend={(text) => send(text)}
          disabled={isThinking || isGenerating}
          placeholder={exportDone ? "Demander une modification..." : "Réponds naturellement..."}
        />
      </div>
    </Layout>
  );
}
