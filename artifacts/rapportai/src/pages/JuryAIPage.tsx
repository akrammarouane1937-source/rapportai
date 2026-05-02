import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Sparkles, Mic, MicOff, RotateCcw,
  GraduationCap, Briefcase, BookOpen, ChevronRight,
  MessageSquare, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarSpacer } from "@/components/layout/Sidebar";
import { UpsellModal } from "@/components/report/UpsellModal";
import { getReport } from "@/lib/reportStore";
import { getMyPlan } from "@/lib/userPlan";

/* ── Jury members ──────────────────────────────────────────────────────── */
const JURY = [
  {
    id: "benali",
    name: "Pr. Hassan Benali",
    role: "Président du Jury",
    specialty: "Professeur des Universités",
    initial: "HB",
    color: "bg-purple-600",
    icon: <GraduationCap className="w-4 h-4" />,
  },
  {
    id: "alaoui",
    name: "Dr. Fatima Zahra Alaoui",
    role: "Membre du Jury",
    specialty: "Experte en Méthodologie",
    initial: "FZ",
    color: "bg-indigo-500",
    icon: <BookOpen className="w-4 h-4" />,
  },
  {
    id: "mansouri",
    name: "M. Youssef El Mansouri",
    role: "Expert Invité",
    specialty: "Directeur Professionnel",
    initial: "YM",
    color: "bg-slate-600",
    icon: <Briefcase className="w-4 h-4" />,
  },
];

/* ── Quick prompts ─────────────────────────────────────────────────────── */
const QUICK_REPLIES = [
  "Pouvez-vous répéter la question ?",
  "Je vais développer mon raisonnement…",
  "D'après la littérature consultée…",
  "Dans notre contexte marocain…",
  "Les résultats montrent que…",
  "Je reconnais cette limite de mon étude.",
];

/* ── Types ─────────────────────────────────────────────────────────────── */
interface ChatMessage {
  id: string;
  role: "user" | "jury";
  content: string;
  speaker?: string;   // e.g. "Pr. Hassan Benali"
  streaming?: boolean;
}

/* ── Detect jury speaker from markdown bold prefix ─────────────────────── */
function parseSpeaker(text: string): { speaker: string | undefined; body: string } {
  const m = text.match(/^\*\*([^*]+)\*\*\s*:?\s*/);
  if (m) return { speaker: m[1].trim(), body: text.slice(m[0].length) };
  return { speaker: undefined, body: text };
}

function getJuryMember(speaker: string | undefined) {
  if (!speaker) return JURY[0];
  return JURY.find((j) => speaker.includes(j.id.charAt(0).toUpperCase()) || j.name.includes(speaker.split(" ")[1] ?? "")) ?? JURY[0];
}

/* ── Streaming hook ────────────────────────────────────────────────────── */
function useJuryStream() {
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const ask = useCallback(
    async (
      messages: ChatMessage[],
      reportContext: object,
      onChunk: (chunk: string) => void,
      onDone: () => void,
    ) => {
      if (streaming) return;
      abortRef.current = new AbortController();
      setStreaming(true);

      const apiMessages = messages.map((m) => ({
        role: m.role,
        content: m.speaker ? `**${m.speaker}:** ${m.content}` : m.content,
      }));

      try {
        const res = await fetch("/api/jury", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages, reportContext }),
          signal: abortRef.current.signal,
        });

        const reader = res.body?.getReader();
        if (!reader) return;
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6)) as { content?: string; done?: boolean; error?: string };
              if (data.content) onChunk(data.content);
              if (data.done || data.error) { onDone(); setStreaming(false); return; }
            } catch { /* ignore parse errors */ }
          }
        }
      } catch {
        /* aborted or network error */
      } finally {
        setStreaming(false);
        onDone();
      }
    },
    [streaming],
  );

  const abort = () => abortRef.current?.abort();
  return { ask, streaming, abort };
}

/* ── Message bubble ────────────────────────────────────────────────────── */
function Bubble({ msg, studentName }: { msg: ChatMessage; studentName: string }) {
  const isUser = msg.role === "user";
  const member = isUser ? null : getJuryMember(msg.speaker);

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end gap-3 mb-5"
      >
        <div className="max-w-[72%]">
          <div className="bg-purple-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed shadow-sm">
            {msg.content}
          </div>
          <p className="text-xs text-gray-400 mt-1 text-right">{studentName}</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 text-purple-700 font-bold text-xs">
          {studentName[0]?.toUpperCase() ?? "É"}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 mb-5"
    >
      <div className={`w-8 h-8 rounded-full ${member?.color ?? "bg-purple-600"} flex items-center justify-center flex-shrink-0 text-white font-bold text-xs flex-shrink-0`}>
        {member?.initial ?? "J"}
      </div>
      <div className="max-w-[78%]">
        {msg.speaker && (
          <p className="text-xs font-semibold text-gray-500 mb-1">{msg.speaker}</p>
        )}
        <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-800 leading-relaxed shadow-sm">
          {msg.content}
          {msg.streaming && (
            <span className="inline-flex gap-0.5 ml-1.5 align-middle">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-1 h-1 bg-purple-400 rounded-full inline-block"
                  animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Main page ─────────────────────────────────────────────────────────── */
export default function JuryAIPage() {
  const report       = getReport();
  const plan         = getMyPlan();
  const isAllowed    = plan.planId === "pro" || plan.planId === "premium";
  const studentName  = report.studentName ?? "Étudiant(e)";

  const [messages, setMessages]     = useState<ChatMessage[]>([]);
  const [input, setInput]           = useState("");
  const [started, setStarted]       = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [exchangeCount, setExchangeCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const { ask, streaming } = useJuryStream();

  const reportContext = {
    theme:          report.theme,
    school:         report.school,
    filiere:        report.filiere,
    reportType:     report.reportType,
    studentName:    report.studentName,
    resume:         report.resume,
    introduction:   report.introduction,
    partieI:        report.partieI,
    partieII:       report.partieII,
    conclusion:     report.conclusion,
    encadrantPeda:  report.encadrantPeda,
  };

  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => { scrollToBottom(); }, [messages]);

  /* ── Add jury message (streaming) ── */
  const addJuryMessage = useCallback((history: ChatMessage[]) => {
    const msgId = Date.now().toString();
    let accumulated = "";

    setMessages((prev) => [
      ...prev,
      { id: msgId, role: "jury", content: "", streaming: true },
    ]);

    ask(
      history,
      reportContext,
      (chunk) => {
        accumulated += chunk;
        const { speaker, body } = parseSpeaker(accumulated);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? { ...m, content: body, speaker, streaming: true }
              : m,
          ),
        );
      },
      () => {
        const { speaker, body } = parseSpeaker(accumulated);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? { ...m, content: body, speaker, streaming: false }
              : m,
          ),
        );
        setExchangeCount((n) => n + 1);
        inputRef.current?.focus();
      },
    );
  }, [ask, reportContext]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Start simulation ── */
  const handleStart = () => {
    if (!isAllowed) { setUpsellOpen(true); return; }
    setStarted(true);
    setMessages([]);
    setExchangeCount(0);
    addJuryMessage([]);
  };

  /* ── Student reply ── */
  const handleSend = (text = input.trim()) => {
    if (!text || streaming) return;
    setInput("");

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };

    setMessages((prev) => {
      const next = [...prev, userMsg];
      addJuryMessage(next);
      return next;
    });
  };

  /* ── Reset ── */
  const handleReset = () => {
    setStarted(false);
    setMessages([]);
    setExchangeCount(0);
  };

  /* ─────────────────────────── RENDER ─────────────────────────────────── */
  return (
    <div className="flex min-h-screen bg-[#f9f8ff]">
      <Sidebar />
      <SidebarSpacer />

      <main className="flex-1 flex overflow-hidden" style={{ height: "100vh" }}>

        {/* ── Left panel ── */}
        <div className="w-72 flex-shrink-0 border-r border-gray-100 bg-white flex flex-col p-5 overflow-y-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <h1
                className="font-bold text-gray-900 text-base"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                JuryAI
              </h1>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">Pro</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Simule ta soutenance avec un jury académique IA. Entraîne-toi avant le jour J.
            </p>
          </div>

          {/* Report context */}
          {report.theme ? (
            <div className="bg-purple-50 rounded-xl p-3.5 mb-5 border border-purple-100">
              <p className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-2">Rapport évalué</p>
              <p className="text-xs font-semibold text-gray-800 leading-snug mb-1">{report.theme}</p>
              <p className="text-xs text-gray-500">{report.school} · {report.filiere}</p>
              {report.reportType && (
                <span className="inline-block mt-1.5 text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-medium">
                  {report.reportType}
                </span>
              )}
            </div>
          ) : (
            <div className="bg-amber-50 rounded-xl p-3.5 mb-5 border border-amber-100">
              <p className="text-xs text-amber-700 font-medium leading-relaxed">
                Remplis d'abord l'étape 1 pour que le jury connaisse ton sujet.
              </p>
            </div>
          )}

          {/* Jury members */}
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Composition du jury</p>
          <div className="space-y-3 mb-6">
            {JURY.map((j) => (
              <div key={j.id} className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl ${j.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                  {j.initial}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800 leading-snug">{j.name}</p>
                  <p className="text-xs text-gray-400">{j.role}</p>
                  <p className="text-xs text-purple-500">{j.specialty}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Criteria */}
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Critères évalués</p>
          <ul className="space-y-1.5 text-xs text-gray-500 mb-6">
            {["Maîtrise du sujet", "Rigueur méthodologique", "Clarté des réponses", "Gestion du stress", "Pertinence des analyses"].map((c) => (
              <li key={c} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
                {c}
              </li>
            ))}
          </ul>

          {/* Stats */}
          {started && (
            <div className="mt-auto pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-gray-500">Échanges</span>
                <span className="font-bold text-purple-700">{exchangeCount}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-purple-600 transition-all duration-500"
                  style={{ width: `${Math.min((exchangeCount / 8) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                {exchangeCount >= 8 ? "Bilan disponible — continue à pratiquer." : `${8 - exchangeCount} échange(s) avant le bilan`}
              </p>
            </div>
          )}
        </div>

        {/* ── Right panel: chat ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Top bar */}
          <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-4 h-4 text-purple-600" />
              <span className="font-semibold text-gray-900 text-sm">Simulation de soutenance</span>
              {streaming && (
                <span className="flex items-center gap-1.5 text-xs text-purple-600 font-medium">
                  <motion.div
                    className="w-2 h-2 rounded-full bg-purple-600"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  />
                  Le jury réfléchit…
                </span>
              )}
            </div>
            {started && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-gray-400 hover:text-gray-700 gap-1.5 text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Recommencer
              </Button>
            )}
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <AnimatePresence>
              {!started && !isAllowed && (
                /* Gate for non-pro users */
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center h-full text-center"
                >
                  <div className="w-20 h-20 bg-purple-50 rounded-3xl flex items-center justify-center mb-5">
                    <Lock className="w-9 h-9 text-purple-300" />
                  </div>
                  <h2
                    className="text-xl font-bold text-gray-900 mb-2"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    JuryAI est réservé au plan Pro
                  </h2>
                  <p className="text-sm text-gray-500 max-w-sm mb-6 leading-relaxed">
                    Entraîne-toi à ta soutenance avec un jury IA qui pose des questions sur TON rapport. Disponible à partir du plan Pro.
                  </p>
                  <Button
                    onClick={() => setUpsellOpen(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-8 h-11 rounded-xl flex items-center gap-2"
                    style={{ boxShadow: "0 4px 20px rgba(124,58,237,0.35)" }}
                  >
                    <Sparkles className="w-4 h-4" /> Passer au Pro — 449 MAD
                  </Button>
                  <p className="text-xs text-gray-400 mt-3">Paiement unique · Remboursement 48h</p>
                </motion.div>
              )}

              {!started && isAllowed && (
                /* Start screen */
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center h-full text-center"
                >
                  <div className="flex -space-x-3 mb-6">
                    {JURY.map((j) => (
                      <div key={j.id} className={`w-14 h-14 rounded-2xl ${j.color} flex items-center justify-center text-white font-bold text-lg border-4 border-white`}>
                        {j.initial}
                      </div>
                    ))}
                  </div>
                  <h2
                    className="text-xl font-bold text-gray-900 mb-2"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    Prêt(e) pour ta soutenance ?
                  </h2>
                  <p className="text-sm text-gray-500 max-w-sm mb-3 leading-relaxed">
                    {report.theme
                      ? `Le jury a lu ton rapport sur "${report.theme.slice(0, 60)}${report.theme.length > 60 ? "…" : ""}". Il va maintenant te poser des questions.`
                      : "Le jury va te poser des questions sur ton rapport. Réponds comme si tu étais en vrai."}
                  </p>
                  <p className="text-xs text-gray-400 mb-7">
                    Environ 8 échanges · Questions adaptées à ton contenu
                  </p>
                  <Button
                    onClick={handleStart}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-10 h-12 rounded-xl flex items-center gap-2.5 text-base"
                    style={{ boxShadow: "0 6px 24px rgba(124,58,237,0.35)" }}
                  >
                    <Sparkles className="w-5 h-5" />
                    Commencer la simulation
                  </Button>
                </motion.div>
              )}

              {started && (
                <div>
                  {messages.map((msg) => (
                    <Bubble key={msg.id} msg={msg} studentName={studentName} />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Input area */}
          {started && (
            <div className="px-6 py-4 bg-white border-t border-gray-100 flex-shrink-0">
              {/* Quick replies */}
              <div className="flex gap-2 flex-wrap mb-3">
                {QUICK_REPLIES.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    disabled={streaming}
                    className="text-xs bg-gray-50 hover:bg-purple-50 hover:text-purple-700 text-gray-500 border border-gray-200 hover:border-purple-200 px-3 py-1.5 rounded-full transition-all disabled:opacity-40"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {/* Text input */}
              <div className="flex gap-3 items-center">
                <div className="flex-1 flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-100 transition-all">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Réponds à la question du jury…"
                    disabled={streaming}
                    className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 outline-none disabled:opacity-50"
                  />
                  <button
                    title="Réponse vocale (bientôt disponible)"
                    className="text-gray-300 hover:text-gray-500 transition-colors"
                    onClick={() => {}}
                  >
                    <MicOff className="w-4 h-4" />
                  </button>
                </div>
                <Button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || streaming}
                  className="w-11 h-11 p-0 rounded-xl bg-purple-600 hover:bg-purple-700 text-white flex-shrink-0 disabled:opacity-40"
                  style={{ boxShadow: input.trim() ? "0 4px 16px rgba(124,58,237,0.35)" : "none" }}
                >
                  {streaming
                    ? <motion.div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
                    : <Send className="w-4 h-4" />
                  }
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">
                Entraîne-toi autant que tu veux. Le jury adapte ses questions à tes réponses.
              </p>
            </div>
          )}
        </div>
      </main>

      <UpsellModal
        open={upsellOpen}
        onClose={() => setUpsellOpen(false)}
        variant="feature"
        currentPlan={plan.planId}
        featureName="JuryAI"
      />
    </div>
  );
}
