import { motion } from "framer-motion";
import { BookOpen, User, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ChatMessage({
  role,
  content,
  isTyping = false,
}: {
  role: "agent" | "user";
  content: React.ReactNode;
  isTyping?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 mb-6 ${role === "user" ? "flex-row-reverse" : ""}`}
    >
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          role === "agent" ? "bg-primary text-white" : "bg-muted text-muted-foreground"
        }`}
      >
        {role === "agent" ? <BookOpen className="w-4 h-4" /> : <User className="w-4 h-4" />}
      </div>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          role === "agent"
            ? "bg-card text-card-foreground shadow-sm border border-border/50"
            : "bg-primary text-white"
        }`}
      >
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {content}
          {isTyping && (
            <span className="inline-block w-1.5 h-4 ml-1 bg-current animate-pulse align-middle" />
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Tool label mapping
const TOOL_LABELS: Record<string, string> = {
  Read: "📖 Lecture du rapport",
  WebSearch: "🔍 Recherche académique",
  Write: "✍️ Rédaction en cours",
  Glob: "📂 Analyse des fichiers",
};

export function ToolCallCard({ name, status }: { name: string; status: "running" | "done" }) {
  // name may already be a label (with emoji) from the hook, or a raw tool name
  const label = TOOL_LABELS[name] || name;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="ml-11 mb-4 flex items-center gap-3 p-3 rounded-lg bg-card border border-border/50 shadow-sm"
    >
      {status === "running" ? (
        <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0" />
      ) : (
        <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
      )}
      <span className="text-sm font-medium text-card-foreground">{label}</span>
    </motion.div>
  );
}

export function StepTransitionCard({
  title,
  subtitle,
  onNext,
  nextLabel = "Continuer",
}: {
  title: string;
  subtitle?: string;
  onNext: () => void;
  nextLabel?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="ml-11 mb-6 p-4 rounded-xl bg-background border border-primary/20 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="font-semibold text-foreground">{title}</h4>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <Button onClick={onNext} size="sm" className="shrink-0 gap-2">
          {nextLabel}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}
