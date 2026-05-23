import { Link } from "wouter";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.1 } }),
};

const chapters = [
  {
    label: "Le déclic",
    title: "Un dimanche soir, à J-7 de la soutenance.",
    body: `C'est là que tout a commencé. Un étudiant, assis devant un document Word vide, son stage terminé depuis 3 semaines, et son rapport, le "vrai rapport", pas encore commencé.

Il avait appris. Il avait bossé. Il avait des choses à dire. Mais la page blanche, la structure à deviner, la bibliographie à trouver... paralysait tout.

Il a fini par rendre quelque chose. Mais ce n'était pas à la hauteur de ce qu'il savait vraiment faire.`,
  },
  {
    label: "Le constat",
    title: "Ce n'est pas un problème de compétence. C'est un problème de méthode.",
    body: `Après avoir parlé à des dizaines d'étudiants marocains (ENCG, ENSA, EMSI, ISGA, IAV), le même schéma revenait.

Des étudiants brillants. Des stages solides. Mais des rapports qui ne rendaient pas justice à leur travail.

Personne ne leur avait vraiment appris à écrire un rapport académique marocain. Les modèles en ligne étaient génériques. Les encadrants, débordés. Et le temps, compté.`,
  },
  {
    label: "L'idée",
    title: "Et si l'IA pouvait résoudre exactement ça ?",
    body: `L'IA générative a fait des progrès énormes en rédaction académique. Mais les outils existants (ChatGPT, Jenni.ai) ne connaissent pas les normes marocaines. Ils produisent du texte générique, pas un rapport structuré pour ton jury.

L'idée de RapportAI est née ici : un agent IA qui connaît le format, qui lit ton canevas d'école, qui adapte chaque section à ta problématique, et qui écrit comme un auteur cohérent, pas comme un générateur de paragraphes.`,
  },
  {
    label: "Aujourd'hui",
    title: "500+ étudiants ont déjà généré leur rapport.",
    body: `RapportAI est utilisé dans plus de 80 écoles au Maroc. Des étudiants en BTS, en licence, en master. Des thèmes de finance, de logistique, de marketing, d'informatique.

Chaque rapport est personnalisé. Chaque section est cohérente. Et chaque étudiant a récupéré des semaines, parfois des mois, de sa vie.

Ce n'est pas une promesse. Ce sont des résultats vécus.`,
  },
];

const testimonials = [
  {
    quote: "J'ai rendu mon rapport en 2 jours. Mon encadrant a dit que c'était le meilleur qu'il avait lu cette année.",
    name: "Yassine M.",
    school: "ENCG Settat, Finance",
  },
  {
    quote: "J'avais peur que ça soit du copier-coller. Mais c'était vraiment mon projet, ma problématique, mon entreprise. Juste mis en forme parfaitement.",
    name: "Meryem B.",
    school: "EMSI Casablanca, Marketing",
  },
  {
    quote: "3 semaines de blocage, résolues en une soirée. Je n'aurais pas cru c'est possible.",
    name: "Amine K.",
    school: "ENSA Agadir, Génie Informatique",
  },
];

export default function StoryPage() {
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
            <Link href="/why"><span className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">Pourquoi RapportAI</span></Link>
            <Link href="/story"><span className="text-sm font-semibold text-purple-600 border-b-2 border-purple-600 pb-0.5">Notre histoire</span></Link>
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
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-purple-50 rounded-full blur-[80px] opacity-50" />
        </div>
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-purple-50 border border-purple-100 text-purple-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <Quote size={12} /> Notre histoire
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight leading-tight mb-4">
            Comment RapportAI est né<br />
            <span style={{ color: "#7c3aed" }}>d'une frustration réelle</span>
          </h1>
          <p className="text-lg text-gray-500 leading-relaxed max-w-xl mx-auto">
            Ce n'est pas une startup créée dans un garage à San Francisco. C'est un outil né au Maroc, pour les étudiants marocains, d'une douleur qu'on a vécue soi-même.
          </p>
        </motion.div>
      </section>

      {/* CHAPTERS */}
      <section className="py-16 px-4">
        <div className="max-w-2xl mx-auto space-y-20">
          {chapters.map((chapter, i) => (
            <motion.div
              key={i}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              className="relative"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-black">
                  {i + 1}
                </div>
                <span className="text-xs font-bold text-purple-500 uppercase tracking-widest">{chapter.label}</span>
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-4 leading-snug">{chapter.title}</h2>
              <div className="space-y-3">
                {chapter.body.split("\n\n").map((para, j) => (
                  <p key={j} className="text-gray-500 leading-relaxed">{para}</p>
                ))}
              </div>
              {i < chapters.length - 1 && (
                <div className="mt-16 border-b border-dashed border-gray-200" />
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <motion.h2
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="text-3xl font-black text-gray-900 text-center mb-12"
          >
            Ce qu'ils en disent
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={i}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
              >
                <Quote className="w-5 h-5 text-purple-300 mb-3" />
                <p className="text-gray-700 text-sm leading-relaxed mb-4 italic">"{t.quote}"</p>
                <div>
                  <div className="font-bold text-gray-900 text-sm">{t.name}</div>
                  <div className="text-gray-400 text-xs">{t.school}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CLOSING NOTE */}
      <section className="py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
            className="p-8 rounded-2xl border border-purple-100 bg-purple-50">
            <p className="text-gray-700 leading-relaxed text-lg font-medium italic">
              "On a construit RapportAI pour l'étudiant qu'on était, celui qui méritait mieux que d'être jugé sur sa mise en page plutôt que sur son travail réel."
            </p>
            <div className="mt-4 text-sm text-purple-600 font-semibold">L'équipe RapportAI</div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 text-center">
        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} className="max-w-xl mx-auto">
          <h2 className="text-3xl font-black text-gray-900 mb-4">C'est ton tour maintenant.</h2>
          <p className="text-gray-500 mb-8">Rejoins les 500+ étudiants qui ont transformé leur rapport en quelques minutes.</p>
          <Link href="/sign-up">
            <Button className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-8 h-12 rounded-full text-base shadow-lg shadow-purple-200">
              Commencer gratuitement <ArrowRight className="w-4 h-4 ml-2" />
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
