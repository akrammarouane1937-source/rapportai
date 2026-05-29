import { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { REPORT_STEPS, TOTAL_STEPS } from "@/lib/steps";

interface StepLayoutProps {
  stepId: number;
  children: ReactNode;
  /** If true, children fill the full area below the header (no inner scroll) */
  fullHeight?: boolean;
}

export function StepLayout({ stepId, children, fullHeight }: StepLayoutProps) {
  const step = REPORT_STEPS.find((s) => s.id === stepId);
  const progress = (stepId / TOTAL_STEPS) * 100;

  return (
    <div className={`flex bg-[#f9f8ff] ${fullHeight ? "h-screen overflow-hidden" : "min-h-screen"}`}>
      <Sidebar />
      <div className="flex-shrink-0" style={{ width: 60 }} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex-shrink-0 z-30">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full">
              Étape {stepId} sur {TOTAL_STEPS}
            </span>
            <span className="text-xs text-gray-400">{step?.label}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        {/* Content */}
        <div className={fullHeight ? "flex-1 overflow-hidden" : "flex-1 overflow-y-auto"}>
          {children}
        </div>
      </div>
    </div>
  );
}
