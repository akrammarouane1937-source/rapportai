import { useEffect, useState, useRef } from "react";
import { Link } from "wouter";
import { motion, useInView } from "framer-motion";
import { 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  FileText, 
  Upload, 
  MessageSquare,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col font-sans bg-background selection:bg-primary/20">
      {/* 1. NAVBAR */}
      <header 
        className={`sticky top-0 z-50 w-full transition-all duration-200 border-b ${
          isScrolled ? "bg-white/95 backdrop-blur-sm shadow-sm border-border" : "bg-white border-transparent"
        }`}
      >
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded flex items-center justify-center text-white" style={{ background: "#7c3aed" }}>
              <Sparkles size={18} />
            </div>
            <span className="font-bold font-heading text-xl tracking-tight text-foreground">
              RapportAI
            </span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/about">
              <span className="hidden md:inline text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors cursor-pointer">À propos</span>
            </Link>
            <Link href="/why">
              <span className="hidden md:inline text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors cursor-pointer">Pourquoi RapportAI</span>
            </Link>
            <Link href="/story">
              <span className="hidden md:inline text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors cursor-pointer">Notre histoire</span>
            </Link>
            <Link href="/sign-in">
              <Button variant="ghost" className="hidden sm:inline-flex text-foreground hover:text-primary hover:bg-primary-light/50">
                Se connecter
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button className="bg-primary text-white hover:bg-primary-dark shadow-[0_4px_24px_rgba(124,58,237,0.12)] rounded-full px-6">
                Commencer gratuitement <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* 2. HERO */}
        <section className="relative pt-24 pb-20 lg:pt-32 lg:pb-28 overflow-hidden">
          <div className="absolute inset-0 -z-10 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[100px] opacity-70"></div>
          </div>
          
          <div className="container mx-auto px-4 text-center max-w-4xl relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 bg-purple-50 border border-purple-100 text-purple-700 text-sm font-semibold px-4 py-2 rounded-full mb-8"
            >
              <span>🎓</span> Utilisé par <span className="font-black">500+</span> étudiants au Maroc
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-5xl md:text-6xl lg:text-7xl font-extrabold font-heading text-foreground tracking-tight leading-[1.1] mb-6"
            >
              Le premier outil IA pour les rapports académiques marocains
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-xl md:text-2xl text-secondary-foreground font-medium mb-10 max-w-2xl mx-auto"
            >
              3 mois de rédaction. 30 minutes avec RapportAI.
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link href="/sign-up">
                <Button size="lg" className="w-full sm:w-auto text-lg h-14 px-8 rounded-full bg-primary hover:bg-primary-dark shadow-[0_4px_24px_rgba(124,58,237,0.25)] text-white">
                  Générer mon rapport <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="/demo">
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg h-14 px-8 rounded-full border-border hover:bg-muted text-foreground">
                  Voir la démo
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        {/* 3. PRODUCT DEMO ANIMATION */}
        <section className="py-12 bg-transparent relative z-20 -mt-10">
          <div className="container mx-auto px-4">
            <DemoAnimation />
          </div>
        </section>

        {/* 4. SCROLLING BAR */}
        <section className="py-12 bg-white border-y border-border overflow-hidden">
          <div className="container mx-auto mb-6">
            <p className="text-center text-sm font-semibold text-muted-foreground tracking-widest uppercase">
              Compatible avec les canevas de +
            </p>
          </div>
          
          <div className="relative flex flex-col gap-4">
            <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none"></div>
            <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none"></div>
            
            <div className="flex overflow-hidden whitespace-nowrap">
              <div className="animate-marquee-left flex gap-8 items-center text-lg font-heading font-bold text-muted-foreground/40">
                {Array(4).fill("EMSI · ENCG · ENSA · ENSIAS · UIR · UM5 · ISCAE · HEM · FST · FSJES · ENCGT · UCA · UIZ · USMBA · INSEA · EHTP · EMI · IIHEM · ").map((text, i) => (
                  <span key={i}>{text}</span>
                ))}
              </div>
            </div>
            
            <div className="flex overflow-hidden whitespace-nowrap">
              <div className="animate-marquee-right flex gap-8 items-center text-lg font-medium text-primary/60">
                {Array(4).fill("PFE ✓ · Rapport de Stage ✓ · Mémoire ✓ · Rapport d'Alternance ✓ · Thèse ✓ · Mémoire de Master ✓ · Rapport de Projet ✓ · ").map((text, i) => (
                  <span key={i}>{text}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 5. COMMENT ÇA MARCHE */}
        <section className="py-24 bg-background">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold font-heading text-foreground">Comment ça marche</h2>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 relative max-w-5xl mx-auto">
              <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-[2px] border-t-2 border-dashed border-primary/20 z-0"></div>
              
              {[
                { num: "01", title: "DÉCRIS TON PROJET", text: "Ton thème, ton école, ta filière. 2 minutes." },
                { num: "02", title: "L'IA GÉNÈRE TON RAPPORT", text: "Chaque section rédigée pour toi. En 30 minutes." },
                { num: "03", title: "TÉLÉCHARGE ET SOUMETS", text: "Ton .docx prêt à imprimer. Ton encadrant verra la différence." }
              ].map((step, i) => (
                <div key={i} className="relative z-10 flex flex-col items-center text-center">
                  <div className="w-24 h-24 rounded-full bg-white border border-border shadow-sm flex items-center justify-center mb-6 text-3xl font-black text-primary font-heading">
                    {step.num}
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3">{step.title}</h3>
                  <p className="text-secondary-foreground leading-relaxed">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. CORE FEATURES */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4 max-w-6xl space-y-32">
            <FeatureRow 
              tag="RAPPORT COMPLET"
              title="Ton PFE entier rédigé. Pas juste des phrases."
              para1="Entre ton thème, ta filière et ton école. RapportAI génère chaque section — introduction, cadre théorique, méthodologie, résultats."
              para2="Pas une aide à la rédaction. Le rapport complet."
              demo={<Feature1Demo />}
              isReversed={false}
            />

            <FeatureRow 
              tag="ANTI-DÉTECTION"
              title="0% détection de plagiat. Garanti."
              para1="Chaque rapport est généré uniquement pour toi, à partir de tes données. Aucun contenu partagé entre étudiants."
              para2="Turnitin, iThenticate — aucun outil ne peut détecter ce qui n'existe que pour toi."
              demo={<Feature2Demo />}
              isReversed={true}
            />

            <FeatureRow 
              tag="ÉCRIT DEPUIS TES DONNÉES"
              title="L'IA écrit depuis tes données, pas depuis Google."
              para1="Importe tes fichiers Excel ou CSV. RapportAI génère ton analyse à partir de tes vrais résultats — pas des généralités du web."
              para2="Tes données. Ta méthodologie. Tes conclusions."
              demo={<Feature3Demo />}
              isReversed={false}
            />

            <FeatureRow 
              tag="JURIAI"
              title="Entraîne-toi avec un jury IA avant le grand jour."
              para1="Ton jury va te poser des questions difficiles. JuryAI lit ton rapport et simule exactement ce moment."
              para2="Réponds. Reçois un feedback. Arrive préparé."
              demo={<Feature4Demo />}
              isReversed={true}
            />
          </div>
        </section>

        {/* 7. COMPARISON TABLE */}
        <section className="py-24 bg-background border-t border-border">
          <div className="container mx-auto px-4 max-w-5xl">
            <h2 className="text-3xl md:text-4xl font-bold font-heading text-center mb-16 text-foreground">RapportAI vs les autres options</h2>
            
            <div className="grid md:grid-cols-3 gap-0 border border-border rounded-2xl overflow-hidden shadow-sm bg-white">
              <div className="bg-primary/5 p-8 border-b md:border-b-0 md:border-r border-border relative">
                <div className="absolute top-0 left-0 right-0 h-1 bg-primary"></div>
                <h3 className="text-2xl font-bold font-heading text-primary mb-6 flex items-center gap-2">
                  RapportAI <CheckCircle2 className="text-primary w-6 h-6" />
                </h3>
                <ul className="space-y-4">
                  {[
                    "Rapport complet prêt à soumettre en 30 minutes",
                    "Compatible avec le canevas de ton école",
                    "0% détection de plagiat, garanti",
                    "Écrit depuis tes données, pas depuis le web",
                    "Export .docx formaté automatiquement",
                    "Prépare ta soutenance avec JuryAI"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-foreground font-medium">
                      <CheckCircle2 className="w-5 h-5 text-[#10b981] shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-8 border-b md:border-b-0 md:border-r border-border">
                <h3 className="text-2xl font-bold font-heading text-muted-foreground mb-6 flex items-center gap-2">
                  Rédiger manuellement <XCircle className="w-6 h-6" />
                </h3>
                <ul className="space-y-4 text-secondary-foreground">
                  {[
                    "3 mois de rédaction, souvent la dernière semaine",
                    "Formatage manuel selon le canevas",
                    "Contenu original mais long et épuisant",
                    "Mise en page Word à faire soi-même",
                    "Révisions avec l'encadrant sans préparation"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-[#ef4444]/70 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-8">
                <h3 className="text-2xl font-bold font-heading text-muted-foreground mb-6 flex items-center gap-2">
                  ChatGPT <XCircle className="w-6 h-6" />
                </h3>
                <ul className="space-y-4 text-secondary-foreground">
                  {[
                    "Génère du texte général, pas un rapport complet",
                    "Ne connaît pas le canevas de ton école",
                    "Détectable par Turnitin",
                    "Écrit depuis ses données, pas les tiennes",
                    "Pas d'export .docx formaté",
                    "Pas de préparation soutenance"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-[#ef4444]/70 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 8. JURIAI SPOTLIGHT */}
        <section className="py-24 bg-[#2e1065] text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary rounded-full blur-[120px] opacity-40 translate-x-1/3 -translate-y-1/4 pointer-events-none"></div>
          
          <div className="container mx-auto px-4 max-w-4xl text-center relative z-10">
            <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white text-sm font-semibold tracking-wide mb-8 backdrop-blur-sm">
              <Sparkles className="w-4 h-4 mr-2 text-primary-light" /> JURIAI
            </div>
            
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold font-heading mb-8 leading-tight">
              Tu connais ton rapport.<br />Mais sauras-tu répondre au jury ?
            </h2>
            
            <p className="text-xl text-white/80 mb-6 max-w-2xl mx-auto">
              Le jour de ta soutenance, ton encadrant ne sera pas là pour t'aider. Le jury va creuser. Contredire. Tester.
            </p>
            <p className="text-lg text-white/70 mb-10 max-w-2xl mx-auto">
              JuryAI lit ton rapport et simule exactement ce moment — les vraies questions, le vrai stress. Arrive le jour J en sachant exactement quoi dire.
            </p>
            
            <Link href="/sign-up">
              <Button size="lg" variant="outline" className="bg-transparent border-white/30 text-white hover:bg-white hover:text-[#2e1065] text-lg h-14 px-8 rounded-full">
                Essayer JuryAI <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </section>

        {/* 9. FAQ */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="text-3xl md:text-4xl font-bold font-heading text-center mb-12 text-foreground">Questions fréquentes</h2>
            
            <Accordion type="single" collapsible className="w-full">
              {[
                {
                  q: "Est-ce que Turnitin peut détecter du plagiat dans mon rapport ?",
                  a: "Non. Chaque rapport est généré uniquement pour toi, à partir de tes données. Aucun contenu n'est partagé entre étudiants. Turnitin, iThenticate, PlagScan — aucun outil ne détectera quoi que ce soit. C'est comme si tu l'avais écrit toi-même."
                },
                {
                  q: "Puis-je modifier le rapport après génération ?",
                  a: "Oui. Chaque section est entièrement modifiable après génération. Tu peux réécrire, reformuler, ou demander à l'IA de réviser un paragraphe spécifique autant de fois que tu veux."
                },
                {
                  q: "Que se passe-t-il si je ne suis pas satisfait ?",
                  a: "On rembourse sans question dans les 48h suivant ton paiement. Envoie-nous un message sur WhatsApp et c'est réglé."
                },
                {
                  q: "Puis-je importer mes propres fichiers Excel ou PDF ?",
                  a: "Oui. Dans l'étape Partie II tu peux importer tes fichiers de données — Excel, CSV, PDF. L'IA analyse tes résultats et rédige ton analyse empirique à partir de tes vraies données, pas des généralités."
                }
              ].map((faq, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="border-border">
                  <AccordionTrigger className="text-left text-lg font-medium text-foreground py-6 hover:no-underline hover:text-primary transition-colors">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-secondary-foreground text-base leading-relaxed pb-6">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* 10. BOTTOM CTA */}
        <section className="py-24 bg-gradient-to-b from-white to-primary/5 border-t border-border">
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <h2 className="text-4xl md:text-5xl font-bold font-heading text-foreground mb-6">
              Commence ton rapport. Aujourd'hui.
            </h2>
            <p className="text-xl text-secondary-foreground mb-10">
              Génère ton PFE avec RapportAI et ne reviens plus jamais en arrière.
            </p>
            
            <div className="flex flex-col items-center">
              <Link href="/sign-up">
                <Button size="lg" className="w-full sm:w-auto text-lg h-14 px-10 rounded-full bg-primary text-white hover:bg-primary-dark shadow-[0_4px_24px_rgba(124,58,237,0.25)] mb-4">
                  Commencer gratuitement <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <p className="text-sm text-muted-foreground font-medium">
                Sans carte bancaire · Sans engagement · Commencer maintenant
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-16 pt-12 border-t border-border/50">
              <div>
                <div className="text-3xl font-bold font-heading text-foreground mb-1">30 min</div>
                <div className="text-sm text-secondary-foreground">Temps moyen de génération</div>
              </div>
              <div>
                <div className="text-3xl font-bold font-heading text-foreground mb-1">80+</div>
                <div className="text-sm text-secondary-foreground">Écoles et canevas supportés</div>
              </div>
              <div>
                <div className="text-3xl font-bold font-heading text-foreground mb-1">100%</div>
                <div className="text-sm text-secondary-foreground">Contenu original garanti</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-border py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-primary rounded flex items-center justify-center text-white">
                  <Sparkles size={14} />
                </div>
                <span className="font-bold font-heading text-lg text-foreground">RapportAI</span>
              </div>
              <p className="text-secondary-foreground text-sm">Le rapport académique en 30 minutes</p>
            </div>
            
            <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm font-medium text-secondary-foreground">
              <a href="#" className="hover:text-primary transition-colors">Fonctionnalités</a>
              <a href="#" className="hover:text-primary transition-colors">Blog</a>
              <a href="#" className="hover:text-primary transition-colors">Contact</a>
            </div>
            
            <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">CGU</a>
              <a href="#" className="hover:text-foreground transition-colors">Politique de confidentialité</a>
              <a href="#" className="hover:text-foreground transition-colors">Remboursement</a>
            </div>
          </div>
          
          <div className="text-center text-sm text-muted-foreground pt-8 border-t border-border">
            © 2026 RapportAI · Fait au Maroc 🇲🇦
          </div>
        </div>
      </footer>
    </div>
  );
}

// -----------------------------
// Helper Components & Demos
// -----------------------------

function FeatureRow({ tag, title, para1, para2, demo, isReversed }: any) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <div ref={ref} className={`flex flex-col md:flex-row gap-12 lg:gap-20 items-center ${isReversed ? 'md:flex-row-reverse' : ''}`}>
      <motion.div 
        className="flex-1 space-y-6"
        initial={{ opacity: 0, x: isReversed ? 40 : -40 }}
        animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: isReversed ? 40 : -40 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold tracking-wider">
          {tag}
        </div>
        <h3 className="text-3xl md:text-4xl font-bold font-heading text-foreground leading-tight">{title}</h3>
        <div className="space-y-4 text-lg text-secondary-foreground">
          <p>{para1}</p>
          <p>{para2}</p>
        </div>
      </motion.div>
      
      <motion.div 
        className="flex-1 w-full"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
      >
        <div className="bg-muted/30 rounded-2xl p-6 md:p-8 border border-border shadow-sm">
          {demo}
        </div>
      </motion.div>
    </div>
  );
}

function DemoAnimation() {
  const [step, setStep] = useState(0);
  const [typedText, setTypedText] = useState("");
  
  const targetText = "Optimisation de portefeuille — EMSI Finance";

  useEffect(() => {
    let timer: any;
    
    const runLoop = () => {
      setStep(0);
      setTypedText("");
      
      let currentText = "";
      let charIndex = 0;
      const typeInterval = setInterval(() => {
        if (charIndex < targetText.length) {
          currentText += targetText[charIndex];
          setTypedText(currentText);
          charIndex++;
        } else {
          clearInterval(typeInterval);
        }
      }, 1500 / targetText.length);

      setTimeout(() => setStep(2), 1500);
      setTimeout(() => setStep(3), 2500);
      setTimeout(() => setStep(4), 3000);
      setTimeout(() => setStep(5), 3500);
      setTimeout(() => setStep(6), 5500);
    };

    runLoop();
    timer = setInterval(runLoop, 7500);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-xl border border-border shadow-[0_8px_30px_rgb(0,0,0,0.08)] overflow-hidden">
      <div className="bg-muted/50 border-b border-border h-12 flex items-center px-4 gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#ef4444]"></div>
          <div className="w-3 h-3 rounded-full bg-[#f59e0b]"></div>
          <div className="w-3 h-3 rounded-full bg-[#10b981]"></div>
        </div>
        <div className="mx-auto bg-white border border-border rounded-md text-xs text-muted-foreground px-24 py-1.5 flex items-center gap-2">
          <Sparkles className="w-3 h-3" /> rapportai.ma/app
        </div>
      </div>
      
      <div className="p-8 md:p-12 min-h-[400px] flex flex-col justify-center relative bg-background/50">
        <div className="max-w-2xl mx-auto w-full space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-foreground">Sujet du mémoire</label>
            <div className={`w-full h-12 bg-white border rounded-lg px-4 flex items-center text-foreground transition-all duration-300 ${step >= 4 ? 'opacity-50' : 'border-border shadow-sm'}`}>
              {typedText}
              {step < 2 && <span className="inline-block w-0.5 h-5 bg-primary ml-1 animate-pulse"></span>}
            </div>
          </div>

          <div className="min-h-[40px] flex flex-wrap gap-2">
            {["Markowitz", "Sharpe", "MASI", "Frontière efficiente"].map((kw, i) => (
              <motion.div
                key={kw}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={step >= 2 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
                transition={{ delay: i * 0.1, duration: 0.2 }}
                className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-semibold border border-primary/20"
              >
                {kw}
              </motion.div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4">
            <motion.div
              animate={step === 3 ? { scale: 0.95, opacity: 0.8 } : step >= 4 ? { opacity: 0 } : { scale: 1, opacity: 1 }}
              className="w-full"
            >
              <Button className="w-full bg-primary hover:bg-primary-dark text-white shadow-md">
                <Sparkles className="w-4 h-4 mr-2" /> Générer la Partie I
              </Button>
            </motion.div>

            {step >= 4 && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/95 z-10 backdrop-blur-[2px]">
                {step === 4 ? (
                  <div className="flex flex-col items-center text-primary">
                    <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
                    <p className="font-medium animate-pulse">Analyse du sujet...</p>
                  </div>
                ) : (
                  <div className="w-full max-w-2xl bg-white border border-border shadow-lg rounded-lg p-8 transform transition-all relative">
                    <div className="flex items-center gap-2 mb-6 border-b pb-4">
                      <FileText className="w-5 h-5 text-primary" />
                      <h3 className="font-bold text-lg text-foreground">Partie I : Introduction et Cadre Théorique</h3>
                    </div>
                    <div className="text-secondary-foreground text-sm leading-loose word-stream">
                      <span>La </span><span>théorie </span><span>moderne </span><span>du </span><span>portefeuille, </span>
                      <span>développée </span><span>par </span><span>Harry </span><span>Markowitz </span><span>en </span><span>1952, </span>
                      <span>constitue </span><span>le </span><span>fondement </span><span>de </span><span>l'optimisation </span><span>des </span><span>investissements. </span>
                      <span>Cette </span><span>approche </span><span>quantitative </span><span>permet </span><span>d'identifier </span><span>les </span>
                      <span>allocations </span><span>optimales </span><span>minimisant </span><span>le </span><span>risque </span><span>pour </span>
                      <span>un </span><span>niveau </span><span>de </span><span>rendement </span><span>donné </span><span>sur </span><span>le </span><span>marché </span><span>marocain...</span>
                    </div>
                    
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={step >= 6 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                      className="absolute -right-4 -bottom-4 bg-[#10b981] text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-sm flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3" /> 1 247 mots
                    </motion.div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature1Demo() {
  const [activeIdx, setActiveIdx] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIdx(prev => (prev < 3 ? prev + 1 : 0));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const sections = ["Introduction", "Cadre Théorique", "Méthodologie", "Résultats"];

  return (
    <div className="bg-white rounded-lg border border-border p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6 border-b pb-4">
        <FileText className="w-5 h-5 text-muted-foreground" />
        <div className="h-4 w-32 bg-muted rounded"></div>
      </div>
      <div className="space-y-6">
        {sections.map((sec, i) => (
          <div key={sec} className="relative">
            <div className="flex justify-between items-center mb-2">
              <span className={`text-sm font-bold ${i <= activeIdx ? 'text-foreground' : 'text-muted-foreground'}`}>{sec}</span>
              {i < activeIdx && <CheckCircle2 className="w-4 h-4 text-[#10b981]" />}
              {i === activeIdx && <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>}
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-primary"
                initial={{ width: "0%" }}
                animate={{ width: i < activeIdx ? "100%" : i === activeIdx ? "60%" : "0%" }}
                transition={{ duration: i === activeIdx ? 1.5 : 0.3 }}
              />
            </div>
            {i <= activeIdx && (
              <div className="mt-3 space-y-2">
                <div className="h-2 w-full bg-muted/50 rounded"></div>
                <div className="h-2 w-5/6 bg-muted/50 rounded"></div>
                {i < activeIdx && <div className="h-2 w-4/6 bg-muted/50 rounded"></div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Feature2Demo() {
  return (
    <div className="flex gap-4">
      <div className="flex-1 bg-white border border-border rounded-lg p-4 shadow-sm relative">
        <div className="absolute -top-3 -right-3 bg-[#10b981] text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> 0% Plagiat
        </div>
        <div className="w-6 h-6 rounded bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold mb-3">S1</div>
        <div className="h-3 w-3/4 bg-foreground/10 rounded mb-4"></div>
        <div className="space-y-2 opacity-70">
          <div className="h-1.5 w-full bg-muted rounded"></div>
          <div className="h-1.5 w-full bg-muted rounded"></div>
          <div className="h-1.5 w-5/6 bg-muted rounded"></div>
          <div className="h-1.5 w-full bg-muted rounded"></div>
          <div className="h-1.5 w-4/6 bg-muted rounded"></div>
        </div>
      </div>
      
      <div className="flex-1 bg-white border border-border rounded-lg p-4 shadow-sm relative mt-6">
        <div className="absolute -top-3 -right-3 bg-[#10b981] text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> 0% Plagiat
        </div>
        <div className="w-6 h-6 rounded bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold mb-3">S2</div>
        <div className="h-3 w-2/3 bg-foreground/10 rounded mb-4"></div>
        <div className="space-y-2 opacity-70">
          <div className="h-1.5 w-5/6 bg-muted rounded"></div>
          <div className="h-1.5 w-full bg-muted rounded"></div>
          <div className="h-1.5 w-full bg-muted rounded"></div>
          <div className="h-1.5 w-4/6 bg-muted rounded"></div>
          <div className="h-1.5 w-full bg-muted rounded"></div>
        </div>
      </div>
    </div>
  );
}

function Feature3Demo() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase(p => (p + 1) % 3);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative h-64 bg-white border border-border rounded-lg overflow-hidden flex items-center justify-center p-6">
      <motion.div 
        className="absolute flex flex-col items-center"
        animate={{ opacity: phase === 0 ? 1 : 0, scale: phase === 0 ? 1 : 0.8 }}
      >
        <div className="w-16 h-16 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center mb-4 border border-green-200">
          <Upload className="w-8 h-8" />
        </div>
        <div className="font-bold text-sm text-foreground">donnees_enquete.csv</div>
      </motion.div>

      <motion.div 
        className="absolute w-full px-8"
        animate={{ opacity: phase === 1 ? 1 : 0 }}
      >
        <div className="space-y-2">
          {[1,2,3,4].map((i) => (
            <div key={i} className="flex gap-2">
              <div className="h-3 w-1/4 bg-green-100 rounded"></div>
              <div className="h-3 w-1/4 bg-green-100 rounded"></div>
              <div className="h-3 w-1/2 bg-green-100 rounded"></div>
            </div>
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-white animate-pulse"></div>
      </motion.div>

      <motion.div 
        className="absolute w-full px-8"
        animate={{ opacity: phase === 2 ? 1 : 0, y: phase === 2 ? 0 : 20 }}
      >
        <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-primary">Analyse empirique générée</span>
          </div>
          <p className="text-xs leading-relaxed text-foreground">
            L'analyse des 450 réponses au questionnaire révèle que <strong>78% des PME sondées</strong> considèrent le financement bancaire comme l'obstacle majeur à leur digitalisation, avec une corrélation forte (r=0.82) avec leur taille.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function Feature4Demo() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep(s => (s + 1) % 4);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-background rounded-lg border border-border overflow-hidden flex flex-col h-72">
      <div className="bg-white border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">JuryAI</div>
            <div className="text-[10px] text-muted-foreground">Simulation de soutenance</div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 p-4 space-y-4 overflow-hidden relative">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex gap-3"
        >
          <div className="w-6 h-6 rounded-full bg-primary/20 shrink-0"></div>
          <div className="bg-white border border-border p-3 rounded-2xl rounded-tl-sm text-xs shadow-sm text-foreground">
            Pourquoi avez-vous choisi le modèle de Markowitz au lieu du CAPM ?
          </div>
        </motion.div>

        {step >= 1 && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex gap-3 flex-row-reverse"
          >
            <div className="w-6 h-6 rounded-full bg-muted shrink-0"></div>
            <div className="bg-primary text-white p-3 rounded-2xl rounded-tr-sm text-xs shadow-sm">
              Parce qu'il permet de minimiser le risque global du portefeuille via la diversification.
            </div>
          </motion.div>
        )}

        {step >= 2 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-4 left-4 right-4 bg-white p-3 rounded-xl border border-border shadow-md"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-foreground">Feedback du Jury</span>
              <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">16/20</span>
            </div>
            <p className="text-[11px] text-secondary-foreground">
              Bonne réponse, mais vous auriez dû mentionner que le marché marocain (MASI) manque parfois de liquidité pour appliquer le CAPM purement.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
