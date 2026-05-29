import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ChatMessage, StepTransitionCard, AgentSteps } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { ChatInput } from "@/components/chat-input";
import { useReportStore } from "@/lib/store";
import { useConversation } from "@/hooks/use-conversation";
import { useOptionalUser as useUser } from "@/lib/useOptionalClerk";
import { useFileStore } from "@/lib/fileStore";
import { Paperclip, X, FileText } from "lucide-react";

function capitalizeName(name: string): string {
  return name
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function TemplateUpload() {
  const { files, addFiles, clearAll } = useFileStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateFile = files.find((f) => f.name.startsWith("canevas-"));

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Remove any previous template first
    clearAll();
    // Prefix with "canevas-" so the API marks it as a school template
    const renamed = new File([file], `canevas-${file.name}`, { type: file.type });
    addFiles([renamed]);
    e.target.value = "";
  };

  const handleRemove = () => {
    clearAll();
  };

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 border-t border-border"
      style={{ background: templateFile ? "#f0fdf4" : "transparent" }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.doc,.pdf"
        className="hidden"
        onChange={handleFile}
      />

      {templateFile ? (
        <>
          <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: "#16a34a" }} />
          <span className="text-xs flex-1 truncate" style={{ color: "#15803d" }}>
            Modèle chargé : {templateFile.name.replace(/^canevas-/, "")}
          </span>
          <button
            onClick={handleRemove}
            className="shrink-0"
            style={{ color: "#9ca3af" }}
            title="Retirer le modèle"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </>
      ) : (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 text-xs"
          style={{ color: "#7c3aed" }}
          title="Joindre le modèle Word de votre école (optionnel)"
        >
          <Paperclip className="w-3.5 h-3.5" />
          Joindre le modèle de votre école (optionnel)
        </button>
      )}
    </div>
  );
}

export default function Step2Page() {
  const [, setLocation] = useLocation();
  const { report, updateReport } = useReportStore();
  const { user } = useUser();
  const [stepDone, setStepDone] = useState(false);
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
  });

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
        {messages.map((m) => <ChatMessage key={m.id} role={m.role} content={m.content} />)}
        <AgentSteps toolCalls={toolCalls} thinkingText={thinkingText} isGenerating={isGenerating} />
        {(isThinking || isGenerating) && <ChatMessage role="agent" content="" isTyping />}
        {stepDone && !isThinking && !isGenerating && (
          <StepTransitionCard
            title="Page de garde prête"
            subtitle="On passe aux dédicaces et remerciements."
            onNext={() => { updateReport({ currentStep: 3 }); setLocation("/rapport/step-3"); }}
            nextLabel="Étape 3 : Dédicaces"
          />
        )}
        <div ref={bottomRef} />
      </div>
      <div className="shrink-0">
        <TemplateUpload />
        <div className="border-t border-border">
          <ChatInput
            isGenerating={isThinking || isGenerating}
            onAbort={abort}
            onSend={(text) => send(text)}
            disabled={isThinking || isGenerating}
            placeholder="Réponds naturellement..."
          />
        </div>
      </div>
    </Layout>
  );
}
