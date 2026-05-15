import { ReactNode } from "react";
import { Link } from "wouter";
import { BookOpen } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
  previewPanel?: ReactNode;
  stepName?: string;
  stepNumber?: number;
}

export function Layout({ children, previewPanel, stepName, stepNumber }: LayoutProps) {
  return (
    <div className="h-screen overflow-hidden flex flex-col bg-background">
      <header className="shrink-0 flex items-center justify-between h-14 px-4 border-b bg-background shadow-sm z-10">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-primary">
          <BookOpen className="w-5 h-5" />
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>RapportAI</span>
        </Link>

        {stepName && (
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden sm:inline text-muted-foreground">Étape {stepNumber}/9</span>
            <span className="hidden sm:inline text-border">·</span>
            <span className="font-semibold text-foreground">{stepName}</span>
          </div>
        )}
      </header>

      <main className="flex-1 flex overflow-hidden min-h-0">
        {/* Left — Chat */}
        <div className={`flex flex-col ${previewPanel ? "w-full md:w-[38%] border-r border-border" : "w-full max-w-3xl mx-auto"} min-h-0 bg-background`}>
          {children}
        </div>

        {/* Right — Word Preview */}
        {previewPanel && (
          <div className="hidden md:flex flex-col flex-1 min-h-0 bg-[#f3f4f6]">
            {previewPanel}
          </div>
        )}
      </main>
    </div>
  );
}
