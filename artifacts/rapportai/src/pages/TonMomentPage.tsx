import { Link } from "wouter";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.12 } }),
};

// Image slot — shows a soft gradient until the Freepik image is dropped into
// /public/marketing/<file>. If the file is missing, the <img> hides itself and
// the gradient remains, so the page never looks broken.
function Visual({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl ${className}`}
      style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="w-full h-full object-cover"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
    </div>
  );
}

export default function TonMomentPage() {
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
            <Link href="/ton-moment"><span className="text-sm font-semibold text-purple-600 border-b-2 border-purple-600 pb-0.5">Ton moment</span></Link>
            <Link href="/about"><span className="hidden sm:inline text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">À propos</span></Link>
            <Link href="/why"><span className="hidden sm:inline text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">Pourquoi RapportAI</span></Link>
            <Link href="/sign-up">
              <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white rounded-full px-5">
                Commencer <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* HERO — the dream */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[450px] bg-purple-50 rounded-full blur-[90px] opacity-70" />
        </div>
        <div className="max-w-6xl mx-auto px-4 pt-16 pb-12 grid md:grid-cols-2 gap-10 items-center">
          <motion.div variants={fadeUp} initial="hidden" animate="show">
            <div className="inline-flex items-center gap-2 bg-purple-50 border border-purple-100 text-purple-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              <Heart size={12} /> Ce jour-là arrive plus vite que tu crois
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight leading-tight mb-5">
              Imagine le jour où tu jettes<br />
              ta toge <span style={{ color: "#7c3aed" }}>en l'air.</span>
            </h1>
            <p className="text-lg text-gray-500 leading-relaxed mb-8">
              Après des années de travail, de nuits blanches, de larmes et de rêves… te voilà.
              Diplôme en main, ta famille qui pleure de fierté. Ce moment t'attend.
            </p>
            <Link href="/sign-up">
              <Button className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-8 h-12 rounded-full text-base shadow-lg shadow-purple-200">
                Rapproche-toi de ce moment <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </motion.div>
          <motion.div variants={fadeUp} initial="hidden" animate="show" custom={1}>
            <Visual src="/marketing/ton-moment-hero.jpg" alt="Diplômés qui jettent leurs toques en l'air" className="aspect-[4/3] shadow-2xl" />
          </motion.div>
        </div>
      </section>

      {/* THE JOURNEY — the struggle (mirror) */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 items-center">
          <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} className="order-2 md:order-1">
            <Visual src="/marketing/ton-moment-struggle.jpg" alt="Étudiant qui travaille tard le soir" className="aspect-[4/3] shadow-xl" />
          </motion.div>
          <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} custom={1} className="order-1 md:order-2">
            <h2 className="text-3xl font-black text-gray-900 mb-4 leading-snug">
              Le chemin a été long.
            </h2>
            <p className="text-gray-500 text-lg leading-relaxed">
              Les révisions à 2h du matin. Le stress des examens. Les doutes.
              Tu as tout donné pour arriver jusqu'ici. Il ne reste qu'une dernière marche —
              et elle ne devrait pas t'épuiser plus que tout le reste.
            </p>
          </motion.div>
        </div>
      </section>

      {/* THE PEOPLE — emotional climax (the speech) */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
            <Visual src="/marketing/ton-moment-amis.jpg" alt="Diplômées qui s'enlacent, amies devenues une famille" className="aspect-[3/4] max-w-sm mx-auto shadow-2xl mb-10" />
          </motion.div>
          <motion.blockquote
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            custom={1}
            className="space-y-5 text-xl md:text-2xl font-medium text-gray-800 leading-relaxed"
          >
            <p>« Aujourd'hui n'est pas une fin. C'est le début d'une nouvelle aventure. »</p>
            <p className="text-gray-500 text-lg">
              À tes amis devenus une famille — merci pour les souvenirs.
              À tes parents, ceux qui ont sacrifié en silence et applaudi le plus fort —
              cette réussite leur appartient aussi.
            </p>
            <p className="font-black" style={{ color: "#7c3aed" }}>« On l'a fait. »</p>
          </motion.blockquote>
        </div>
      </section>

      {/* THE BRIDGE — connect dream → product */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto text-center">
          <motion.h2
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-black text-gray-900 mb-5 leading-snug"
          >
            Entre toi et ce moment,<br />il reste <span style={{ color: "#7c3aed" }}>une seule chose</span> : ton rapport.
          </motion.h2>
          <motion.p
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            custom={1}
            className="text-gray-500 text-lg leading-relaxed mb-8"
          >
            Ne laisse pas une page blanche te séparer de ta soutenance.
            RapportAI rédige ton rapport — au format de ton école, avec de vraies sources —
            pendant que toi, tu te prépares au plus beau jour.
          </motion.p>
          <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} custom={2}>
            <Link href="/sign-up">
              <Button className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-8 h-12 rounded-full text-base shadow-lg shadow-purple-200">
                Commence ton rapport maintenant <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <p className="text-xs text-gray-400 mt-3">Gratuit pour commencer · au format de ton école</p>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t py-8 px-4 text-center text-xs text-gray-400">
        © 2025 RapportAI · <Link href="/ton-moment"><span className="hover:text-gray-600 cursor-pointer">Ton moment</span></Link> · <Link href="/about"><span className="hover:text-gray-600 cursor-pointer">À propos</span></Link> · <Link href="/why"><span className="hover:text-gray-600 cursor-pointer">Pourquoi RapportAI</span></Link> · <Link href="/story"><span className="hover:text-gray-600 cursor-pointer">Notre histoire</span></Link>
      </footer>
    </div>
  );
}
