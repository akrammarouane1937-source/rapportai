import { motion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { Type, AlignLeft, Heading, Quote, RotateCcw, Check } from "lucide-react";
import { Sidebar, SidebarSpacer } from "@/components/layout/Sidebar";
import { useUserSettingsStore, type FormattingPrefs } from "@/lib/userSettingsStore";

const FONT_OPTIONS = ["Times New Roman", "Arial", "Calibri", "Garamond", "Georgia"];
const SPACING_OPTIONS = [
  { label: "Simple (1)", value: 1 },
  { label: "1,5", value: 1.5 },
  { label: "Double (2)", value: 2 },
];
const CITATION_OPTIONS = [
  "APA 7th ed.", "IEEE", "Harvard", "MLA 9th ed.", "Chicago 17th ed.", "Vancouver",
];

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <div className="text-sm text-gray-800">{label}</div>
        {hint && <div className="text-xs text-gray-400">{hint}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="shrink-0 w-11 h-6 rounded-full transition-colors relative"
        style={{ background: checked ? "#7c3aed" : "#d1d5db" }}
        aria-pressed={checked}
      >
        <span
          className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform"
          style={{ transform: checked ? "translateX(20px)" : "translateX(0)" }}
        />
      </button>
    </div>
  );
}

function NumberField({ label, suffix, value, step = 1, min, max, onChange }: { label: string; suffix?: string; value: number; step?: number; min?: number; max?: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          max={max}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-300"
        />
        {suffix && <span className="text-xs text-gray-400 shrink-0">{suffix}</span>}
      </div>
    </div>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string | number; options: { label: string; value: string | number }[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm bg-white focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-300"
      >
        {options.map((o) => (
          <option key={String(o.value)} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div className="flex items-center gap-2 mb-5">
        <div className="w-7 h-7 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600">{icon}</div>
        <h2 className="text-sm font-bold text-gray-800" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function MiseEnFormePage() {
  const { formatting, updateFormatting, resetFormatting } = useUserSettingsStore();
  const [savedFlash, setSavedFlash] = useState(false);

  // Auto-persist on every change (Zustand persist) + a tiny "enregistré" flash.
  const set = <K extends keyof FormattingPrefs>(key: K, value: FormattingPrefs[K]) => {
    updateFormatting({ [key]: value } as Partial<FormattingPrefs>);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  };

  return (
    <div className="flex min-h-screen bg-[#f9f8ff]">
      <Sidebar />
      <SidebarSpacer />
      <main className="flex-1 p-8 min-w-0">
        <div className="max-w-2xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Mise en forme
              </h1>
              <button
                onClick={resetFormatting}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-purple-600 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Réinitialiser
              </button>
            </div>
            <p className="text-gray-500 text-sm mb-2">
              Ces réglages s'appliquent à <strong>tous tes rapports</strong> — la rédaction de l'IA et l'export Word/PDF les respectent.
            </p>
            <div className="h-5 mb-4">
              {savedFlash && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="inline-flex items-center gap-1 text-xs text-green-600">
                  <Check className="w-3.5 h-3.5" /> Enregistré
                </motion.span>
              )}
            </div>

            <Card icon={<Type className="w-4 h-4" />} title="Police & texte">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                <SelectField label="Police" value={formatting.fontFamily}
                  options={FONT_OPTIONS.map((f) => ({ label: f, value: f }))}
                  onChange={(v) => set("fontFamily", v)} />
                <NumberField label="Taille" suffix="pt" value={formatting.fontSize} min={8} max={18}
                  onChange={(v) => set("fontSize", v)} />
                <SelectField label="Interligne" value={formatting.lineSpacing}
                  options={SPACING_OPTIONS}
                  onChange={(v) => set("lineSpacing", Number(v))} />
                <NumberField label="Retrait 1ʳᵉ ligne" suffix="cm" value={formatting.firstLineIndentCm} step={0.5} min={0} max={3}
                  onChange={(v) => set("firstLineIndentCm", v)} />
              </div>
              <Toggle label="Texte justifié" checked={formatting.justified} onChange={(v) => set("justified", v)} />
              <Toggle label="Titres en minuscules" hint="Évite les majuscules dans les titres" checked={formatting.lowercaseTitles} onChange={(v) => set("lowercaseTitles", v)} />
              <Toggle label="Mise en valeur sans soulignement" hint="Italique/gras uniquement, jamais souligné" checked={formatting.emphasisNoUnderline} onChange={(v) => set("emphasisNoUnderline", v)} />
            </Card>

            <Card icon={<AlignLeft className="w-4 h-4" />} title="Marges & espacement">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <NumberField label="Marges" suffix="cm" value={formatting.marginCm} step={0.5} min={1} max={5}
                  onChange={(v) => set("marginCm", v)} />
                <NumberField label="En-tête / pied" suffix="cm" value={formatting.headerFooterMarginCm} step={0.5} min={0.5} max={3}
                  onChange={(v) => set("headerFooterMarginCm", v)} />
                <NumberField label="Espacement ¶" suffix="pt" value={formatting.paragraphSpacingPt} min={0} max={24}
                  onChange={(v) => set("paragraphSpacingPt", v)} />
              </div>
            </Card>

            <Card icon={<Heading className="w-4 h-4" />} title="Titres & pagination">
              <div className="grid grid-cols-3 gap-4 mb-3">
                <NumberField label="Titre 1" suffix="pt" value={formatting.headingSize1} min={12} max={24} onChange={(v) => set("headingSize1", v)} />
                <NumberField label="Titre 2" suffix="pt" value={formatting.headingSize2} min={11} max={20} onChange={(v) => set("headingSize2", v)} />
                <NumberField label="Titre 3" suffix="pt" value={formatting.headingSize3} min={10} max={18} onChange={(v) => set("headingSize3", v)} />
              </div>
              <Toggle label="Nouvelle page par partie/chapitre" checked={formatting.newPagePerChapter} onChange={(v) => set("newPagePerChapter", v)} />
              <Toggle label="Pagination romaine (pages préparatoires)" hint="I, II, III… puis 1, 2, 3 dès l'introduction" checked={formatting.romanFrontMatter} onChange={(v) => set("romanFrontMatter", v)} />
            </Card>

            <Card icon={<Quote className="w-4 h-4" />} title="Citations & sources">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                <SelectField label="Style de citation" value={formatting.citationStyle}
                  options={CITATION_OPTIONS.map((c) => ({ label: c, value: c }))}
                  onChange={(v) => set("citationStyle", v)} />
              </div>
              <Toggle label="Numéro de page dans les citations" checked={formatting.citationPageNumbers} onChange={(v) => set("citationPageNumbers", v)} />
              <Toggle label="Considérer les sources externes (web)" checked={formatting.considerExternalSources} onChange={(v) => set("considerExternalSources", v)} />
              <Toggle label="Considérer les sources de la bibliothèque" checked={formatting.considerLibrarySources} onChange={(v) => set("considerLibrarySources", v)} />
            </Card>

            <div className="bg-purple-50 rounded-2xl border border-purple-100 p-5">
              <p className="text-sm text-purple-700 font-medium mb-1">Appliqué automatiquement à chaque rapport</p>
              <p className="text-xs text-purple-500">
                Tes réglages sont sauvegardés sur ton appareil et envoyés à l'IA à chaque génération, puis appliqués à l'export Word et PDF.
              </p>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
