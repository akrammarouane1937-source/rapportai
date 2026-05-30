import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ChatMessage, StepTransitionCard, AgentSteps } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { ChatInput } from "@/components/chat-input";
import { useReportStore } from "@/lib/store";
import { useConversation, type TemplateFile } from "@/hooks/use-conversation";
import { useOptionalUser as useUser } from "@/lib/useOptionalClerk";
import { School, X, Upload, FileText } from "lucide-react";

function capitalizeName(name: string): string {
  return name
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ─── Template upload card (proactive, shown above the chat) ──────────────────

interface TemplateCardProps {
  templateFile: TemplateFile | null;
  onFileReady: (file: TemplateFile) => void;
  onRemove: () => void;
  onDismiss: () => void;
  dismissed: boolean;
}

function TemplateCard({ templateFile, onFileReady, onRemove, onDismiss, dismissed }: TemplateCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    // For PDF: read as base64 so the server can pass it to the Anthropic API as a document
    // For Word: just store the filename as context (we can't parse DOCX client-side)
    if (file.type === "application/pdf") {
      const reader = new FileReader();
      reader.onload = () => {
        const b64 = (reader.result as string).split(",")[1]; // strip data:...;base64,
        onFileReady({ name: file.name, data: b64, mimeType: "application/pdf" });
      };
      reader.readAsDataURL(file);
    } else {
      // Word / doc — just pass the name as context
      onFileReady({ name: file.name, mimeType: file.type });
    }
  };

  // Already has a template loaded
  if (templateFile) {
    return (
      <div
        className="flex items-center gap-2 mx-3 mb-2 px-3 py-2 rounded-lg text-sm"
        style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
      >
        <FileText className="w-4 h-4 shrink-0" style={{ color: "#16a34a" }} />
        <span className="flex-1 truncate" style={{ color: "#15803d" }}>
          Modèle chargé : <strong>{templateFile.name}</strong>
          {templateFile.mimeType === "application/pdf"
            ? " — je peux lire ce PDF"
            : " — je tiendrai compte de la structure"}
        </span>
        <button
          onClick={onRemove}
          className="shrink-0 p-0.5 rounded"
          style={{ color: "#86efac" }}
          title="Retirer le modèle"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Dismissed — show only a tiny re-open link
  if (dismissed) {
    return (
      <div className="flex justify-end px-3 mb-1">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="text-xs flex items-center gap-1"
          style={{ color: "#a78bfa" }}
          title="Ajouter le modèle de ton école"
        >
          <School className="w-3 h-3" />
          Ajouter un modèle
          <input ref={fileInputRef} type="file" accept=".docx,.doc,.pdf" className="hidden" onChange={handleFile} />
        </button>
      </div>
    );
  }

  // Initial proactive prompt
  return (
    <div
      className="mx-3 mb-3 rounded-xl overflow-hidden"
      style={{ border: "1px solid #ede9fe", background: "#faf5ff" }}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "#ede9fe" }}
        >
          <School className="w-4 h-4" style={{ color: "#7c3aed" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: "#4c1d95" }}>
            Ton école a un modèle de page de garde ?
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#7c3aed" }}>
            Charge-le (PDF ou Word) et je l'utilise comme base. Sinon, aucun probleme — je genere un format professionnel standard.
          </p>
          <div className="flex items-center gap-3 mt-2.5">
            <input ref={fileInputRef} type="file" accept=".docx,.doc,.pdf" className="hidden" onChange={handleFile} />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: "#7c3aed", color: "#fff" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#6d28d9")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#7c3aed")}
            >
              <Upload className="w-3.5 h-3.5" />
              Charger le modele
            </button>
            <button
              onClick={onDismiss}
              className="text-xs"
              style={{ color: "#a78bfa" }}
            >
              Non, continuer sans
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 2 page ──────────────────────────────────────────────────────────────

export default function Step2Page() {
  const [, setLocation] = useLocation();
  const { report, updateReport } = useReportStore();
  const { user } = useUser();
  const [stepDone, setStepDone] = useState(false);
  const [templateFile, setTemplateFile] = useState<TemplateFile | null>(null);
  const [templateDismissed, setTemplateDismissed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const studentName = capitalizeName(
    user?.fullName || user?.firstName || report.studentName || ""
  );

  const { messages, send, abort, isThinking, isGenerating, toolCalls, thinkingText } = useConversation({
    step: 2,
    autoSend: "Démarre.",
    onSectionGenerated: (section, content) => {
      if (section === "page-de-garde") {
        updateReport({ pageDeGarde: content, studentName: studentName || report.studentName });
      }
    },
    onStepComplete: () => setStepDone(true),
    templateFile: templateFile ?? undefined,
  });

  // Hide the template card once the conversation is underway (more than 1 message)
  const chatUnderway = messages.length > 1;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolCalls, isThinking, isGenerating]);

  return (
    <Layout
      stepName="Page de garde"
      stepNumber={2}
      previewPanel={<PreviewPanel activeSection="page-de-garde" content={report.pageDeGarde} />}
    >
      <div className="flex-1 overflow-y-auto py-4 px-2 md:py-5 md:px-3">

        {/* Proactive template card — shown until chat is underway or dismissed */}
        {!chatUnderway && !stepDone && (
          <TemplateCard
            templateFile={templateFile}
            onFileReady={(f) => { setTemplateFile(f); setTemplateDismissed(true); }}
            onRemove={() => setTemplateFile(null)}
            onDismiss={() => setTemplateDismissed(true)}
            dismissed={templateDismissed}
          />
        )}

        {/* Loaded template indicator — shown while chat is active */}
        {chatUnderway && templateFile && !stepDone && (
          <div
            className="flex items-center gap-2 mx-1 mb-2 px-3 py-1.5 rounded-lg text-xs"
            style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
          >
            <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: "#16a34a" }} />
            <span style={{ color: "#15803d" }}>
              Modele : <strong>{templateFile.name}</strong>
            </span>
            <button onClick={() => setTemplateFile(null)} style={{ color: "#86efac", marginLeft: "auto" }}>
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {messages.map((m) => <ChatMessage key={m.id} role={m.role} content={m.content} />)}
        <AgentSteps toolCalls={toolCalls} thinkingText={thinkingText} isGenerating={isGenerating} />
        {(isThinking || isGenerating) && <ChatMessage role="agent" content="" isTyping />}
        {stepDone && !isThinking && !isGenerating && (
          <StepTransitionCard
            title="Page de garde prete"
            subtitle="On passe aux dedicaces et remerciements."
            onNext={() => { updateReport({ currentStep: 3 }); setLocation("/rapport/step-3"); }}
            nextLabel="Etape 3 : Dedicaces"
          />
        )}
        <div ref={bottomRef} />
      </div>
      <ChatInput
        isGenerating={isThinking || isGenerating}
        onAbort={abort}
        onSend={(text) => send(text)}
        disabled={isThinking || isGenerating}
        placeholder="Reponds naturellement..."
      />
    </Layout>
  );
}
