import { useState, useRef, useEffect } from "react";
import { useSessionRecover } from "@/hooks/use-session-recover";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, Sparkles, ArrowRight, ChevronDown } from "lucide-react";
import { useLocation } from "wouter";
import { useOptionalUser as useUser } from "@/lib/useOptionalClerk";
import { Sidebar, SidebarSpacer } from "@/components/layout/Sidebar";
import { useReportStore } from "@/lib/store";
import { getReport } from "@/lib/reportStore";
import { API_BASE } from "@/lib/apiBase";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type SectionSummary = { content: string; wordCount: number };

// ── Navigation detection ──────────────────────────────────────────────────────
const STEP_NAV = [
  { pattern: /page de garde/i,          path: "/rapport/step-2",   label: "Page de garde" },
  { pattern: /dédicaces?/i,             path: "/rapport/step-3",   label: "Dédicaces" },
  { pattern: /remerciements?/i,         path: "/rapport/step-3",   label: "Remerciements" },
  { pattern: /résumé|abstract/i,        path: "/rapport/step-4",   label: "Résumé & Abstract" },
  { pattern: /sommaire/i,               path: "/rapport/step-5",   label: "Sommaire" },
  { pattern: /introduction/i,           path: "/rapport/step-6",   label: "Introduction" },
  { pattern: /partie\s+i(?!\s*i)/i,     path: "/rapport/partie-i", label: "Partie I" },
  { pattern: /partie\s+ii/i,            path: "/rapport/partie-ii",label: "Partie II" },
  { pattern: /conclusion/i,             path: "/rapport/step-9",   label: "Conclusion" },
];

const STEP_PATHS: Record<number, string> = {
  1: "/rapport/step-1", 2: "/rapport/step-2", 3: "/rapport/step-3",
  4: "/rapport/step-4", 5: "/rapport/step-5", 6: "/rapport/step-6",
  7: "/rapport/partie-i", 8: "/rapport/partie-ii", 9: "/rapport/step-9",
};

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
  navSuggestion?: { path: string; label: string } | null;
  navAction?: { path: string; label: string; injection: string } | null;
}

function detectNav(text: string) {
  for (const item of STEP_NAV) {
    if (item.pattern.test(text)) return { path: item.path, label: item.label };
  }
  return null;
}

// ── Animated placeholder hook ─────────────────────────────────────────────────
const PLACEHOLDERS_NEW = [
  "C'est quoi la différence entre PFE, stage et mémoire ?",
  "Comment RapportAI génère mon rapport exactement ?",
  "J'ai mon thème — par où je commence ?",
  "Mon école est-elle supportée par RapportAI ?",
  "Combien de temps pour générer un rapport complet ?",
  "Est-ce que je peux modifier ce que l'IA génère ?",
];

const PLACEHOLDERS_ACTIVE = [
  "Mon rapport est-il cohérent de l'intro à la conclusion ?",
  "Qu'est-ce qu'il manque dans mon rapport ?",
  "Emmène-moi à l'étape où j'en suis",
  "Prépare-moi pour la soutenance avec mon rapport",
  "Y a-t-il des contradictions entre mes sections ?",
  "Mon plan est-il logique pour un jury ?",
];

function useAnimatedPlaceholder(active: boolean, hasReport: boolean) {
  const pool = hasReport ? PLACEHOLDERS_ACTIVE : PLACEHOLDERS_NEW;
  const [index, setIndex]     = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!active) return;
    setIndex(0);
    setVisible(true);
  }, [hasReport, active]);

  useEffect(() => {
    if (!active) return;
    const cycle = () => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % pool.length);
        setVisible(true);
      }, 400);
    };
    const id = setInterval(cycle, 3400);
    return () => clearInterval(id);
  }, [active, pool.length]);

  return { text: pool[index] ?? pool[0], visible };
}

// ── Main component ────────────────────────────────────────────────────────────
const SECTION_NAV_LABELS: Record<string, string> = {
  "/rapport/step-2":   "Page de garde",
  "/rapport/step-3":   "Dédicaces",
  "/rapport/step-4":   "Résumé & Abstract",
  "/rapport/step-5":   "Sommaire",
  "/rapport/step-6":   "Introduction",
  "/rapport/partie-i": "Partie I",
  "/rapport/partie-ii":"Partie II",
  "/rapport/step-9":   "Conclusion",
};

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { user }        = useUser();
  const { report, updateReport } = useReportStore();
  const rawReport       = getReport();

  useSessionRecover(); // silently merge any server-side disk content into Zustand

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const textareaRef             = useRef<HTMLTextAreaElement>(null);
  const abortRef                = useRef<AbortController | null>(null);
  const showGreeting            = messages.length === 0;
  const hasReport               = !!(report.theme || report.school);
  const placeholder             = useAnimatedPlaceholder(showGreeting && !input, hasReport);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  const stepDone: Record<number, boolean> = {
    1: !!(report.theme && report.school),
    2: !!report.pageDeGarde,
    3: !!(report.dedicaces || report.remerciements),
    4: !!report.resumeFr,
    5: !!report.sommaire,
    6: !!report.introduction,
    7: !!report.partieI,
    8: !!report.partieII,
    9: !!report.conclusion,
  };
  const currentStep = ([1,2,3,4,5,6,7,8,9].find((n) => !stepDone[n])) ?? 9;
  const name = user?.firstName
    || user?.emailAddresses?.[0]?.emailAddress?.split("@")[0]
    || rawReport.studentName?.split(" ")[0]
    || "Étudiant";

  const theme = report.theme || rawReport.theme || "";
  const shortTheme = theme.length > 28 ? theme.slice(0, 28) + "…" : theme;

  const completedCount = Object.values(stepDone).filter(Boolean).length;

  const greeting = hasReport
    ? `Bonjour ${name}, ton rapport avance.`
    : `Bonjour ${name}, bienvenue sur RapportAI.`;

  const subtitle = hasReport && completedCount > 0
    ? completedCount >= 7
      ? "Ton rapport est presque complet. Que veux-tu affiner ?"
      : "Je connais toutes tes sections. Dis-moi ce qui bloque."
    : "Je génère ton rapport complet, section par section. Par où on commence ?";

  const quickActions = hasReport && completedCount > 0
    ? [
        {
          label: "Qu'est-ce qu'il manque dans mon rapport ?",
          action: () => sendWithText(`J'ai généré ${completedCount} sections sur 9 dans mon rapport sur "${theme}". Qu'est-ce qui manque et dans quel ordre je dois continuer ?`),
        },
        {
          label: "Mon rapport est-il cohérent ?",
          action: () => sendWithText(`Analyse la cohérence globale de mon rapport sur "${theme}" — est-ce que l'intro, le développement et la conclusion se tiennent ?`),
        },
        {
          label: "Emmène-moi à l'étape suivante",
          action: () => setLocation(STEP_PATHS[currentStep] ?? "/rapport/step-1"),
        },
        {
          label: "Prépare-moi pour la soutenance",
          action: () => sendWithText(`Prépare-moi pour la soutenance de mon rapport sur "${theme}". Quelles questions difficiles mon jury va me poser ?`),
        },
      ]
    : [
        {
          label: "Comment RapportAI génère mon rapport ?",
          action: () => sendWithText("Explique-moi exactement comment RapportAI génère mon rapport. C'est quoi les étapes, combien de temps ça prend, et qu'est-ce que je dois faire moi ?"),
        },
        {
          label: "PFE, stage ou mémoire — c'est quoi la différence ?",
          action: () => sendWithText("C'est quoi la différence entre un PFE, un rapport de stage et un mémoire ? Lequel me correspond ?"),
        },
        {
          label: "Commencer mon rapport maintenant",
          action: () => setLocation("/rapport/step-1"),
        },
      ];

  const sendWithText = (text: string) => {
    setInput(text);
    setTimeout(() => send(text), 0);
  };

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", text: "", streaming: true }]);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const history = [...messages, userMsg].map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.text,
    }));

    // Build sections summaries for orchestrator cross-section intelligence
    const sectionFields: [string, string][] = [
      ["pageDeGarde", report.pageDeGarde],
      ["dedicaces", report.dedicaces],
      ["resumeFr", report.resumeFr],
      ["sommaire", report.sommaire],
      ["introduction", report.introduction],
      ["partieI", report.partieI],
      ["partieII", report.partieII],
      ["conclusion", report.conclusion],
    ];
    const sections: Record<string, SectionSummary | null> = {};
    for (const [key, content] of sectionFields) {
      if (content && content.trim().length > 0) {
        sections[key] = { content: content.trim(), wordCount: content.trim().split(/\s+/).filter(Boolean).length };
      } else {
        sections[key] = null;
      }
    }

    try {
      const resp = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages:        history,
          mode:            "assistant",
          theme:           report.theme || rawReport.theme,
          reportType:      report.reportType || rawReport.reportType,
          school:          report.school || rawReport.school,
          filiere:         report.filiere || rawReport.filiere,
          studentName:     report.studentName || rawReport.studentName,
          problematique:   report.problematique || undefined,
          sections,
          sectionSummaries: report.sectionSummaries ?? {},
        }),
        signal: ctrl.signal,
      });

      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

      const reader  = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let fullText = "";
      let pendingNav: { path: string; injection: string } | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const msg = JSON.parse(line.slice(6)) as {
              content?: string;
              done?: boolean;
              error?: string;
              action?: { type: string; path?: string; injection?: string };
            };
            if (msg.error) throw new Error(msg.error);
            if (msg.done) break;
            if (msg.action?.type === "navigate" && msg.action.path) {
              pendingNav = { path: msg.action.path, injection: msg.action.injection ?? "" };
            }
            if (msg.content) {
              fullText += msg.content;
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, text: fullText } : m)
              );
            }
          } catch { /* skip malformed */ }
        }
      }

      if (pendingNav) {
        const navLabel = SECTION_NAV_LABELS[pendingNav.path] ?? "section";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, streaming: false, navSuggestion: null, navAction: { path: pendingNav!.path, label: navLabel, injection: pendingNav!.injection } }
              : m
          )
        );
      } else {
        const nav = detectNav(text) || detectNav(fullText);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, streaming: false, navSuggestion: nav } : m
          )
        );
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, text: "Une erreur est survenue. Réessaie.", streaming: false }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  // Recent sections (last 3 with content)
  const recentSections = [
    { label: "Page de garde",     field: "pageDeGarde",  path: "/rapport/step-2"   },
    { label: "Dédicaces",         field: "dedicaces",    path: "/rapport/step-3"   },
    { label: "Résumé",            field: "resumeFr",     path: "/rapport/step-4"   },
    { label: "Sommaire",          field: "sommaire",     path: "/rapport/step-5"   },
    { label: "Introduction",      field: "introduction", path: "/rapport/step-6"   },
    { label: "Partie I",          field: "partieI",      path: "/rapport/partie-i" },
    { label: "Partie II",         field: "partieII",     path: "/rapport/partie-ii"},
    { label: "Conclusion",        field: "conclusion",   path: "/rapport/step-9"   },
  ].filter((s) => !!(report as Record<string, string>)[s.field]).slice(0, 3);

  const workspaceName = user?.emailAddresses?.[0]?.emailAddress?.split("@")[0]
    || user?.firstName
    || "Mon espace";

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f9f8ff" }}>
      <Sidebar />
      <SidebarSpacer />

      <main className="flex-1 flex flex-col min-h-0 min-w-0 overflow-y-auto">

        {/* ── Workspace name (top center, like Replit) ── */}
        {showGreeting && (
          <div className="flex justify-center pt-6 pb-0 flex-shrink-0">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
              style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              {user?.imageUrl
                ? <img src={user.imageUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                : <div className="w-5 h-5 rounded-full bg-purple-200 flex items-center justify-center text-[10px] font-bold text-purple-700">{name[0]?.toUpperCase()}</div>
              }
              {workspaceName}'s Workspace
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>
        )}

        {/* ── Center zone: greeting + input ── */}
        <div className={`flex-1 flex flex-col ${showGreeting ? "justify-center" : "justify-start pt-6"} px-6`}>
          <div className="max-w-2xl mx-auto w-full">

            {/* Greeting — only when no messages */}
            <AnimatePresence>
              {showGreeting && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="text-center mb-6"
                >
                  <h1 className="text-2xl font-bold text-gray-900 mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {greeting}
                  </h1>
                  <p className="text-gray-400 text-sm">{subtitle}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages (when chatting) */}
            {!showGreeting && (
              <div className="space-y-6 mb-6">
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={msg.role === "user" ? "max-w-[78%]" : "w-full"}>
                      {msg.role === "assistant" && (
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-5 h-5 rounded-md flex items-center justify-center"
                            style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
                            <Sparkles className="w-2.5 h-2.5 text-white" />
                          </div>
                          <span className="text-xs font-semibold text-gray-400">RapportAI</span>
                        </div>
                      )}
                      <div
                        className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "text-white rounded-tr-sm"
                            : "bg-white text-gray-800 rounded-tl-sm border border-gray-100"
                        }`}
                        style={msg.role === "user"
                          ? { background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 2px 8px rgba(124,58,237,0.22)" }
                          : { boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }
                        }
                      >
                        {msg.role === "assistant" ? (
                          msg.streaming && !msg.text
                            ? <span className="flex items-center gap-1.5 text-gray-400"><Loader2 className="w-3.5 h-3.5 animate-spin" />En train d'écrire…</span>
                            : <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-sm max-w-none prose-p:my-1 prose-headings:font-semibold">{msg.text}</ReactMarkdown>
                        ) : msg.text}
                      </div>
                      {msg.role === "assistant" && !msg.streaming && msg.navAction && (
                        <motion.button
                          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                          onClick={() => {
                            if (msg.navAction!.injection) {
                              updateReport({ pendingContextInjection: msg.navAction!.injection });
                            }
                            setLocation(msg.navAction!.path);
                          }}
                          className="mt-2 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition-all"
                          style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff" }}
                        >
                          Aller à {msg.navAction.label} <ArrowRight className="w-3 h-3" />
                        </motion.button>
                      )}
                      {msg.role === "assistant" && !msg.streaming && !msg.navAction && msg.navSuggestion && (
                        <motion.button
                          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                          onClick={() => setLocation(msg.navSuggestion!.path)}
                          className="mt-2 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition-all"
                          style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff" }}
                        >
                          Aller à {msg.navSuggestion.label} <ArrowRight className="w-3 h-3" />
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}

            {/* Input box */}
            <div
              className="flex items-end gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 transition-all focus-within:border-purple-300 focus-within:shadow-sm"
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
            >
              <div className="flex-1 relative" style={{ minHeight: 24 }}>
                {/* Animated placeholder overlay */}
                {!input && (
                  <div className="absolute inset-0 pointer-events-none flex items-center overflow-hidden">
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={placeholder.text}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: placeholder.visible ? 1 : 0, y: placeholder.visible ? 0 : -6 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.35 }}
                        className="text-sm text-gray-400 truncate leading-relaxed select-none"
                      >
                        {placeholder.text}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); autoResize(e.target); }}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  placeholder=""
                  rows={1}
                  className="w-full text-sm text-gray-800 outline-none resize-none bg-transparent leading-relaxed disabled:opacity-50"
                  style={{ minHeight: 24, maxHeight: 140 }}
                />
              </div>
              <button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-30 hover:opacity-90 transition-all"
                style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Send className="w-3.5 h-3.5 text-white" />}
              </button>
            </div>

            {/* Quick action pills — BELOW input, only on greeting screen */}
            <AnimatePresence>
              {showGreeting && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex flex-wrap justify-center gap-2 mt-4"
                >
                  {quickActions.map((a) => (
                    <button
                      key={a.label}
                      onClick={a.action}
                      className="text-xs font-medium px-3 py-1.5 rounded-full border border-gray-200 bg-white text-gray-600 hover:border-purple-300 hover:text-purple-600 hover:bg-purple-50 transition-all"
                    >
                      {a.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Recent sections (bottom, like Replit's recent projects) ── */}
        {showGreeting && recentSections.length > 0 && (
          <div className="flex-shrink-0 px-6 pb-8 mt-8">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Tes sections récentes
                </span>
                <button onClick={() => setLocation("/rapports")}
                  className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1">
                  Voir tout <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {recentSections.map((s) => (
                  <button
                    key={s.field}
                    onClick={() => setLocation(s.path)}
                    className="rounded-xl border border-gray-200 bg-white p-3 text-left hover:border-purple-200 hover:shadow-sm transition-all group"
                    style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                  >
                    <div className="w-full h-16 rounded-lg mb-2 overflow-hidden"
                      style={{ background: "#f8fafc", border: "1px solid #f1f5f9" }}>
                      <div className="w-full h-full overflow-hidden relative">
                        <div className="absolute top-0 left-0 pointer-events-none"
                          style={{ transform: "scale(0.18)", transformOrigin: "top left", width: "556%",
                            padding: "10px", fontFamily: "Times New Roman, serif", fontSize: "11pt",
                            lineHeight: "1.5", color: "#111", whiteSpace: "pre-wrap" }}>
                          {((report as Record<string, string>)[s.field] || "").slice(0, 600)}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-gray-700 group-hover:text-purple-700 transition-colors">{s.label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Sauvegardé auto</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
