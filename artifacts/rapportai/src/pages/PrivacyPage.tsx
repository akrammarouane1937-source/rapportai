import { useLocation, Link } from "wouter";
import { ArrowLeft } from "lucide-react";

const LAST_UPDATED = "21 mai 2026";
const SUPPORT_EMAIL = "support@rapportai.io";

export default function PrivacyPage() {
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
            <h1 className="text-sm font-bold text-gray-900">Politique de Confidentialité</h1>
            <p className="text-xs text-gray-400">Dernière mise à jour : {LAST_UPDATED}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="prose prose-gray max-w-none">

          <h1 className="text-3xl font-bold text-gray-900 mb-2">Politique de Confidentialité</h1>
          <p className="text-gray-500 mb-10">RapportAI — rapportai.io</p>

          {/* Section 1 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. Responsable du traitement</h2>
            <p className="text-gray-700 leading-relaxed">
              RapportAI, accessible à l'adresse rapportai.io.<br />
              Contact :{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-purple-600 hover:underline">{SUPPORT_EMAIL}</a>
            </p>
          </section>

          {/* Section 2 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">2. Données collectées</h2>
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-gray-800 mb-1">2.1 Données de compte</p>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Nom, adresse email</li>
                  <li>Date d'inscription, plan souscrit</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-gray-800 mb-1">2.2 Données de rapport</p>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Informations saisies dans le formulaire (sujet, institution, encadrant, etc.)</li>
                  <li>Contenu généré par les agents IA</li>
                  <li>Fichiers uploadés (figures, documents) — <strong>supprimés après traitement</strong></li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-gray-800 mb-1">2.3 Données de paiement</p>
                <p className="text-gray-700">
                  RapportAI ne stocke aucune donnée bancaire. Les paiements sont traités exclusivement par
                  Stripe. Seuls l'identifiant de transaction Stripe et le statut du paiement sont conservés.
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-800 mb-1">2.4 Données techniques</p>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Adresse IP (logs serveur, conservée 30 jours)</li>
                  <li>Type de navigateur et système d'exploitation</li>
                  <li>Pages visitées et actions effectuées (analytics anonymisé)</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-gray-800 mb-1">2.5 Données de parrainage</p>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Code de parrainage, identifiant du parrain si applicable</li>
                  <li>Solde de cashback</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 3 — table */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. Finalités du traitement</h2>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Donnée</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Finalité</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Base légale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    ["Email + nom", "Gestion du compte, communication", "Exécution du contrat"],
                    ["Données du rapport", "Génération du contenu IA", "Exécution du contrat"],
                    ["Fichiers uploadés", "Extraction de figures", "Consentement + contrat"],
                    ["Logs techniques", "Sécurité, débogage", "Intérêt légitime"],
                    ["Analytics anonymisés", "Amélioration du Service", "Intérêt légitime"],
                    ["Données de paiement", "Facturation", "Obligation légale"],
                  ].map(([data, purpose, basis]) => (
                    <tr key={data} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">{data}</td>
                      <td className="px-4 py-3 text-gray-700">{purpose}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{basis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 4 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">4. Partage des données avec des tiers</h2>
            <p className="text-gray-700 font-semibold mb-4">RapportAI ne vend jamais vos données personnelles.</p>
            <div className="space-y-4">
              {[
                {
                  name: "Anthropic (Claude API)",
                  desc: "Vos données de rapport sont envoyées à l'API Anthropic pour la génération de contenu. Anthropic traite ces données selon sa propre politique de confidentialité. Les données envoyées à l'API Anthropic ne sont pas utilisées pour entraîner leurs modèles.",
                },
                {
                  name: "Stripe",
                  desc: "Données nécessaires au traitement des paiements uniquement.",
                },
                {
                  name: "Resend",
                  desc: "Votre adresse email pour l'envoi des emails transactionnels (bienvenue, rapport prêt).",
                },
                {
                  name: "Render (hébergeur)",
                  desc: "Hébergement de l'application et des données.",
                },
              ].map((p) => (
                <div key={p.name} className="bg-gray-50 rounded-xl p-4">
                  <p className="font-semibold text-gray-800 mb-1">{p.name}</p>
                  <p className="text-gray-700 text-sm">{p.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Section 5 — retention table */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">5. Conservation des données</h2>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Type de donnée</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Durée de conservation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    ["Compte utilisateur", "Jusqu'à suppression + 30 jours"],
                    ["Rapports générés", "12 mois (6 mois plan gratuit)"],
                    ["Fichiers uploadés", "Supprimés immédiatement après traitement"],
                    ["Logs techniques", "30 jours"],
                    ["Données de paiement", "5 ans (obligation légale comptable)"],
                  ].map(([type, duration]) => (
                    <tr key={type} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">{type}</td>
                      <td className="px-4 py-3 text-gray-600">{duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 6 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">6. Sécurité</h2>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Transmission des données chiffrée via HTTPS/TLS</li>
              <li>Clés API et secrets stockés dans des variables d'environnement sécurisées</li>
              <li>Accès à la base de données restreint aux services autorisés</li>
              <li>Aucun employé RapportAI n'a accès au contenu de vos rapports en dehors du support technique sur demande explicite de l'utilisateur</li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">7. Vos droits</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Conformément à la loi marocaine 09-08 relative à la protection des personnes physiques
              à l'égard du traitement des données à caractère personnel, vous disposez des droits suivants :
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ["Droit d'accès", "Obtenir une copie de vos données personnelles"],
                ["Droit de rectification", "Corriger des données inexactes"],
                ["Droit d'effacement", "Demander la suppression de votre compte et données"],
                ["Droit d'opposition", "Vous opposer à certains traitements"],
                ["Droit à la portabilité", "Recevoir vos données dans un format structuré"],
              ].map(([right, desc]) => (
                <div key={right} className="bg-gray-50 rounded-xl p-3">
                  <p className="font-semibold text-gray-800 text-sm">{right}</p>
                  <p className="text-gray-600 text-xs mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
            <p className="text-gray-700 mt-4">
              Pour exercer ces droits :{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-purple-600 hover:underline">{SUPPORT_EMAIL}</a>
              {" "}— Délai de réponse : 30 jours maximum.
            </p>
          </section>

          {/* Section 8 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">8. Cookies</h2>
            <p className="text-gray-700 leading-relaxed">
              RapportAI utilise uniquement des cookies strictement nécessaires au fonctionnement du
              Service (session d'authentification).{" "}
              <strong>Aucun cookie publicitaire ou de tracking tiers n'est utilisé.</strong>
            </p>
          </section>

          {/* Section 9 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">9. Modifications</h2>
            <p className="text-gray-700 leading-relaxed">
              Toute modification substantielle de cette politique sera notifiée par email avec un préavis
              de 15 jours.
            </p>
          </section>

          {/* Footer */}
          <div className="border-t border-gray-100 pt-8 mt-12 text-sm text-gray-400">
            <p>Dernière mise à jour : {LAST_UPDATED}</p>
            <p className="mt-1">
              <Link href="/terms" className="text-purple-600 hover:underline">Conditions Générales d'Utilisation</Link>
              {" · "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-purple-600 hover:underline">{SUPPORT_EMAIL}</a>
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}
