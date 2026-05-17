import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Sparkles, ArrowRight, Clock, Brain, FileText, AlertCircle,
  CheckCircle2, XCircle, TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.1 } }),
};

export default function WhyRapportAIPage() {
  return (
    <div className="min-h-screen bg-white font-sans">
      {/* NAVBAR */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur-sm shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 rounded flex items-center justify-center text-white" style={{ background: "#7c3aed" }}>
                <Sparkles size={18} />
              </div>
              <span className="font-bold text-xl tracking-tight text-gray-900">RapportAI</span>
            </div>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/about"><span className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">À propos</span></Link>
            <Link href="/why"><span className="text-sm font-semibold text-purple-600 border-b-2 border-purple-600 pb-0.5">Pourquoi RapportAI</span></Link>
            <Link href="/story"><span className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">Notre histoire</span></Link>
            <Link href="/sign-in">
              <Button variant="ghost" size="sm" className="text-gray-700 hover:text-purple-600">Se connecter</Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white rounded-full px-5">
                Commencer <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="pt-20 pb-16 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-red-50 rounded-full blur-[80px] opacity-50" />
        </div>
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <AlertCircle size={12} /> Le vrai problème des rapports académiques
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight leading-tight mb-4">
            Pourquoi le rapport de stage<br />
            <span className="text-red-500">brise</span> autant d'étudiants ?
          </h1>
          <p className="text-lg text-gray-500 leading-relaxed max-w-xl mx-auto">
            3 mois. Des dizaines de pages. Un format que personne ne t'a vraiment appris. Et un jury qui juge en 5 minutes. Voici pourquoi — et comment RapportAI change ça.
          </p>
        </motion.div>
      </section>

      {/* THE PROBLEM */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <motion.h2 variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
            className="text-3xl font-black text-gray-900 text-center mb-12">
            Ce que vivent vraiment les étudiants
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                icon: <Clock className="w-5 h-5 text-red-500" />,
                title: "Des mois perdus sur la forme",
                body: "La mise en page, la numérotation, les marges, la table des matières — ça prend des jours. Pour un contenu que le jury lit en quelques minutes.",
              },
              {
                icon: <Brain className="w-5 h-5 text-red-500" />,
                title: "La page blanche paralysante",
                body: "Par où commencer ? Comment formuler une problématique ? Quelle structure pour la Partie I ? Le blocage dure des semaines.",
              },
              {
                icon: <FileText className="w-5 h-5 text-red-500" />,
                title: "Les normes qu'on ne t'a pas données",
                body: "Chaque école a ses propres attentes. Certains encadrants veulent des sous-parties précises, d'autres non. Personne ne te donne le mode d'emploi complet.",
              },
              {
                icon: <AlertCircle className="w-5 h-5 text-red-500" />,
                title: "Le stress de la validation",
                body: "Soumettre une ébauche à ton encadrant, attendre des semaines, recevoir des corrections vagues, recommencer. Le cycle épuise.",
              },
            ].map((item, i) => (
              <motion.div key={i} custom={i} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
                className="bg-white rounded-2xl p-6 border border-red-100 flex gap-4">
                <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  {item.icon}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{item.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARISON TABLE */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <motion.h2 variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
            className="text-3xl font-black text-gray-900 text-center mb-12">
            Avec vs. sans RapportAI
          </motion.h2>
          <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
            <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-100 text-sm font-semibold text-gray-500">
              <div className="col-span-1 p-4"></div>
              <div className="p-4 text-center text-red-500">Sans RapportAI</div>
              <div className="p-4 text-center text-purple-600">Avec RapportAI</div>
            </div>
            {[
              ["Temps de rédaction", "2–3 mois", "30 minutes"],
              ["Mise en page", "Manuelle, longue", "Automatique, .docx"],
              ["Structure", "Incertaine", "Adaptée à ton école"],
              ["Bibliographie", "Cherchée à la main", "Générée automatiquement"],
              ["Niveau de stress", "Élevé", "Faible"],
              ["Résultat", "Variable", "Professionnel & cohérent"],
            ].map(([label, before, after], i) => (
              <div key={i} className={`grid grid-cols-3 border-b border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                <div className="p-4 text-sm font-medium text-gray-700">{label}</div>
                <div className="p-4 text-center text-sm text-gray-500 flex items-center justify-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" /> {before}
                </div>
                <div className="p-4 text-center text-sm text-purple-700 font-semibold flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" /> {after}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY AI WORKS */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <motion.h2 variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
            className="text-3xl font-black text-gray-900 text-center mb-4">
            Pourquoi l'IA fonctionne pour ça
          </motion.h2>
          <motion.p variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
            className="text-gray-500 text-center mb-12 max-w-xl mx-auto">
            Le rapport académique est un problème de structure, pas de talent. Et la structure, c'est exactement ce que l'IA fait le mieux.
          </motion.p>
          <div className="space-y-4">
            {[
              {
                icon: <TrendingUp className="w-5 h-5 text-purple-600" />,
                title: "Un format connu, appris sur des milliers de rapports",
                body: "RapportAI a analysé les normes académiques marocaines, les structures d'ENCG, ENSA, EMSI et bien d'autres. Il connaît le format mieux qu'un tuteur moyen.",
              },
              {
                icon: <Brain className="w-5 h-5 text-purple-600" />,
                title: "Il part de TES informations, pas de modèles génériques",
                body: "Tu décris ton entreprise, ton thème, ta problématique. L'IA génère un rapport personnalisé — pas un copier-coller d'un template vide.",
              },
              {
                icon: <FileText className="w-5 h-5 text-purple-600" />,
                title: "Chaque section est cohérente avec les autres",
                body: "L'introduction prépare les parties, les parties alimentent la conclusion. RapportAI lit ce qu'il a déjà écrit avant de continuer — comme un vrai auteur.",
              },
            ].map((item, i) => (
              <motion.div key={i} custom={i} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
                className="bg-white rounded-xl p-5 border border-gray-100 flex gap-4">
                <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  {item.icon}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm mb-1">{item.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{item.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 text-center">
        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} className="max-w-xl mx-auto">
          <h2 className="text-3xl font-black text-gray-900 mb-4">Tu as le projet. On a la méthode.</h2>
          <p className="text-gray-500 mb-8">Décris ton stage en 5 minutes, RapportAI s'occupe du reste.</p>
          <Link href="/sign-up">
            <Button className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-8 h-12 rounded-full text-base shadow-lg shadow-purple-200">
              Générer mon rapport <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="border-t py-8 px-4 text-center text-xs text-gray-400">
        © 2025 RapportAI · <Link href="/about"><span className="hover:text-gray-600 cursor-pointer">À propos</span></Link> · <Link href="/why"><span className="hover:text-gray-600 cursor-pointer">Pourquoi RapportAI</span></Link> · <Link href="/story"><span className="hover:text-gray-600 cursor-pointer">Notre histoire</span></Link>
      </footer>
    </div>
  );
}
