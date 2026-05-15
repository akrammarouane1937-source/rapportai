import { ReactNode } from "react";
import { Link } from "wouter";
import { BookOpen } from "lucide-react";
import { useReportStore } from "@/lib/store";

interface LayoutProps {
  children: ReactNode;
  previewPanel?: ReactNode;
  stepName?: string;
  stepNumber?: number;
}

export function Layout({ children, previewPanel, stepName, stepNumber }: LayoutProps) {
  const { report } = useReportStore();

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50">
      <header className="sticky top-0 z-10 flex items-center justify-between h-14 px-4 border-b bg-background shadow-sm">
        <Link href="/" className="flex items-center gap-2 font-serif font-bold text-lg text-primary">
          <BookOpen className="w-5 h-5" />
          <span>RapportAI</span>
        </Link>

        {stepName && (
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <span className="hidden sm:inline">Étape {stepNumber}/9</span>
            <span className="hidden sm:inline text-border">•</span>
            <span className="text-foreground">{stepName}</span>
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden h-[calc(100vh-3.5rem)]">
        {/* Left Panel - Chat */}
        <div className={`w-full ${previewPanel ? "md:w-[38%] border-r border-border" : "max-w-3xl mx-auto"} flex flex-col h-full bg-background relative`}>
          {children}
        </div>

        {/* Right Panel - Preview */}
        {previewPanel && (
          <div className="hidden md:flex flex-col w-[62%] h-full bg-[#f8f9fa] overflow-hidden">
            {previewPanel}
          </div>
        )}
      </main>
    </div>
  );
}
