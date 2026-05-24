import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ChatMessage, StepTransitionCard } from "@/components/chat-panel";
import { ChatInput } from "@/components/chat-input";
import { useReportStore } from "@/lib/store";
import { Check } from "lucide-react";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type Phase = "theme" | "school" | "filiere" | "type" | "annee" | "done";
type Msg = { role: "agent" | "user"; content: string | React.ReactNode };

const TYPE_OPTIONS: Array<{ label: string; value: "PFE" | "stage" | "memoire" }> = [
  { label: "PFE", value: "PFE" },
  { label: "Stage", value: "stage" },
  { label: "Mémoire", value: "memoire" },
];

export default function Step1() {
  const [, setLocation] = useLocation();
  const { updateReport } = useReportStore();
  const [phase, setPhase] = useState<Phase>("theme");
  const [typing, setTyping] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "agent", content: "Bienvenue sur RapportAI 👋 On va construire ton rapport ensemble, étape par étape. Commence par le thème : c'est quoi ton sujet ?" },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, typing, phase]);

  const push = (...m: Msg[]) => setMsgs((p) => [...p, ...m]);

  const reply = async (agentText: string, nextPhase: Phase, ms = 420) => {
    setTyping(true);
    await delay(ms);
    setTyping(false);
    push({ role: "agent", content: agentText });
    setPhase(nextPhase);
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || typing) return;
    const trimmed = text.trim();

    if (phase === "theme") {
      updateReport({ theme: trimmed });
      push({ role: "user", content: trimmed });
      await reply("Ton école ou université ?", "school");

    } else if (phase === "school") {
      updateReport({ school: trimmed });
      push({ role: "user", content: trimmed });
      await reply("Ta filière ?", "filiere");

    } else if (phase === "filiere") {
      updateReport({ filiere: trimmed });
      push({ role: "user", content: trimmed });
      await reply("Type de rapport :", "type");

    } else if (phase === "annee") {
      updateReport({ academicYear: trimmed });
      push({ role: "user", content: trimmed });
      await reply("Parfait, toutes les informations générales sont enregistrées ✅", "done");
    }
  };

  const handleTypeSelect = async (value: "PFE" | "stage" | "memoire", label: string) => {
    if (phase !== "type" || typing) return;
    updateReport({ reportType: value, currentStep: 1 });
    push({ role: "user", content: label });
    await reply("Année académique ? (ex: 2025-2026)", "annee");
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

        {/* Type selector buttons — rendered from live state, not stored in msgs */}
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
            phase === "filiere" ? "Ta filière..." :
            phase === "annee"   ? "Année académique..." : ""
          }
        />
      </div>
    </Layout>
  );
}
