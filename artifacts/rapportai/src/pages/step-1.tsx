import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ChatMessage, StepTransitionCard } from "@/components/chat-panel";
import { ChatInput } from "@/components/chat-input";
import { useReportStore } from "@/lib/store";
import { API_BASE } from "@/lib/apiBase";
import { Check } from "lucide-react";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type Phase = "theme" | "school" | "filiere" | "type" | "annee" | "done";
type Msg = { role: "agent" | "user"; content: string | React.ReactNode };

const TYPE_OPTIONS: Array<{ label: string; value: "PFE" | "stage" | "memoire" }> = [
  { label: "PFE", value: "PFE" },
  { label: "Stage", value: "stage" },
  { label: "Mémoire", value: "memoire" },
];

const SKIP_PHRASES = ["passer", "skip", "peu importe", "je sais pas", "sais pas", "laisse tomber", "aucune", "non", "pas de", "rien"];

const isSkip = (text: string) =>
  SKIP_PHRASES.some((p) => text.toLowerCase().includes(p));

const QUESTION_STARTERS = [
  "pourquoi", "c'est quoi", "c quoi", "comment", "est-ce", "est ce", "peux-tu",
  "peux tu", "tu peux", "à quoi", "pour quoi", "quel", "quelle", "quels",
  "why", "what", "how",
];

// Detect when the student asks a question / goes off-script instead of answering.
// Themes are freeform, so there we only trust a trailing "?".
const isQuestion = (text: string, phase: Phase) => {
  const t = text.trim().toLowerCase();
  if (t.endsWith("?")) return true;
  if (phase === "theme") return false;
  return QUESTION_STARTERS.some((q) => t === q || t.startsWith(q + " "));
};

const toApiMsgs = (list: Msg[]) =>
  list
    .filter((m) => typeof m.content === "string" && (m.content as string).trim())
    .map((m) => ({ role: m.role === "agent" ? "assistant" : "user", content: m.content as string }));

const schoolReaction = (school: string): string => {
  const s = school.toUpperCase();
  if (s.includes("EMSI")) return `EMSI, super. Et ta filière ?`;
  if (s.includes("ENCG")) return `ENCG, parfait. Et ta filière ?`;
  if (s.includes("ENSA")) return `ENSA, ok. Et ta filière ?`;
  if (s.includes("ENSIAS")) return `ENSIAS, bonne école. Et ta filière ?`;
  if (s.includes("UIR")) return `UIR, top. Et ta filière ?`;
  if (s.includes("ISCAE")) return `ISCAE, nickel. Et ta filière ?`;
  if (s.includes("HEM")) return `HEM, classe. Et ta filière ?`;
  return `${school}, ok. Et ta filière ?`;
};

const filiereReaction = (filiere: string): string => {
  const f = filiere.toLowerCase();
  if (f.includes("finance") || f.includes("compta")) return `Finance — bon choix. Quel type de rapport ?`;
  if (f.includes("info") || f.includes("dev") || f.includes("génie")) return `Génie info, parfait. Quel type de rapport ?`;
  if (f.includes("market")) return `Marketing — intéressant. Quel type de rapport ?`;
  if (f.includes("manage")) return `Management, ok. Quel type de rapport ?`;
  return `${filiere}, noté. Quel type de rapport ?`;
};

const STEP1_KEY = "rapportai_chat_step1";
const WELCOME = "Bienvenue sur RapportAI. On va construire ton rapport ensemble, étape par étape. Commence par le thème : c'est quoi ton sujet ?";

export default function Step1() {
  const [, setLocation] = useLocation();
  const { report, updateReport } = useReportStore();

  // Restore conversation across refresh (read once on mount)
  const [restored] = useState<{ msgs?: Msg[]; phase?: Phase; disclaimerAccepted?: boolean } | null>(() => {
    try {
      const raw = localStorage.getItem(STEP1_KEY);
      return raw ? (JSON.parse(raw) as { msgs?: Msg[]; phase?: Phase; disclaimerAccepted?: boolean }) : null;
    } catch { return null; }
  });

  const [phase, setPhase] = useState<Phase>(restored?.phase ?? "theme");
  const [typing, setTyping] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(restored?.disclaimerAccepted ?? false);
  const [disclaimerChecked, setDisclaimerChecked] = useState(restored?.disclaimerAccepted ?? false);
  const [msgs, setMsgs] = useState<Msg[]>(
    restored?.msgs && restored.msgs.length > 0
      ? restored.msgs
      : [{ role: "agent", content: WELCOME }]
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, typing, phase]);

  // Persist conversation + flow position so a refresh resumes where they left off
  useEffect(() => {
    try {
      const serializable = msgs
        .filter((m) => typeof m.content === "string")
        .map((m) => ({ role: m.role, content: m.content as string }));
      localStorage.setItem(STEP1_KEY, JSON.stringify({ msgs: serializable, phase, disclaimerAccepted }));
    } catch { /* quota/unavailable — non-fatal */ }
  }, [msgs, phase, disclaimerAccepted]);

  const push = (...m: Msg[]) => setMsgs((p) => [...p, ...m]);

  const reply = async (agentText: string, nextPhase: Phase, ms = 480) => {
    setTyping(true);
    await delay(ms);
    setTyping(false);
    push({ role: "agent", content: agentText });
    setPhase(nextPhase);
  };

  // Stream a real conversational reply from the AI (step-1 system prompt),
  // used when the student asks a question instead of answering. Phase is NOT
  // advanced and the input is NOT stored — they can answer afterwards.
  const answerQuestion = async (convo: Msg[]) => {
    setTyping(true);
    let acc = "";
    try {
      const res = await fetch(`${API_BASE}/api/converse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: toApiMsgs(convo), step: 1, profile: report, generatedSections: [] }),
      });
      if (!res.ok || !res.body) throw new Error("no body");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const d = JSON.parse(raw) as { text?: string };
            if (d.text) acc += d.text;
          } catch { /* ignore non-text events */ }
        }
      }
    } catch { acc = ""; }
    setTyping(false);
    push({
      role: "agent",
      content: acc.trim() || "Bonne question. J'ai juste besoin de cette info pour personnaliser ton rapport — tu peux me répondre ?",
    });
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || typing) return;
    const trimmed = text.trim();

    // Off-topic / question → answer it for real instead of storing it blindly.
    // Exception: a "skip" phrase on the filière step is handled below, not here.
    if (phase !== "type" && phase !== "done") {
      const filiereSkip = phase === "filiere" && isSkip(trimmed);
      if (!filiereSkip && isQuestion(trimmed, phase)) {
        push({ role: "user", content: trimmed });
        await answerQuestion([...msgs, { role: "user", content: trimmed }]);
        return;
      }
    }

    if (phase === "theme") {
      updateReport({ theme: trimmed });
      push({ role: "user", content: trimmed });
      await reply("Ton école ou université ?", "school", 520);

    } else if (phase === "school") {
      updateReport({ school: trimmed });
      push({ role: "user", content: trimmed });
      await reply(schoolReaction(trimmed), "filiere", 480);

    } else if (phase === "filiere") {
      if (isSkip(trimmed)) {
        // User wants to skip — don't save a bad value, leave filière blank
        push({ role: "user", content: trimmed });
        await reply("Pas de problème, on peut laisser ça. Quel type de rapport ?", "type", 420);
      } else {
        updateReport({ filiere: trimmed });
        push({ role: "user", content: trimmed });
        await reply(filiereReaction(trimmed), "type", 480);
      }

    } else if (phase === "annee") {
      updateReport({ academicYear: trimmed });
      push({ role: "user", content: trimmed });
      await reply("Parfait, toutes les infos sont là.", "done", 400);
    }
  };

  const handleTypeSelect = async (value: "PFE" | "stage" | "memoire", label: string) => {
    if (phase !== "type" || typing) return;
    updateReport({ reportType: value, currentStep: 1 });
    push({ role: "user", content: label });
    const reaction =
      value === "PFE"      ? `PFE — on va faire quelque chose de solide. Année académique ? (ex: 2025-2026)` :
      value === "stage"    ? `Rapport de stage, ok. Année académique ? (ex: 2025-2026)` :
                             `Mémoire — beau projet. Année académique ? (ex: 2025-2026)`;
    await reply(reaction, "annee", 460);
  };

  return (
    <Layout stepName="Informations générales" stepNumber={1}>
      <div className="flex-1 overflow-y-auto py-4 px-2 md:py-5 md:px-3">
        {msgs.map((m, i) => (
          <ChatMessage key={i} role={m.role as "agent" | "user"} content={m.content} />
        ))}

        {/* Disclaimer — shown once before first input */}
        {!disclaimerAccepted && phase === "theme" && (
          <div className="mx-10 mb-4 px-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
              <p className="text-xs text-gray-600 leading-relaxed">
                RapportAI génère un <strong>rapport académique complet</strong> à partir des informations que tu fournis.
                Tu t'engages à vérifier son contenu, à le personnaliser selon ton contexte spécifique,
                et à y intégrer tes propres analyses avant toute soumission académique.
              </p>
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <button
                  type="button"
                  onClick={() => setDisclaimerChecked((v) => !v)}
                  className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                    disclaimerChecked
                      ? "bg-purple-600 border-purple-600"
                      : "border-gray-300 bg-white group-hover:border-purple-400"
                  }`}
                >
                  {disclaimerChecked && <Check className="w-2.5 h-2.5 text-white" />}
                </button>
                <span className="text-xs text-gray-700">
                  J'accepte les{" "}
                  <a href="/terms" target="_blank" className="text-purple-600 hover:underline">Conditions Générales d'Utilisation</a>
                  {" "}et la{" "}
                  <a href="/privacy" target="_blank" className="text-purple-600 hover:underline">Politique de Confidentialité</a>.
                </span>
              </label>
              <button
                onClick={() => { if (disclaimerChecked) setDisclaimerAccepted(true); }}
                disabled={!disclaimerChecked}
                className="w-full py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: disclaimerChecked ? "#7c3aed" : "#e5e7eb", color: disclaimerChecked ? "#fff" : "#9ca3af" }}
              >
                Commencer
              </button>
            </div>
          </div>
        )}

        {typing && <ChatMessage role="agent" content="" isTyping />}

        {/* Type selector buttons */}
        {phase === "type" && !typing && (
          <div className="flex gap-2 flex-wrap ml-10 mb-4 px-4">
            {TYPE_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => handleTypeSelect(o.value, o.label)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ border: "1px solid #7c3aed55", color: "#a78bfa", background: "#7c3aed11" }}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}

        {phase === "done" && !typing && (
          <StepTransitionCard
            title="Informations générales enregistrées"
            subtitle="On continue avec tes informations personnelles."
            onNext={() => { updateReport({ currentStep: 2 }); setLocation("/rapport/step-2"); }}
            nextLabel="Étape 2 : Infos personnelles"
          />
        )}
        <div ref={bottomRef} />
      </div>
      <div className="shrink-0 border-t border-border">
        <ChatInput
          onSend={handleSend}
          disabled={!disclaimerAccepted || phase === "type" || phase === "done" || typing}
          placeholder={
            phase === "theme"   ? "Ton thème de rapport..." :
            phase === "school"  ? "Ton école / université..." :
            phase === "filiere" ? "Ta filière (ou 'passer' pour continuer)..." :
            phase === "annee"   ? "Année académique..." : ""
          }
        />
      </div>
    </Layout>
  );
}
