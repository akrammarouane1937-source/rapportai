---
name: rapportai-partie-i
description: >
  Base de connaissances pour l'agent Partie I : exemples de référence, anti-patterns,
  et flow d'approbation section par section. Lis ce fichier AVANT de générer la Partie I.
  Les règles et le format exact sont définis dans le system prompt ; ce fichier montre
  le NIVEAU attendu et comment adapter selon le type de rapport et la filière.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - WebFetch
  - WebSearch
---

# RapportAI — Partie I : base de connaissances

Ce fichier complète le system prompt. Il contient des exemples de prose académique,
le flow d'approbation section par section, et les erreurs à éviter.
Inspire-toi du niveau et du style — **n'utilise jamais le contenu domaine de ces exemples**.
Chaque rapport doit être écrit depuis le contexte réel de l'étudiant : `sommaire.md`, `student_memory.json`, documents uploadés.

---

## ═══ RÈGLE D'OR — le contenu vient toujours de l'étudiant ═══

1. Le sujet, les concepts, les auteurs → lus depuis `student_memory.json` + documents uploadés + WebSearch sur le thème réel.
2. La structure → lue depuis le bloc `## Partie I` de `sommaire.md` — autoritaire, ne pas modifier.
3. Ces exemples montrent comment écrire — jamais quoi écrire.
4. C'est une CONVERSATION : génère section par section, attends la validation, adapte-toi aux retours.

---

## Flow d'approbation — section par section (défaut)

Ne jamais générer toute la Partie I d'un coup sauf si l'étudiant le demande explicitement.

**Après chaque section, s'arrêter et demander :**
> ✅ **Section [X.X — Titre]** rédigée (~[N] mots).
> Souhaitez-vous continuer avec **[X.X+1 — Titre suivant]**, modifier quelque chose, ou passer à un autre chapitre ?

**Si l'étudiant dit "continue" ou "génère tout le reste"** → passer en mode complet pour la suite.

**Exemple de conversation :**

> Agent : ✅ Section 1.1 — Le risque de marché rédigée (~650 mots). Continuer avec 1.2 — Les instruments de mesure, ou ajuster quelque chose ?
>
> Étudiant : Continue.
>
> Agent : ✅ Section 1.2 rédigée (~700 mots). Continuer avec 1.3 — Le cadre réglementaire marocain ?
>
> Étudiant : Génère tout le reste sans t'arrêter.
>
> Agent : → passe en mode complet pour les sections restantes.

---

## Exemples de prose académique (bibliothèque de référence)

Chaque exemple montre le niveau et le style attendus. **Le domaine (finance, banque…) est illustratif — n'en réutilise aucun contenu. Adapte au thème réel de l'étudiant.**

---

### Exemple 1 — PFE / Mémoire (cadre théorique)

**Contexte :** PFE Finance, ENCG Casablanca. Thème : *La gestion des risques dans les OPCVM marocains*. Section 1.1. Style APA. Aucune figure uploadée.

---

Le risque de marché désigne la probabilité de subir des pertes financières résultant de variations défavorables des prix d'actifs cotés — cours boursiers, taux d'intérêt, taux de change ou prix des matières premières. Pour les organismes de placement collectif en valeurs mobilières (OPCVM), ce risque constitue la principale source d'exposition, dans la mesure où leurs portefeuilles sont directement valorisés aux prix de marché selon le principe de la valeur liquidative quotidienne.

La littérature financière distingue classiquement deux composantes du risque de marché. Le risque systématique, ou risque non diversifiable, reflète les fluctuations générales de l'économie — cycles conjoncturels, décisions de politique monétaire, chocs géopolitiques — auxquelles aucun portefeuille diversifié ne peut totalement se soustraire (Sharpe, 1964 ; Fama & French, 1993). Le risque spécifique, à l'inverse, est propre à un émetteur ou à un secteur et peut être atténué par la diversification. Cette distinction est au cœur de la théorie moderne du portefeuille (Markowitz, 1952), qui démontre que seul le risque systématique est rémunéré par le marché.

Dans le contexte marocain, la Bourse de Casablanca présente des caractéristiques structurelles qui amplifient certaines dimensions du risque de marché. La concentration sectorielle — les valeurs bancaires et les télécommunications représentant historiquement plus de 40 % de la capitalisation du MASI — limite la diversification effective des portefeuilles domestiques (AMMC, 2023). La faible liquidité de plusieurs compartiments accroît par ailleurs la volatilité implicite, deux dimensions que l'AMMC intègre désormais dans son cadre de surveillance prudentielle.

La mesure du risque de marché a connu une évolution méthodologique majeure depuis les années 1990. La Value-at-Risk (VaR), popularisée par RiskMetrics (J.P. Morgan, 1994), permet d'estimer la perte maximale probable sur un horizon et à un seuil de confiance donnés. Malgré sa large adoption réglementaire — Bâle II puis Bâle III l'imposent aux établissements de crédit —, la VaR a montré ses limites lors de la crise de 2008 en sous-estimant les événements de queue de distribution (Taleb, 2007). La Expected Shortfall (ES), ou CVaR, a depuis été recommandée par le Comité de Bâle comme mesure complémentaire.

Ces cadres conceptuels sont directement pertinents pour la problématique de ce rapport : évaluer dans quelle mesure les OPCVM marocains disposent des outils nécessaires pour identifier, mesurer et piloter leur exposition au risque de marché conformément aux exigences de l'AMMC.

*Figure 1.1 — Décomposition du risque total en risque systématique et risque spécifique. Source : Sharpe (1964), adapté.*

---

### Exemple 2 — Rapport de stage / PFA (présentation de l'organisme)

**Contexte :** Rapport de stage, EST Salé. Entreprise : *Attijariwafa Bank — Direction Gestion des Risques*. Section 1.2. Style APA.

---

La Direction Gestion des Risques (DGR) d'Attijariwafa Bank constitue l'une des fonctions de contrôle de second niveau du groupe, conformément au dispositif des trois lignes de défense préconisé par le Comité de Bâle et transposé dans la réglementation bancaire marocaine par Bank Al-Maghrib (Circulaire n° 4/W/2014). Elle est rattachée directement à la Direction Générale et entretient un reporting fonctionnel avec le Comité des Risques du Conseil d'Administration, garantissant son indépendance vis-à-vis des lignes métiers.

Sur le plan organisationnel, la DGR se structure autour de quatre pôles spécialisés : le pôle risques de crédit, le pôle risques de marché et de liquidité, le pôle risques opérationnels, et le pôle conformité et contrôle permanent. Cette segmentation reflète la taxonomie des risques bancaires définie par Bâle III et permet une expertise méthodologique approfondie dans chacun de ces domaines.

Les missions de la DGR couvrent l'ensemble du cycle de vie du risque : identification, évaluation, surveillance, reporting et atténuation. Pour le risque de marché, elle assure le calcul quotidien de la VaR du portefeuille de négociation et produit un rapport de limite hebdomadaire à destination du Comité ALM.

Mon stage au sein du pôle risques de marché m'a permis d'observer ces processus de l'intérieur, notamment la chaîne de traitement des données de marché (Bloomberg → système de calcul interne → tableau de bord risques) et les interactions entre la DGR et les équipes de la salle des marchés lors des dépassements de limites.

*Figure 1.2 — Organigramme simplifié de la Direction Gestion des Risques, Attijariwafa Bank. Source : document interne, stage 2024.*

---

## Anti-patterns — à éviter absolument

❌ **Générer toute la Partie I d'un seul coup** sans validation intermédiaire.
   ✅ Section par section — attendre l'approbation avant de continuer.

❌ **Réutiliser le contenu domaine des exemples** (finance, OPCVM, Attijariwafa…) pour un autre thème.
   ✅ Tout le contenu vient du contexte réel de l'étudiant — uniquement.

❌ **Imposer "cadre théorique"** pour un rapport de stage dont le sommaire dit "Présentation de l'entreprise".
   ✅ La nature de la Partie I est dictée par le sommaire — jamais supposée.

❌ **Structure mécanique** : "Ouverture → Développement → Synthèse" répétée mécaniquement dans chaque section.
   ✅ Prose académique fluide — varie le rythme et l'organisation naturellement.

❌ **Remplir pour atteindre un quota de mots** (600, 900, peu importe).
   ✅ Longueur déterminée par la profondeur que le sujet exige.

❌ **Citer des sources inventées** ou non vérifiables sans les marquer.
   ✅ Toute citation non vérifiable → `[SOURCE]` pour que l'étudiant la complète.

❌ **Oublier la figure ou le placeholder** dans un chapitre.
   ✅ Au moins une figure ou placeholder pertinent par chapitre.

---

## ═══ RAPPEL FINAL — le contenu vient toujours de l'étudiant ═══

Ces exemples ne sont que des modèles de style et de niveau. Le contenu réel dépend TOUJOURS :
- de son sujet réel et de sa filière,
- de son `sommaire.md` et de son `student_memory.json`,
- de ses documents uploadés ou des sources WebSearch sur son thème,
- et de ses préférences exprimées en conversation.

---

## Quality checklist (vérifie avant de sauvegarder)

- [ ] `sommaire.md` lu, bloc Partie I entièrement extrait
- [ ] Nature de la Partie I conforme au sommaire (théorique ou organisme) — jamais imposée
- [ ] Tous les documents `.txt` uploadés lus
- [ ] Chaque chapitre et section du sommaire couverts — rien ajouté, rien sauté
- [ ] Flow section par section respecté — validation demandée après chaque section
- [ ] Chaque section développée avec profondeur — pas de remplissage, pas de coupe artificielle
- [ ] Introduction de la Partie I + Conclusion de chaque chapitre + Conclusion de la Partie I présentes
- [ ] Hiérarchie de titres respectée (`#` / `##` / `###`)
- [ ] Style de citation conforme à la mise en forme de l'étudiant
- [ ] `[SOURCE]` sur les citations non vérifiables
- [ ] Au moins une figure ou placeholder par chapitre quand pertinent
- [ ] Ne contredit jamais la problématique ou les hypothèses de `student_memory.json`
- [ ] Enregistré dans `partie-i.md`
