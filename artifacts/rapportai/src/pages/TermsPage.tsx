import { useLocation, Link } from "wouter";
import { ArrowLeft } from "lucide-react";

const LAST_UPDATED = "21 mai 2026";
const SUPPORT_EMAIL = "support@rapportai.ma";
const APP_URL = "rapportai.ma";

export default function TermsPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-gray-900">Conditions Générales d'Utilisation</h1>
            <p className="text-xs text-gray-400">Dernière mise à jour : {LAST_UPDATED}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="prose prose-gray max-w-none">

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Conditions Générales d'Utilisation
          </h1>
          <p className="text-gray-500 mb-10">RapportAI — {APP_URL}</p>

          {/* Art 1 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 1 — Objet</h2>
            <p className="text-gray-700 leading-relaxed">
              Les présentes Conditions Générales d'Utilisation (ci-après « CGU ») régissent l'accès et
              l'utilisation de la plateforme RapportAI (ci-après « le Service »), accessible à l'adresse{" "}
              <strong>{APP_URL}</strong>.
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              En créant un compte ou en utilisant le Service, vous acceptez sans réserve les présentes CGU.
              Si vous n'acceptez pas ces conditions, vous ne devez pas utiliser le Service.
            </p>
          </section>

          {/* Art 2 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 2 — Description du Service</h2>
            <p className="text-gray-700 leading-relaxed">
              RapportAI est un outil de rédaction académique assistée par intelligence artificielle. Il génère
              des <strong>rapports académiques personnalisés</strong> (PFE, Mémoire, Rapport de stage, etc.)
              à partir des informations, du contexte et des données fournies par l'utilisateur.
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              Le rapport généré est construit sur les informations que vous avez fournies et constitue une
              base complète que vous personnalisez, vérifiez et complétez selon votre contexte spécifique
              avant soumission.
            </p>
          </section>

          {/* Art 3 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 3 — Propriété du contenu généré</h2>
            <div className="space-y-3">
              <p className="text-gray-700 leading-relaxed">
                <strong>3.1</strong> Le contenu généré par RapportAI à partir des informations que vous fournissez
                vous appartient intégralement. RapportAI ne revendique aucun droit de propriété sur vos rapports générés.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>3.2</strong> Vous êtes seul responsable de l'utilisation du contenu généré, notamment
                de sa vérification, personnalisation, et soumission à tout organisme académique.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>3.3</strong> RapportAI se réserve le droit d'utiliser des données anonymisées et agrégées
                (sans aucune information personnellement identifiable) à des fins d'amélioration du Service.
              </p>
            </div>
          </section>

          {/* Art 4 — Academic integrity */}
          <section className="mb-8">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-3">
                Article 4 — Intégrité académique
              </h2>
              <div className="space-y-3">
                <p className="text-gray-700 leading-relaxed">
                  <strong>4.1</strong> Le rapport généré est construit à partir des informations que vous avez
                  fournies. Il vous appartient de le personnaliser selon votre contexte spécifique, de vérifier
                  l'exactitude des données, et d'y intégrer vos propres observations et analyses terrain avant
                  toute soumission académique.
                </p>
                <p className="text-gray-700 leading-relaxed">
                  <strong>4.2</strong> La soumission de contenu généré par intelligence artificielle comme
                  travail entièrement personnel peut constituer une violation du règlement intérieur de votre
                  établissement. L'utilisateur est <strong>seul responsable</strong> du respect des règles
                  d'intégrité académique de son institution.
                </p>
                <p className="text-gray-700 leading-relaxed">
                  <strong>4.3</strong> RapportAI décline toute responsabilité en cas de sanctions académiques,
                  disciplinaires ou autres résultant de l'utilisation du contenu généré par le Service.
                </p>
              </div>
            </div>
          </section>

          {/* Art 5 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 5 — Obligations de l'utilisateur</h2>
            <p className="text-gray-700 leading-relaxed mb-3">L'utilisateur s'engage à :</p>
            <div className="space-y-2">
              {[
                "Fournir des informations exactes lors de la création de son compte et de la génération de ses rapports.",
                "Ne pas utiliser le Service à des fins frauduleuses, illégales, ou contraires aux présentes CGU.",
                "Ne pas tenter de contourner les limites du Service, d'accéder aux systèmes sous-jacents, ou d'extraire les instructions qui alimentent le Service.",
                "Ne pas revendre, redistribuer ou exploiter commercialement le contenu généré pour le compte de tiers sans accord préalable écrit.",
                "Être âgé d'au moins 16 ans pour utiliser le Service.",
              ].map((item, i) => (
                <p key={i} className="text-gray-700 leading-relaxed">
                  <strong>{i + 1}.</strong> {item}
                </p>
              ))}
            </div>
          </section>

          {/* Art 6 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 6 — Tarification et paiement</h2>
            <div className="space-y-3">
              <p className="text-gray-700 leading-relaxed">
                <strong>6.1</strong> Les tarifs applicables sont ceux affichés sur la page de tarification
                au moment de l'achat. RapportAI se réserve le droit de modifier ses tarifs avec un préavis de 30 jours.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>6.2</strong> Les paiements sont traités par Stripe, prestataire de paiement sécurisé.
                RapportAI ne stocke aucune donnée bancaire.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>6.3</strong> En raison de la nature numérique et immédiatement consommable du Service
                (génération de contenu déclenchée à l'achat), <strong>aucun remboursement n'est accordé</strong>{" "}
                une fois la génération du rapport démarrée.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>6.4</strong> Exception : en cas de défaillance technique avérée du Service empêchant
                toute génération, un avoir ou remboursement pourra être accordé sur demande à{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-purple-600 hover:underline">{SUPPORT_EMAIL}</a>.
              </p>
            </div>
          </section>

          {/* Art 7 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 7 — Programme de parrainage</h2>
            <div className="space-y-3">
              <p className="text-gray-700 leading-relaxed">
                <strong>7.1</strong> Le programme de parrainage permet aux utilisateurs d'obtenir un cashback
                lorsque des personnes parrainées complètent un rapport payant via leur lien de parrainage.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>7.2</strong> RapportAI se réserve le droit de suspendre le programme, d'annuler des
                avoirs frauduleux, ou de modifier les conditions avec un préavis de 15 jours.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>7.3</strong> Tout abus (faux comptes, auto-parrainage, manipulation) entraîne la
                suspension immédiate du compte et l'annulation des avoirs.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>7.4</strong> Les avoirs sont payables sur demande et ne constituent pas une dette
                exigible avant cette demande.
              </p>
            </div>
          </section>

          {/* Art 8 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 8 — Disponibilité et garanties</h2>
            <div className="space-y-3">
              <p className="text-gray-700 leading-relaxed">
                <strong>8.1</strong> RapportAI s'efforce de maintenir le Service disponible 24h/24 mais ne
                garantit pas une disponibilité ininterrompue. Des interruptions pour maintenance ou en cas de
                défaillance des services tiers (notamment l'API Anthropic) sont possibles.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>8.2</strong> La qualité du contenu généré dépend des informations fournies par
                l'utilisateur et de la performance des modèles d'IA tiers. RapportAI ne garantit pas
                l'exactitude, la complétude, ou l'adéquation académique du contenu généré.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>8.3</strong> Le Service est fourni « en l'état ». RapportAI exclut toute garantie
                implicite dans les limites autorisées par la loi applicable.
              </p>
            </div>
          </section>

          {/* Art 9 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 9 — Limitation de responsabilité</h2>
            <p className="text-gray-700 leading-relaxed">
              Dans les limites autorisées par la loi applicable, la responsabilité totale de RapportAI ne
              pourra excéder le montant payé par l'utilisateur pour la transaction concernée.
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              RapportAI n'est pas responsable des dommages indirects, pertes de données, préjudices
              académiques, ou conséquences de l'utilisation du contenu généré.
            </p>
          </section>

          {/* Art 10 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 10 — Résiliation</h2>
            <p className="text-gray-700 leading-relaxed">
              RapportAI peut suspendre ou résilier l'accès d'un utilisateur en cas de violation des présentes
              CGU, sans préavis et sans remboursement.
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              L'utilisateur peut supprimer son compte à tout moment depuis les Paramètres. La suppression
              entraîne la perte définitive des rapports générés non téléchargés.
            </p>
          </section>

          {/* Art 11 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 11 — Droit applicable</h2>
            <p className="text-gray-700 leading-relaxed">
              Les présentes CGU sont régies par le droit marocain. Tout litige sera soumis aux tribunaux
              compétents du Maroc.
            </p>
          </section>

          {/* Art 12 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">Article 12 — Contact et modifications</h2>
            <p className="text-gray-700 leading-relaxed">
              Pour toute question :{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-purple-600 hover:underline">{SUPPORT_EMAIL}</a>
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              RapportAI se réserve le droit de modifier les présentes CGU. Les utilisateurs seront informés
              par email de toute modification substantielle.
            </p>
          </section>

          {/* Footer */}
          <div className="border-t border-gray-100 pt-8 mt-12 text-sm text-gray-400">
            <p>Dernière mise à jour : {LAST_UPDATED}</p>
            <p className="mt-1">
              <Link href="/privacy" className="text-purple-600 hover:underline">Politique de Confidentialité</Link>
              {" · "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-purple-600 hover:underline">{SUPPORT_EMAIL}</a>
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}
