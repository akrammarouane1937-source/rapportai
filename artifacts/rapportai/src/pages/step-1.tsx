import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ChatMessage, StepTransitionCard, ThinkingCard } from "@/components/chat-panel";
import { ChatInput } from "@/components/chat-input";
import { useReportStore } from "@/lib/store";
import { AnimatePresence } from "framer-motion";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type Phase = "theme" | "school" | "filiere" | "type" | "annee" | "done";
type Msg = { role: "agent" | "user"; content: string | React.ReactNode };

const TYPE_OPTIONS: Array<{ label: string; value: "PFE" | "stage" | "memoire" }> = [
  { label: "PFE", value: "PFE" },
  { label: "Stage", value: "stage" },
  { label: "Mémoire", value: "memoire" },
];

const THINKING: Record<Phase, { title: string; detail: string } | null> = {
  theme:   null,
  school:  { title: "Analyse du thème de recherche", detail: "Sujet enregistré. Je vais maintenant identifier ton établissement pour personnaliser la mise en page et les références institutionnelles." },
  filiere: { title: "Identification de l'établissement", detail: "École enregistrée. La filière va déterminer la terminologie technique et les normes de citation adaptées." },
  type:    { title: "Détermination du profil académique", detail: "Filière enregistrée. Le type de rapport (PFE, Stage, Mémoire) conditionne la structure, les attendus du jury et la longueur cible." },
  annee:   { title: "Configuration du type de rapport", detail: "Type sélectionné. L'année académique sera intégrée dans la page de garde et les en-têtes." },
  done:    { title: "Finalisation du profil étudiant", detail: "Toutes les informations sont en mémoire. Je vais maintenant générer un rapport personnalisé pour toi." },
};

export default function Step1() {
  const [, setLocation] = useLocation();
  const { updateReport } = useReportStore();
  const [phase, setPhase] = useState<Phase>("theme");
  const [thinking, setThinking] = useState<{ title: string; detail: string } | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "agent", content: "Bienvenue sur RapportAI 👋 On va construire ton rapport ensemble, étape par étape. Commence par le thème — c'est quoi ton sujet ?" },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, thinking, phase]);

  const push = (...m: Msg[]) => setMsgs((p) => [...p, ...m]);

  const think = async (nextPhase: Phase) => {
    const t = THINKING[nextPhase];
    if (!t) return;
    setThinking(t);
    await delay(700);
    setThinking(null);
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || thinking) return;
    const trimmed = text.trim();

    if (phase === "theme") {
      updateReport({ theme: trimmed });
      push({ role: "user", content: trimmed });
      await think("school");
      push({ role: "agent", content: "Ton école ou université ?" });
      setPhase("school");

    } else if (phase === "school") {
      updateReport({ school: trimmed });
      push({ role: "user", content: trimmed });
      await think("filiere");
      push({ role: "agent", content: "Ta filière ?" });
      setPhase("filiere");

    } else if (phase === "filiere") {
      updateReport({ filiere: trimmed });
      push({ role: "user", content: trimmed });
      await think("type");
      push({ role: "agent", content: "Type de rapport :" });
      setPhase("type");

    } else if (phase === "annee") {
      updateReport({ academicYear: trimmed });
      push({ role: "user", content: trimmed });
      await think("done");
      push({ role: "agent", content: "Parfait, toutes les informations générales sont enregistrées ✅" });
      setPhase("done");
    }
  };

  const handleTypeSelect = async (value: "PFE" | "stage" | "memoire", label: string) => {
    if (phase !== "type" || thinking) return;
    updateReport({ reportType: value, currentStep: 1 });
    push({ role: "user", content: label });
    await think("annee");
    push({ role: "agent", content: "Année académique ? (ex: 2025-2026)" });
    setPhase("annee");
  };

  return (
    <Layout stepName="Informations générales" stepNumber={1}>
      <div className="flex-1 overflow-y-auto py-4 px-2 md:py-5 md:px-3">
        {msgs.map((m, i) => (
          <ChatMessage key={i} role={m.role as "agent" | "user"} content={m.content} />
        ))}

        {/* Thinking step — shown between user reply and agent response */}
        <AnimatePresence>
          {thinking && (
            <ThinkingCard key="thinking" title={thinking.title} detail={thinking.detail} />
          )}
        </AnimatePresence>

        {/* Type selector buttons — rendered from live state, not stored in msgs */}
        {phase === "type" && !thinking && (
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

        {phase === "done" && !thinking && (
          <StepTransitionCard
            title="Informations générales enregistrées"
            subtitle="On continue avec tes informations personnelles."
            onNext={() => { updateReport({ currentStep: 2 }); setLocation("/rapport/step-2"); }}
            nextLabel="Étape 2 — Infos personnelles"
          />
        )}
        <div ref={bottomRef} />
      </div>
      <div className="shrink-0 border-t" style={{ borderColor: "#1e293b" }}>
        <ChatInput
          onSend={handleSend}
          disabled={phase === "type" || phase === "done" || !!thinking}
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
