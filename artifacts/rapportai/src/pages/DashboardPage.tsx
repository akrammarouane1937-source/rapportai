import { useState, useRef, useEffect } from "react";
import { useUser } from "@clerk/react";
import { motion } from "framer-motion";
import { Plus, ChevronRight, Send, Loader2, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarSpacer } from "@/components/layout/Sidebar";
import { StatsRow } from "@/components/dashboard/StatsRow";
import { ActiveReportCard } from "@/components/dashboard/ActiveReportCard";
import { FiguresPanel } from "@/components/dashboard/FiguresPanel";
import { FloatingChat } from "@/components/dashboard/FloatingChat";
import { getReport } from "@/lib/reportStore";
import { getMyPlan, PLAN_LIMITS } from "@/lib/userPlan";

const BASE_PATH = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

function wordCount(s?: string) {
  return s ? s.trim().split(/\s+/).filter(Boolean).length : 0;
}

function computeDashboard() {
  const d = getReport();

  const stepDone: Record<number, boolean> = {
    1: !!(d.theme && d.school),
    2: !!d.studentName,
    3: !!(d.dedicaces || d.remerciements),
    4: !!d.resume,
    5: !!(d.introduction),
    6: !!d.introduction,
    7: !!d.partieI,
    8: !!d.partieII,
    9: !!d.conclusion,
  };

  const completedSteps = Object.entries(stepDone)
    .filter(([, v]) => v)
    .map(([k]) => Number(k));

  const currentStep = ([1, 2, 3, 4, 5, 6, 7, 8, 9].find((n) => !stepDone[n])) ?? 9;

  const totalWords =
    wordCount(d.introduction) +
    wordCount(d.partieI) +
    wordCount(d.partieII) +
    wordCount(d.conclusion) +
    wordCount(d.resume);

  const title = d.theme
    ? `${d.theme.slice(0, 55)}${d.theme.length > 55 ? "…" : ""} — ${d.school ?? ""}`
    : "Mon rapport";

  return { completedSteps, currentStep, totalWords, title, reportType: d.reportType ?? "PFE" };
}

// ── Inline AI Assistant card ──────────────────────────────────────────────────
interface Msg { role: "user" | "assistant"; text: string; id: string }

function AIAssistantCard() {
  const [messages, setMessages] = useState<Msg[]>([{
    id: "intro", role: "assistant",
    text: "Bonjour ! Je suis ton assistant IA. Comment puis-je t'aider avec ton rapport ?",
  }]);
  const [input, setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef           = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setLoading(true);
    const assistantId = crypto.randomUUID();
    setMessages((p) => [...p, { id: assistantId, role: "assistant", text: "" }]);

    const report  = getReport();
    const history = [...messages, userMsg]
      .filter((m) => m.id !== "intro")
      .map((m) => ({ role: m.role, content: m.text }));

    try {
      const resp = await fetch(`${BASE_PATH}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history, mode: "assistant",
          theme: report.theme, reportType: report.reportType,
          school: report.school, filiere: report.filiere, studentName: report.studentName,
        }),
      });
      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);
      const reader = resp.body.getReader();
      const dec    = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const j = JSON.parse(line.slice(6)) as { content?: string; done?: boolean };
            if (j.content) setMessages((p) => p.map((m) => m.id === assistantId ? { ...m, text: m.text + j.content } : m));
          } catch { /* skip */ }
        }
      }
    } catch {
      setMessages((p) => p.map((m) => m.id === assistantId ? { ...m, text: "Erreur — réessayez." } : m));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full rounded-2xl overflow-hidden bg-white border border-gray-100 flex flex-col"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100"
        style={{ background: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)" }}>
        <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        <div>
          <p className="text-white text-sm font-semibold leading-none" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Assistant IA
          </p>
          <p className="text-purple-200 text-xs mt-0.5">Aide à la rédaction académique</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50/40" style={{ minHeight: 0 }}>
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[90%] px-3 py-2 rounded-xl text-xs leading-relaxed
              ${msg.role === "assistant"
                ? "bg-white text-gray-700 border border-gray-100"
                : "bg-purple-600 text-white"
              }`}>
              {msg.text || (loading && msg.id !== "intro" && (
                <span className="flex items-center gap-1 text-gray-400">
                  <Loader2 className="w-3 h-3 animate-spin" /> …
                </span>
              ))}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-2.5 border-t border-gray-100 bg-white flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          disabled={loading}
          placeholder="Ex: Comment structurer ma conclusion ?"
          className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading}
          className="w-7 h-7 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
        >
          {loading
            ? <Loader2 className="w-3 h-3 text-white animate-spin" />
            : <Send className="w-3 h-3 text-white" />
          }
        </button>
      </div>
    </div>
  );
}

// ── Main dashboard ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [, setLocation]  = useLocation();
  const { user }         = useUser();
  const { completedSteps, currentStep, totalWords, title, reportType } = computeDashboard();

  const plan           = getMyPlan();
  const revisionLimit  = PLAN_LIMITS[plan.planId].revisions;
  const hasActiveReport = completedSteps.length > 0;

  const stepPaths: Record<number, string> = {
    1: "/rapport/step-1", 2: "/rapport/step-2", 3: "/rapport/step-3",
    4: "/rapport/step-4", 5: "/rapport/step-5", 6: "/rapport/step-6",
    7: "/rapport/partie-i", 8: "/rapport/partie-ii", 9: "/rapport/step-9",
  };

  const handleContinue = () => setLocation(stepPaths[currentStep] ?? "/rapport/step-1");

  return (
    <div className="flex min-h-screen bg-[#f9f8ff]">
      <Sidebar />
      <SidebarSpacer />

      <main className="flex-1 p-8 min-w-0">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

            {/* Header */}
            <div className="flex items-center justify-between mb-7">
              <div>
                <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Bonjour, {user?.firstName || "Étudiant"} 👋
                </h1>
                <p className="text-gray-500 mt-0.5 text-sm">
                  {hasActiveReport
                    ? "Tu as un rapport en cours. Continue là où tu t'es arrêté."
                    : "Prêt à générer ton rapport ? C'est parti."}
                </p>
              </div>
              <Button
                data-testid="button-new-report"
                onClick={() => setLocation("/rapport/step-1")}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                style={{ boxShadow: "0 4px 24px rgba(124,58,237,0.25)" }}
              >
                <Plus className="w-4 h-4" />
                {hasActiveReport ? "Nouveau rapport" : "Commencer maintenant"}
              </Button>
            </div>

            {/* Stats row */}
            <div className="mb-6">
              <StatsRow
                progressionGlobale={Math.round((completedSteps.length / 9) * 100)}
                sectionsCompletes={completedSteps.length}
                totalSections={9}
                motsGeneres={totalWords}
                revisionCount={plan.revisionCount}
                revisionLimit={revisionLimit}
              />
            </div>

            {/* Active report */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {hasActiveReport ? "Rapport en cours" : "Démarrer un rapport"}
                </h2>
                <button
                  className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1 font-medium"
                  data-testid="link-all-reports"
                  onClick={() => setLocation("/rapports")}
                >
                  Voir tous les rapports
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <ActiveReportCard
                title={hasActiveReport ? title : "Nouveau rapport PFE/Stage/Mémoire"}
                type={reportType}
                currentStep={currentStep}
                completedSteps={completedSteps}
                updatedAt={hasActiveReport ? "Sauvegarde auto" : "Pas encore commencé"}
                onContinue={handleContinue}
              />
            </div>

            {/* Bottom row: figures + AI Assistant */}
            <div className="grid grid-cols-5 gap-4" style={{ minHeight: 220 }}>
              <div className="col-span-3">
                <FiguresPanel />
              </div>
              <div className="col-span-2">
                <AIAssistantCard />
              </div>
            </div>

          </motion.div>
        </div>
      </main>

      <FloatingChat />
    </div>
  );
}
