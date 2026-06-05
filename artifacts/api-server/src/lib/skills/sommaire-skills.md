---
name: rapportai-sommaire
description: >
  Base de connaissances pour l'agent Sommaire : exemples de référence, guide par filière,
  et anti-patterns. Lis ce fichier AVANT de générer le sommaire. Les règles et le format
  exact sont définis dans le system prompt ; ce fichier montre le NIVEAU attendu et comment
  adapter selon le type de rapport et la filière.
allowed-tools:
  - Read
  - Write
---

# RapportAI — Sommaire : base de connaissances

Ce fichier complète le system prompt. Il contient des exemples réels, un guide par filière,
et les erreurs à éviter. Inspire-toi du niveau et du format — n'invente jamais le même contenu.

---

## ═══ RÈGLE D'OR — la structure suit TOUJOURS l'étudiant ═══

La priorité absolue va aux préférences de l'étudiant et à son sujet réel :
1. Canevas ou plan uploadé → suis-le exactement, ne le renomme pas.
2. L'étudiant exprime une préférence ou demande une structure → suis-la.
3. Sinon → propose une structure inspirée des exemples ci-dessous, adaptée à son thème.
4. C'est une CONVERSATION : propose un premier sommaire, puis ajuste librement selon ses retours.

La STRUCTURE dépend du type de rapport ; le VOCABULAIRE dépend de la filière.

---

## Exemples de sommaires (bibliothèque de référence)

Chaque exemple montre le niveau et le format attendus. Adapte au thème réel, ne copie jamais le contenu.

### Exemple 1 — PFE Finance / Gestion (étude de cas RISMA)

## Remerciements
## Liste des abréviations
## Liste des tableaux et figures
## Sommaire

## Introduction générale

## Partie I — Cadre théorique et conceptuel
### Chapitre 1 — Clarification des concepts clés
- 1.1 Les cycles économiques
- 1.2 Les méthodes de valorisation
- 1.3 VBA en Excel
### Chapitre 2 — Pertinence de l'analyse de l'impact des cycles économiques
- 2.1 Au regard de l'investissement
- 2.2 Au regard de la valorisation

## Partie II — Étude de cas : RISMA
### Chapitre 1 — Scénario 1 : Modélisation sans intégration des cycles économiques
- 1.1 L'organisme d'accueil
- 1.2 Données et méthodologie
- 1.3 Résultats du modèle
### Chapitre 2 — Scénario 2 : EBITDA corrigé des effets conjoncturels
- 2.1 Données et méthodologie
- 2.2 Résultats de l'ajustement
- 2.3 Réflexions finales sur le modèle

## Conclusion générale
## Bibliographie
## Table des matières
## Annexes

---

### Exemple 2 — PFE Génie Civil (dimensionnement d'un bâtiment)

## Remerciements
## Liste des abréviations
## Liste des tableaux et figures
## Sommaire

## Introduction générale

## Partie I — Présentation du projet et cadre théorique
### Chapitre 1 — Présentation générale du projet et conception
- 1.1 Description du projet et contexte
- 1.2 Conception architecturale et structurale
- 1.3 Règlements et normes appliqués (BAEL 91, RPS 2011, Eurocodes)
### Chapitre 2 — Hypothèses de calcul et caractéristiques des matériaux
- 2.1 Caractéristiques des matériaux : béton et acier
- 2.2 Évaluation des charges et combinaisons d'actions
- 2.3 Étude géotechnique et reconnaissance du sol

## Partie II — Étude technique et dimensionnement
### Chapitre 1 — Modélisation et dimensionnement de la superstructure
- 1.1 Modélisation de la structure (logiciel CBS / Robot)
- 1.2 Dimensionnement des poutres et poteaux
- 1.3 Dimensionnement des planchers et dalles
### Chapitre 2 — Fondations, étude sismique et estimation
- 2.1 Dimensionnement des fondations
- 2.2 Étude dynamique et analyse sismique
- 2.3 Métré et estimation du coût du projet

## Conclusion générale
## Bibliographie
## Table des matières
## Annexes

---

### Exemple 3 — Rapport de stage (commerce / gestion)

## Remerciements
## Liste des abréviations
## Liste des tableaux et figures
## Sommaire

## Introduction générale

## Partie I — Présentation de l'organisme d'accueil et cadre du stage
### Chapitre 1 — Présentation de l'entreprise
- 1.1 Historique et activités
- 1.2 Organisation et structure
- 1.3 Le secteur d'activité et son environnement
### Chapitre 2 — Cadre et déroulement du stage
- 2.1 Le service d'accueil
- 2.2 Objectifs et missions confiées
- 2.3 Méthodologie de travail adoptée

## Partie II — Missions réalisées et analyse critique
### Chapitre 1 — Description des missions réalisées
- 1.1 [Première mission]
- 1.2 [Deuxième mission]
- 1.3 [Troisième mission]
### Chapitre 2 — Bilan et analyse critique
- 2.1 Apports et compétences acquises
- 2.2 Difficultés rencontrées et solutions
- 2.3 Recommandations et perspectives

## Conclusion générale
## Bibliographie
## Table des matières
## Annexes

---

## Anti-patterns — à éviter absolument

❌ **Titres génériques** : "Définitions", "Généralités", "Contexte", "Introduction au sujet".
   ✅ À la place : des titres qui nomment le contenu réel ("La théorie de Markowitz : hypothèses et limites").

❌ **Théorie qui déborde dans la Partie II** (ou pratique dans la Partie I).
   ✅ Partie I = théorique/conceptuel uniquement ; Partie II = pratique/empirique uniquement.

❌ **Structure déséquilibrée** : un chapitre avec une seule section, ou une partie avec un seul chapitre.
   ✅ Chaque chapitre regroupe plusieurs sections cohérentes.

❌ **Titres déconnectés de la problématique** (ex. "fondements de l'économie" pour un sujet sur la digitalisation bancaire).
   ✅ Les titres reflètent le thème exact, tirés de la problématique et des mots-clés.

❌ **Oublier les pages préparatoires ou finales** (remerciements, abréviations, listes, annexes).
   ✅ Toujours présentes, quelle que soit la structure.

❌ **Symboles `#` collés au texte** (`##Partie I`).
   ✅ Toujours un espace : `## Partie I`.

---

## ═══ RAPPEL FINAL — la structure dépend toujours de l'étudiant ═══

Ces exemples ne sont que des modèles de référence. La structure finale dépend TOUJOURS :
- de son canevas ou plan s'il en a un (priorité absolue),
- de son sujet réel et de sa filière,
- et de ses préférences.

C'est une CONVERSATION : propose un premier sommaire inspiré de ces exemples, adapté à son
thème, puis ajuste librement selon ses retours. Ne force jamais un étudiant dans un de ces
modèles. Garde seulement constantes les pages préparatoires (remerciements, abréviations,
listes, sommaire) et les pages finales (conclusion, bibliographie, table des matières, annexes).

---

## Quality checklist (vérifie avant de sauvegarder)

- [ ] sommaire.md enregistré avec l'outil Write
- [ ] Pages préparatoires présentes (remerciements, abréviations, listes, sommaire)
- [ ] `## Partie I` et `## Partie II` présents (marqueurs exacts, un espace après `##`)
- [ ] Numérotation des chapitres recommence à 1 dans chaque partie
- [ ] Numéros de section suivant leur chapitre (Ch. 2 → 2.1, 2.2…)
- [ ] Titres spécifiques au thème, jamais génériques
- [ ] Partie I théorique, Partie II pratique/empirique
- [ ] Structure équilibrée (pas de chapitre à une seule section)
- [ ] Pages finales présentes (conclusion, bibliographie, table des matières, annexes)
- [ ] Si canevas/plan uploadé : structure préservée exactement
