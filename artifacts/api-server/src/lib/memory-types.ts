// student_memory.json — full TypeScript schema
// Written once at session start, updated by every agent

export interface Supervisor {
  name: string;
  title?: string;
  department?: string;
}

export interface Company {
  name: string;
  sector?: string;
  city?: string;
  supervisor_name?: string;
  internship_duration?: string;
}

export interface TheoreticalFramework {
  model?: string;
  key_authors?: string[];
  methodology?: "quantitative" | "qualitative" | "mixte";
  data_collection?: string;
  sample?: string;
  analysis_tool?: string;
}

export interface ReportConfig {
  title?: string;
  type: "PFE" | "PFA" | "Mémoire" | "Thèse" | "Rapport de stage";
  structure: "deux-parties" | "trois-parties";
  language: string;
  company?: Company;
  canevas_uploaded: boolean;
  canevas_filename?: string;
  problematique?: string;
  hypotheses?: {
    H1?: string;
    H2?: string;
    H3?: string;
  };
  objectifs?: string[];
  mots_cles?: string[];
  theoretical_framework?: TheoreticalFramework;
}

export interface GenerationProgress {
  sections_completed: string[];
  sections_in_progress: string[];
  sections_pending: string[];
  total_pages_generated: number;
  last_section_generated?: string;
  last_activity: string;
  session_count: number;
}

export interface WritingProfile {
  assessed: boolean;
  french_level?: string;
  academic_register?: "weak" | "intermediate" | "strong";
  recurring_errors: string[];
  strengths: string[];
  preferred_style?: "formel-académique" | "semi-formel" | "technique";
  citation_style: string;
  avg_sentence_length?: number;
  ai_detection_risk?: "low" | "medium" | "high";
  plagiat_similarity_score?: number;
  plagiat_target: number;
}

export interface SectionSummary {
  word_count: number;
  key_points: string;
  chapters?: string[];
  key_arguments?: string;
  plan_announced?: string;
  completed_at: string;
}

export interface BibCitation {
  ref: string;       // short form: "Markowitz (1952)"
  full: string;      // full APA/ISO reference
  section: string;   // which section it came from
}

export interface Bibliography {
  citations_found: BibCitation[];
  citation_count: number;
  sources_by_section: Record<string, number>;
}

export interface RevisionRequest {
  section: string;
  request: string;
  timestamp: string;
  resolved: boolean;
}

export interface JurySimulation {
  timestamp: string;
  sections_covered: string[];
  weak_points_identified: string[];
  score?: number;
}

export interface HumanizeRecord {
  section: string;
  timestamp: string;
  ai_score_before?: number;
  ai_score_after?: number;
}

export interface PlagiatRecord {
  section: string;
  timestamp: string;
  similarity_before?: number;
  similarity_after?: number;
}

export interface InteractionHistory {
  revision_requests: RevisionRequest[];
  chat_history_summary?: string;
  jury_simulations: JurySimulation[];
  humanize_requests: HumanizeRecord[];
  plagiat_checks: PlagiatRecord[];
}

export interface AgentPreferences {
  generation: {
    verbosity: "concis" | "standard" | "détaillé";
    include_transitions: boolean;
    include_part_intros: boolean;
    include_part_conclusions: boolean;
    enforce_canevas: boolean;
  };
  revision: {
    tone: "strict" | "bienveillant" | "neutre";
    show_diff: boolean;
    explain_changes: boolean;
  };
  chat: {
    tutor_mode: boolean;
    language_mix: "fr" | "ar" | "fr-ar";
  };
  jury: {
    difficulty: "easy" | "medium" | "hard";
    jury_profiles: string[];
    focus_sections: string[];
  };
}

export interface Subscription {
  plan: "free" | "starter" | "pro" | "institution";
  generations_used: number;
  generations_limit: number;
  humanize_uses: number;
  plagiat_checks: number;
}

export interface StudentMemory {
  schema_version: string;
  last_updated: string;

  identity: {
    student_id: string;
    full_name: string;
    email?: string;
    preferred_language: "fr" | "ar" | "fr-ar";
    academic_level?: string;
    school: string;
    filiere: string;
    academic_year?: string;
    supervisor?: Supervisor;
  };

  report: ReportConfig;
  progress: GenerationProgress;
  writing_profile: WritingProfile;
  section_summaries: Record<string, SectionSummary>;
  bibliography: Bibliography;
  interaction_history: InteractionHistory;
  agent_preferences: AgentPreferences;
  subscription: Subscription;
}
