import { ExternalLink, BookOpen } from "lucide-react";

interface ScholarChipsProps {
  keywords: string[];
  section: "partie-i" | "partie-ii";
  theme?: string;
  filiere?: string;
  problematique?: string;
}

const FR_STOP = new Set([
  "dans", "quelle", "quel", "quels", "quelles", "mesure", "les", "des", "une",
  "pour", "par", "peut", "elle", "est", "cette", "comment", "pourquoi", "que",
  "qui", "quoi", "son", "ses", "leur", "leurs", "avec", "plus", "être", "afin",
  "entre", "vers", "face", "aux", "sur", "sont", "ont", "cet", "ce", "la", "le",
  "du", "de", "et", "ou", "en", "au", "un",
]);

// Pull the most meaningful terms from the problématique to seed a Scholar search.
function keyTermsFromProblematique(p?: string): string {
  if (!p) return "";
  const words = p
    .toLowerCase()
    .replace(/[?.,;:!«»"'’()]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !FR_STOP.has(w));
  return [...new Set(words)].slice(0, 6).join(" ");
}

function buildQueries(
  keywords: string[],
  section: "partie-i" | "partie-ii",
  theme?: string,
  filiere?: string,
  problematique?: string,
): string[] {
  const queries: string[] = [];
  const kw = keywords.filter(Boolean);

  // Query 0 (highest value): terms straight from the student's problématique
  const probTerms = keyTermsFromProblematique(problematique);
  if (probTerms) queries.push(probTerms);

  // Query 1: first keyword alone
  if (kw[0]) queries.push(kw[0]);

  // Query 2: first 2 keywords + Maroc
  if (kw[0] && kw[1]) queries.push(`${kw[0]} ${kw[1]} Maroc`);
  else if (kw[0] && theme) queries.push(`${kw[0]} ${(theme).slice(0, 25)} Maroc`);

  // Query 3: section-specific angle
  if (section === "partie-i" && filiere) {
    queries.push(`${filiere} revue littérature théorie`);
  } else if (section === "partie-ii" && kw[0]) {
    queries.push(`${kw[0]} résultats empiriques analyse`);
  } else if (theme) {
    queries.push(`${(theme).slice(0, 30)} recherche académique`);
  }

  return [...new Set(queries.filter(Boolean))].slice(0, 4);
}

export function ScholarChips({ keywords, section, theme, filiere, problematique }: ScholarChipsProps) {
  const queries = buildQueries(keywords, section, theme, filiere, problematique);

  return (
    <div className="mt-5 pt-5 border-t border-gray-100">
      <div className="flex items-center gap-2 mb-2.5">
        <BookOpen className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
          Google Scholar
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {queries.map((q) => (
          <a
            key={q}
            href={`https://scholar.google.com/scholar?q=${encodeURIComponent(q)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 hover:border-blue-300 px-3 py-1.5 rounded-full transition-all font-medium group"
          >
            {q.length > 28 ? q.slice(0, 28) + "…" : q}
            <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100" />
          </a>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-2.5 leading-relaxed">
        Pour de meilleurs résultats, importez 2-3 articles PDF dans cette section. Claude les utilisera comme sources directes.
      </p>
    </div>
  );
}
