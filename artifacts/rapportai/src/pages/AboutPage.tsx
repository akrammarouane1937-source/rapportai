import { Link } from "wouter";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Users, Target, Zap, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.1 } }),
};

export default function AboutPage() {
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
            <Link href="/ton-moment"><span className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">Ton moment</span></Link>
            <Link href="/about"><span className="text-sm font-semibold text-purple-600 border-b-2 border-purple-600 pb-0.5">À propos</span></Link>
            <Link href="/why"><span className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">Pourquoi RapportAI</span></Link>
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
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-purple-50 rounded-full blur-[80px] opacity-60" />
        </div>
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-purple-50 border border-purple-100 text-purple-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <Heart size={12} /> Construire pour les étudiants marocains
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight leading-tight mb-4">
            Notre mission :<br />
            <span style={{ color: "#7c3aed" }}>libérer</span> ton temps
          </h1>
          <p className="text-lg text-gray-500 leading-relaxed max-w-xl mx-auto">
            RapportAI est né d'un constat simple : écrire un rapport de stage ne devrait pas prendre 3 mois. L'IA peut faire le travail. Toi, tu te concentres sur l'essentiel.
          </p>
        </motion.div>
      </section>

      {/* MISSION BLOCKS */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: <Target className="w-6 h-6 text-purple-600" />,
              title: "Notre mission",
              body: "Rendre la rédaction académique accessible à chaque étudiant marocain, quelle que soit son école ou sa filière. Un rapport de qualité professionnelle, en 30 minutes.",
            },
            {
              icon: <Users className="w-6 h-6 text-purple-600" />,
              title: "Pour qui ?",
              body: "Étudiants en BTS, licence, master ou grande école au Maroc. Que tu sois à l'ENCG, l'ENSA, l'EMSI, l'ISGA ou ailleurs, RapportAI s'adapte à ton école et ton jury.",
            },
            {
              icon: <Zap className="w-6 h-6 text-purple-600" />,
              title: "Comment ?",
              body: "Un agent IA spécialisé dans le format académique marocain génère chaque section de ton rapport : introduction, parties théorique & empirique, conclusion, bibliographie.",
            },
          ].map((item, i) => (
            <motion.div
              key={i}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
            >
              <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center mb-4">
                {item.icon}
              </div>
              <h3 className="font-bold text-gray-900 text-lg mb-2">{item.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{item.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* STATS */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.h2
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="text-3xl font-black text-gray-900 mb-12"
          >
            RapportAI en chiffres
          </motion.h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: "500+", label: "étudiants" },
              { value: "80+", label: "écoles couvertes" },
              { value: "30 min", label: "temps de génération" },
              { value: "100%", label: "original & personnalisé" },
            ].map((s, i) => (
              <motion.div
                key={i}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="text-3xl font-black text-purple-600 mb-1">{s.value}</div>
                <div className="text-sm text-gray-500">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <motion.h2
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="text-3xl font-black text-gray-900 text-center mb-12"
          >
            Ce qu'on croit vraiment
          </motion.h2>
          <div className="space-y-4">
            {[
              { title: "Le temps de l'étudiant a de la valeur.", body: "Passer 3 mois sur un rapport au lieu d'apprendre, de créer ou de travailler, c'est un gaspillage. L'IA peut libérer ce temps." },
              { title: "La qualité ne devrait pas dépendre du budget.", body: "Un étudiant sans coach ni famille en entreprise mérite le même rapport qu'un étudiant bien entouré. RapportAI égalise les chances." },
              { title: "L'IA est un outil, pas un raccourci.", body: "RapportAI ne génère pas du texte générique. Il produit un rapport structuré, ancré dans ton projet réel, personnalisé pour ton école et ton jury." },
            ].map((v, i) => (
              <motion.div
                key={i}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="bg-white rounded-xl p-6 border border-gray-100 flex gap-4"
              >
                <div className="w-1.5 rounded-full bg-purple-500 flex-shrink-0 self-stretch" />
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">{v.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{v.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 text-center">
        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} className="max-w-xl mx-auto">
          <h2 className="text-3xl font-black text-gray-900 mb-4">Prêt à écrire ton rapport ?</h2>
          <p className="text-gray-500 mb-8">Rejoins 500+ étudiants qui ont déjà gagné des semaines de travail.</p>
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
