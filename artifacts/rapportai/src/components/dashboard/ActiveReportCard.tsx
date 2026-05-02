import { motion } from "framer-motion";
import { ChevronRight, Clock, FileText, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

const STEPS = [
  { id: 1, label: "Infos générales", short: "01" },
  { id: 2, label: "Page de garde", short: "02" },
  { id: 3, label: "Dédicaces", short: "03" },
  { id: 4, label: "Remerciements", short: "04" },
  { id: 5, label: "Sommaire", short: "05" },
  { id: 6, label: "Partie I", short: "06" },
  { id: 7, label: "Partie II", short: "07" },
];

interface ActiveReportCardProps {
  title?: string;
  type?: string;
  currentStep?: number;
  completedSteps?: number[];
  updatedAt?: string;
  onContinue?: () => void;
}

export function ActiveReportCard({
  title = "Mon rapport PFE",
  type = "PFE",
  currentStep = 1,
  completedSteps = [],
  updatedAt = "Aujourd'hui",
  onContinue,
}: ActiveReportCardProps) {
  const progress = Math.round((completedSteps.length / STEPS.length) * 100);

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full"
                >
                  {type}
                </span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {updatedAt}
                </span>
              </div>
              <h3
                className="font-semibold text-gray-900 text-base leading-tight"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {title}
              </h3>
            </div>
          </div>
          <Button
            data-testid="button-continue-report"
            onClick={onContinue}
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 text-xs flex-shrink-0"
            style={{ boxShadow: "0 4px 12px rgba(124,58,237,0.25)" }}
          >
            <Play className="w-3 h-3" />
            Continuer
          </Button>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-500">Progression</span>
            <span className="text-xs font-semibold text-purple-600">{progress}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7)" }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* 7-step stepper pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {STEPS.map((step, i) => {
            const isCompleted = completedSteps.includes(step.id);
            const isCurrent = step.id === currentStep;
            const isLocked = step.id > currentStep && !isCompleted;

            return (
              <div key={step.id} className="flex items-center gap-1.5">
                <div
                  title={step.label}
                  className={`relative group flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-default
                    ${isCompleted
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : isCurrent
                      ? "bg-purple-600 text-white border border-purple-600 shadow-sm shadow-purple-200"
                      : "bg-gray-50 text-gray-400 border border-gray-200"
                    }
                  `}
                >
                  {isCompleted && (
                    <svg className="w-3 h-3 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 12 12">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  <span>{step.short}</span>
                  {/* Tooltip */}
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-900 text-white text-xs rounded-lg px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
