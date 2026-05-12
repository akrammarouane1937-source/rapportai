import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Download, PenLine, X, Check, Loader2, Send, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateDocx, downloadBlob } from "@/lib/generateDocx";
import { UpsellModal } from "@/components/report/UpsellModal";
import { getMyPlan, incrementRevision, PLAN_LIMITS } from "@/lib/userPlan";
import { getReport } from "@/lib/reportStore";

import { API_BASE as BASE_PATH } from "@/lib/apiBase";

interface WordPreviewProps {
  content?: string;
  rawContent?: string;
  sectionTitle?: string;
  wordCount?: number;
  blurred?: boolean;
  onContentChange?: (newContent: string) => void;
  sectionId?: string;
}

// Fun Claude Code-style status messages
const FUN_STATUSES = [
  "Je lis ton texte avec attention…",
  "Hmm, je vois exactement ce que tu veux…",
  "Je retouche ça chirurgicalement…",
  "Poids des mots, choc des formulations…",
  "Un instant, je pèse chaque expression…",
  "Style académique en cours d'ajustement…",
  "Je consulte mon manuel de français formel…",
  "Presque là, dernier coup de polish…",
  "Je vérifie la cohérence avant de te montrer ça…",
  "Ah, bonne idée en fait…",
];

type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  text: string;        // what the user sees (summary for revisions)
  fullText?: string;   // full revised section (applied on click)
  isRevision?: boolean;
  applied?: boolean;
};

function parseRevisionResponse(raw: string): { summary: string; revised: string } | null {
  const summaryMatch = raw.match(/<summary>([\s\S]*?)<\/summary>/);
  const revisedMatch = raw.match(/<revised_section>([\s\S]*?)<\/revised_section>/);
  if (summaryMatch && revisedMatch) {
    return { summary: summaryMatch[1].trim(), revised: revisedMatch[1].trim() };
  }
  return null;
}

const MOCK_CONTENT = `
<h2>Chapitre I — Cadre théorique et revue de littérature</h2>

<h3>1.1 Introduction au cadre théorique</h3>

<p>La théorie moderne du portefeuille, telle qu'elle a été formulée par Harry Markowitz en 1952, constitue le fondement conceptuel de la présente analyse. Cette théorie révolutionnaire a profondément transformé la manière dont les investisseurs appréhendent la relation entre rendement et risque dans la construction d'un portefeuille d'actifs financiers.</p>

<p>Dans le contexte marocain, l'optimisation des portefeuilles revêt une importance particulière compte tenu des spécificités du marché financier national. La Bourse de Casablanca, principal marché organisé du Royaume, présente des caractéristiques structurelles qui nécessitent une adaptation des modèles théoriques développés dans des contextes occidentaux.</p>

<h3>1.2 La théorie de Markowitz et l'efficience des marchés</h3>

<p>Markowitz (1952) a démontré que pour un niveau de risque donné, il existe un portefeuille qui maximise le rendement espéré — et réciproquement, pour un niveau de rendement donné, il existe un portefeuille qui minimise le risque. L'ensemble de ces portefeuilles constitue ce que l'on appelle la frontière efficiente.</p>

<p>Cette approche quantitative repose sur trois hypothèses fondamentales : les investisseurs sont rationnels et averses au risque, les marchés sont efficients au sens semi-fort, et les distributions de rendements peuvent être caractérisées par leur espérance et leur variance. Ces hypothèses, bien que simplificatrices, permettent de développer un cadre analytique rigoureux et opérationnel.</p>
`;

// ── Split HTML into ~N-word pages at h2 boundaries ────────────────────────────
function splitIntoPages(html: string, wordsPerPage = 450): string[] {
  if (!html.trim()) return [""];
  const chunks = html.split(/(?=<h2\b)/);
  const pages: string[] = [];
  let cur = "";
  let curWords = 0;

  for (const chunk of chunks) {
    const wc = chunk.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    if (curWords + wc > wordsPerPage && cur.trim()) {
      pages.push(cur);
      cur = chunk;
      curWords = wc;
    } else {
      cur += chunk;
      curWords += wc;
    }
  }
  if (cur.trim()) pages.push(cur);
  return pages.length > 0 ? pages : [html];
}

// ── Revision panel (chat-style) ───────────────────────────────────────────────

function RevisionPanel({
  open, onClose, onRevisionLimitHit, content, rawContent, onContentChange, sectionId,
}: {
  open: boolean;
  onClose: () => void;
  onRevisionLimitHit: () => void;
  content: string;
  rawContent?: string;
  onContentChange?: (newContent: string) => void;
  sectionId?: string;
}) {
  const [messages, setMessages]     = useState<ChatMsg[]>([]);
  const [input, setInput]           = useState("");
  const [isRevising, setIsRevising] = useState(false);
  const [statusIdx, setStatusIdx]   = useState(0);
  const [error, setError]           = useState<string | null>(null);
  // workingContent tracks what the next revision operates on (updates on apply)
  const workingContentRef           = useRef(rawContent || content);
  const scrollRef                   = useRef<HTMLDivElement>(null);
  const statusTimerRef              = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset when panel opens/content changes
  useEffect(() => {
    workingContentRef.current = rawContent || content;
  }, [content, rawContent]);

  useEffect(() => {
    if (open) {
      setMessages([]);
      setInput("");
      setError(null);
      workingContentRef.current = rawContent || content;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isRevising]);

  const startStatusCycle = () => {
    setStatusIdx(0);
    statusTimerRef.current = setInterval(() => {
      setStatusIdx(i => (i + 1) % FUN_STATUSES.length);
    }, 2000);
  };
  const stopStatusCycle = () => {
    if (statusTimerRef.current) { clearInterval(statusTimerRef.current); statusTimerRef.current = null; }
  };

  const handleSend = async () => {
    const instruction = input.trim();
    if (!instruction || isRevising) return;

    const next  = incrementRevision();
    const limit = PLAN_LIMITS[next.planId].revisions;
    if (next.revisionCount > limit) { onRevisionLimitHit(); return; }

    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", text: instruction };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsRevising(true);
    setError(null);
    startStatusCycle();

    const report = getReport();
    let result = "";

    try {
      const resp = await fetch(`${BASE_PATH}/api/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content:    workingContentRef.current,
          instruction,
          sessionId:  report.sessionId,
          sectionId,
          theme:      report.theme,
          reportType: report.reportType,
          school:     report.school,
          filiere:    report.filiere,
        }),
      });
      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

      const reader  = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const msg = JSON.parse(line.slice(6)) as { content?: string; done?: boolean; error?: string };
            if (msg.error) throw new Error(msg.error);
            if (msg.done) break;
            if (msg.content) result += msg.content;
          } catch { /* skip malformed */ }
        }
      }

      if (result.trim()) {
        const parsed = parseRevisionResponse(result);
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: "assistant",
          text: parsed ? parsed.summary : result.trim(),
          fullText: parsed ? parsed.revised : undefined,
          isRevision: parsed !== null,
        }]);
      } else {
        throw new Error("Aucune révision retournée. Réessaie.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      stopStatusCycle();
      setIsRevising(false);
    }
  };

  const handleApply = (msgId: string, text: string, fullText?: string) => {
    const toApply = fullText ?? text;
    workingContentRef.current = toApply;
    onContentChange?.(toApply);
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, applied: true } : m));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: 340, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 340, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
          className="absolute top-0 right-0 h-full w-[340px] bg-white border-l border-gray-200 flex flex-col z-20"
          style={{ boxShadow: "-4px 0 28px rgba(0,0,0,0.10)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-purple-600 flex items-center justify-center">
                <PenLine className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Révision IA</p>
                <p className="text-[10px] text-gray-400 leading-none">Dis-moi ce que tu veux changer</p>
              </div>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Chat messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
            {messages.length === 0 && !isRevising && (
              <div className="flex flex-col gap-2 mt-2">
                <p className="text-xs text-gray-400 text-center mb-1">Exemples d'instructions :</p>
                {[
                  "Remplace les expressions trop familières",
                  "Ajoute une ligne pour mon directeur de thèse",
                  "Reformule en style plus sobre et formel",
                  "Raccourcis ce texte de moitié",
                  "Ajoute une dédicace à mes collègues",
                ].map(s => (
                  <button key={s} onClick={() => setInput(s)}
                    className="text-left text-xs px-3 py-2 rounded-xl border border-gray-100 text-gray-500 hover:border-purple-200 hover:text-purple-700 hover:bg-purple-50 transition-all">
                    {s}
                  </button>
                ))}
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "user" ? (
                  <div className="max-w-[85%] bg-gray-100 rounded-2xl rounded-tr-sm px-3 py-2">
                    <p className="text-xs text-gray-700">{msg.text}</p>
                  </div>
                ) : (
                  <div className="max-w-[95%] flex flex-col gap-1.5">
                    <div className={`rounded-2xl rounded-tl-sm px-3 py-2.5 border ${msg.applied ? "bg-green-50 border-green-200" : "bg-purple-50 border-purple-100"}`}>
                      <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                    </div>
                    {msg.isRevision && (
                      <button
                        onClick={() => !msg.applied && handleApply(msg.id, msg.text, msg.fullText)}
                        className={`self-start flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                          msg.applied
                            ? "bg-green-100 text-green-700 cursor-default"
                            : "bg-purple-600 hover:bg-purple-700 text-white"
                        }`}
                      >
                        {msg.applied
                          ? <><CheckCheck className="w-3 h-3" /> Appliqué</>
                          : <><Check className="w-3 h-3" /> Appliquer cette révision</>
                        }
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {isRevising && (
              <div className="flex justify-start">
                <div className="bg-purple-50 border border-purple-100 rounded-2xl rounded-tl-sm px-3 py-2.5 flex items-center gap-2 max-w-[85%]">
                  <Loader2 className="w-3 h-3 text-purple-500 animate-spin flex-shrink-0" />
                  <p className="text-xs text-purple-600 italic">{FUN_STATUSES[statusIdx]}</p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 flex items-start gap-2">
                <X className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex-shrink-0 border-t border-gray-100 p-3">
            <div className="flex items-end gap-2 bg-gray-50 rounded-xl border border-gray-200 focus-within:border-purple-300 focus-within:ring-2 focus-within:ring-purple-100 transition-all px-3 py-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isRevising}
                placeholder="Ex: remplace 'inconditionnel' par quelque chose de plus sobre…"
                rows={2}
                className="flex-1 text-xs text-gray-700 bg-transparent resize-none focus:outline-none placeholder:text-gray-300 disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isRevising}
                className="w-7 h-7 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 flex items-center justify-center transition-colors flex-shrink-0 mb-0.5"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
            <p className="text-[10px] text-gray-300 mt-1 text-right">⌘↵ pour envoyer</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function WordPreview({
  content,
  rawContent,
  sectionTitle = "Section",
  wordCount = 0,
  blurred = false,
  onContentChange,
}: WordPreviewProps) {
  const [revisionOpen, setRevisionOpen]   = useState(false);
  const [revisionUpsell, setRevisionUpsell] = useState(false);
  const [copied, setCopied]               = useState(false);
  const [downloading, setDownloading]     = useState(false);

  const html  = content || MOCK_CONTENT;
  const pages = splitIntoPages(html);
  const report = getReport();

  const handleCopy = () => {
    navigator.clipboard.writeText(html.replace(/<[^>]+>/g, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = useCallback(async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const data  = getReport();
      const blob  = await generateDocx(data);
      const theme = data.theme?.slice(0, 40).replace(/\s+/g, "-").replace(/[^a-z0-9\-]/gi, "") || "rapport";
      downloadBlob(blob, `RapportAI-${theme}.docx`);
    } catch (err) {
      console.error("docx export error", err);
    } finally {
      setDownloading(false);
    }
  }, [downloading]);

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 flex-shrink-0 z-10">
        <span className="text-sm font-semibold text-gray-700" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {sectionTitle} · {pages.length} page{pages.length > 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleCopy} className="h-8 px-3 text-xs text-gray-600 hover:text-gray-900 gap-1.5">
            {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copié" : "Copier"}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDownload} disabled={downloading}
            className="h-8 px-3 text-xs text-gray-600 hover:text-gray-900 gap-1.5 disabled:opacity-60">
            {downloading
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Export...</>
              : <><Download className="w-3.5 h-3.5" /> .docx</>
            }
          </Button>
          <Button onClick={() => setRevisionOpen(true)} size="sm" variant="ghost"
            className="h-8 px-3 text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold gap-1.5 rounded-lg">
            <PenLine className="w-3.5 h-3.5" /> Révision IA
          </Button>
        </div>
      </div>

      {/* Multi-page A4 preview */}
      <div className="flex-1 overflow-y-auto relative" style={{ background: "#d1d5db" }}>
        <div className="flex flex-col items-center py-8 px-6 gap-6 min-h-full">
          {pages.map((pageHtml, idx) => (
            <div
              key={idx}
              className="w-full max-w-[680px] bg-white flex-shrink-0"
              style={{
                padding: "56px 64px",
                boxShadow: "0 2px 24px rgba(0,0,0,0.14)",
                minHeight: "880px",
                filter: blurred ? "blur(4px)" : "none",
                transition: "filter 0.3s ease",
              }}
            >
              {/* Page header */}
              <div className="text-center mb-6 pb-3 border-b border-gray-100">
                <p className="text-[9pt] text-gray-400" style={{ fontFamily: "Times New Roman, serif" }}>
                  {report.theme ?? "RapportAI"} — {report.annee ?? "2024–2025"}
                </p>
              </div>

              {/* Content */}
              <div
                className="word-preview-content"
                style={{
                  fontFamily: "Times New Roman, serif",
                  fontSize: "11pt",
                  color: "#1a1a1a",
                  textAlign: "justify",
                  lineHeight: "1.75",
                }}
                dangerouslySetInnerHTML={{ __html: pageHtml }}
              />

              {/* Page number */}
              <div className="text-center mt-10 pt-3 border-t border-gray-100">
                <p className="text-[9pt] text-gray-400" style={{ fontFamily: "Times New Roman, serif" }}>
                  — {idx + 1} —
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Word count badge */}
        <div className="sticky bottom-4 left-0 right-0 flex justify-end pr-4 pointer-events-none z-10">
          <div className="bg-white border border-gray-200 rounded-full px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-sm pointer-events-auto">
            {wordCount > 0 ? wordCount.toLocaleString("fr-FR") : "0"} mots · {pages.length} p.
          </div>
        </div>
      </div>

      {/* Revision panel */}
      <RevisionPanel
        open={revisionOpen}
        onClose={() => setRevisionOpen(false)}
        onRevisionLimitHit={() => setRevisionUpsell(true)}
        content={html}
        rawContent={rawContent}
        onContentChange={onContentChange}
        sectionId={sectionId}
      />
      <UpsellModal
        open={revisionUpsell}
        onClose={() => setRevisionUpsell(false)}
        variant="revision-essentiel"
        currentPlan={getMyPlan().planId}
      />
    </div>
  );
}
