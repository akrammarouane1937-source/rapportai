import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Abreviation {
  abbr: string;
  sig: string;
}

export interface UploadedFile {
  name: string;
  sectionId: string;
}

export interface Report {
  // Step 1
  theme: string;
  school: string;
  filiere: string;
  reportType: "PFE" | "stage" | "memoire";
  academicYear: string;

  // Step 2
  studentName: string;
  encadrantPeda: string;
  encadrantPro: string;
  entreprise: string;
  ville: string;
  dateDebutStage: string;
  dateFinStage: string;
  juryMember1: string;
  juryMember2: string;
  juryMember3: string;

  // Generated sections
  pageDeGarde: string;
  dedicaces: string;
  remerciements: string;
  resumeFr: string;
  abstractEn: string;
  abreviations: Abreviation[];
  motsCles: string[];
  sommaire: string;
  introduction: string;
  partieI: string;
  partieITitle: string;
  partieIChapters: number;
  partieII: string;
  partieIITitle: string;
  partieIIChapters: number;
  conclusion: string;
  bibliographie: string;
  annexes: string;

  // Report intelligence
  problematique: string;
  sectionSummaries: Record<string, string>;

  // Meta
  currentStep: number;
  checkpoints: Record<string, string>;
  uploadedFiles: UploadedFile[];
  abbreviationsGenerated: boolean;
  pendingContextInjection: string;
}

export const initialReportState: Report = {
  theme: "",
  school: "",
  filiere: "",
  reportType: "PFE",
  academicYear: "",

  studentName: "",
  encadrantPeda: "",
  encadrantPro: "",
  entreprise: "",
  ville: "",
  dateDebutStage: "",
  dateFinStage: "",
  juryMember1: "",
  juryMember2: "",
  juryMember3: "",

  pageDeGarde: "",
  dedicaces: "",
  remerciements: "",
  resumeFr: "",
  abstractEn: "",
  abreviations: [],
  motsCles: [],
  sommaire: "",
  introduction: "",
  partieI: "",
  partieITitle: "",
  partieIChapters: 2,
  partieII: "",
  partieIITitle: "",
  partieIIChapters: 2,
  conclusion: "",
  bibliographie: "",
  annexes: "",

  problematique: "",
  sectionSummaries: {},

  currentStep: 1,
  checkpoints: {},
  uploadedFiles: [],
  abbreviationsGenerated: false,
  pendingContextInjection: "",
};

interface ReportStore {
  report: Report;
  updateReport: (data: Partial<Report>) => void;
  saveCheckpoint: (section: string, content: string) => void;
  restoreCheckpoint: (section: string) => string | null;
  resetReport: () => void;
}

export const useReportStore = create<ReportStore>()(
  persist(
    (set, get) => ({
      report: initialReportState,
      updateReport: (data) =>
        set((state) => ({ report: { ...state.report, ...data } })),
      saveCheckpoint: (section, content) =>
        set((state) => ({
          report: {
            ...state.report,
            checkpoints: { ...state.report.checkpoints, [section]: content },
          },
        })),
      restoreCheckpoint: (section) => {
        const { report } = get();
        return report.checkpoints[section] || null;
      },
      resetReport: () => set({ report: initialReportState }),
    }),
    {
      name: "rapportai_report",
    }
  )
);
