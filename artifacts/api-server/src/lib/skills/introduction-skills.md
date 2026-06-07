---
name: rapportai-introduction
description: >
  Base de connaissances pour l'agent Introduction : exemples de référence, anti-patterns,
  et guide de style. Lis ce fichier AVANT de générer l'introduction.
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

# RapportAI — Introduction : base de connaissances

Ce fichier complète le system prompt. Il contient des exemples de prose académique,
les erreurs à éviter, et les critères de qualité.
Inspire-toi du niveau et du style — **n'utilise jamais le contenu domaine de ces exemples**.
Chaque introduction doit être écrite depuis le contexte réel de l'étudiant : `profile.json`, `student_memory.json`, documents uploadés.

---

## ═══ RÈGLE D'OR — le contenu vient toujours de l'étudiant ═══

1. Le thème, la problématique, les objectifs → lus depuis `student_memory.json` + `profile.json`.
2. L'introduction est en **prose continue** — zéro sous-titre, zéro liste, zéro numérotation.
3. Les cinq éléments (contexte → problématique → objectifs → méthodologie → plan) sont **tissés naturellement** dans les paragraphes — jamais annoncés.
4. Ces exemples montrent comment écrire — jamais quoi écrire.
5. L'introduction est générée **en une seule passe** (pas de section-par-section) et sauvegardée dans `introduction.md`. Seule une confirmation courte va dans le chat.

---

## Exemples de prose académique (bibliothèque de référence)

> ⚠️ Ces extraits sont des exemples de **niveau, style et structure uniquement**. Ne reproduis jamais ce contenu — adapte au thème réel de l'étudiant.

---

### Exemple 1 — PFE Finance (mémoire de recherche) — extrait réel

**Contexte :** PFE Finance, ISCAE. Thème : *L'impact des cycles économiques sur les méthodes d'évaluation des entreprises*.

---

La formule utilisée pour calculer le PIB démontre clairement que chaque entreprise contribue à l'économie, tout en étant elle-même soumise à ses dynamiques. En effet, les cycles économiques sont mesurés par la croissance du PIB, ce qui implique automatiquement que les entreprises représentent un canal de transmission des forces et des faiblesses d'une économie. Or, si les entreprises sont sensibles aux cycles économiques, les méthodes utilisées pour les évaluer le sont-elles tout autant ?

L'évaluation des entreprises est un exercice délicat qui mobilise des hypothèses sur la croissance future des revenus, la structure du capital et le niveau des taux d'actualisation — trois paramètres directement influencés par la position dans le cycle. Un analyste qui valorise une entreprise en phase d'expansion sans corriger ses projections pour tenir compte du retournement probable introduit un biais systématique dans son estimation. Ce biais n'est pas marginal : il peut conduire à des décisions d'investissement profondément erronées, comme l'illustre la série de surévaluations observées avant les crises de 2001 et 2008.

C'est dans ce contexte que se pose la problématique suivante : dans quelle mesure les cycles économiques influencent-ils la pertinence des méthodes d'évaluation des entreprises, et comment intégrer cette dimension cyclique dans un modèle DCF applicable au marché boursier marocain ?

Pour répondre à cette question, ce travail poursuit trois objectifs complémentaires : analyser les caractéristiques et les mécanismes des cycles économiques dans la littérature financière ; examiner les méthodes d'évaluation les plus utilisées par les praticiens, en particulier le DCF et les multiples de valorisation ; et proposer une application empirique sur RISMA, premier groupe hôtelier coté à la Bourse de Casablanca, pour mesurer l'impact réel des phases cycliques sur la valeur d'entreprise estimée.

Sur le plan méthodologique, cette étude mobilise une approche quantitative. Elle s'appuie sur les données financières historiques de RISMA (2016–2024), sur la datation des cycles économiques marocains par les méthodes de Bry-Boschan et Hamilton, et sur la modélisation DCF sous deux scénarios : un premier sans correction cyclique, un second intégrant les taux de croissance de l'EBITDA propres à chaque phase du cycle.

Ce travail s'articule autour de deux parties. La première est consacrée au cadre théorique : elle présente les cycles économiques, leurs étapes et leurs théories explicatives, puis analyse les méthodes de valorisation les plus répandues dans la pratique financière. La seconde partie constitue le cadre pratique de l'étude : elle présente l'organisme d'accueil, puis développe les deux scénarios de valorisation de RISMA avec leurs résultats et leur interprétation.

---

### Exemple 2 — Rapport de stage (présentation organisme + mission)

**Contexte :** Rapport de stage, EST Salé. Filière : Gestion des entreprises. Entreprise : *Banque Populaire — Direction Commerciale*.

---

Le secteur bancaire marocain a connu, au cours des deux dernières décennies, une transformation structurelle profonde : bancarisation croissante, montée en puissance des services numériques, durcissement du cadre prudentiel sous l'impulsion de Bank Al-Maghrib. Dans ce mouvement, la relation client est devenue un terrain de compétition aussi stratégique que la solidité bilancielle. Les établissements qui maîtrisent leurs processus de fidélisation et de prospection maintiennent un avantage durable ; ceux qui les négligent voient leur part de marché s'éroder, même en période de croissance du crédit.

C'est dans cette réalité sectorielle que s'inscrit mon stage de six semaines au sein de la Direction Commerciale de la Banque Populaire de Salé. Rattachée au Groupe Banque Populaire, premier réseau bancaire du Maroc avec plus de 7 millions de clients, cette agence gère un portefeuille de clients particuliers et professionnels dans un environnement urbain dense, soumis à une concurrence directe d'Attijariwafa Bank et du CIH. Ma mission principale a consisté à participer à la campagne de relance des comptes dormants et à observer les outils de suivi de la relation client utilisés par l'équipe commerciale.

Ce rapport poursuit plusieurs objectifs : décrire le fonctionnement de la Direction Commerciale et son positionnement dans la structure du groupe ; analyser les processus de gestion de la relation client mis en œuvre ; et évaluer l'efficacité des outils CRM utilisés en agence, notamment dans le cadre de la campagne de réactivation à laquelle j'ai contribué.

Sur le plan méthodologique, ce travail repose sur l'observation directe des pratiques en agence, sur des entretiens informels avec les chargés de clientèle et le directeur d'agence, et sur l'analyse des tableaux de bord commerciaux auxquels j'ai eu accès. Ces sources primaires sont complétées par la documentation interne de la banque et les publications sectorielles de Bank Al-Maghrib.

Ce rapport est organisé en deux parties. La première présente la Banque Populaire et son agence de Salé : historique, structure, offre de services et environnement concurrentiel. La seconde analyse le déroulement du stage, les missions réalisées et les enseignements tirés, avec un regard critique sur les pratiques observées en matière de gestion de la relation client.

---

## Anti-patterns — à éviter absolument

❌ **Ouvrir sur une généralité vague** : "De nos jours, le monde connaît des mutations profondes…"
   ✅ Ouvrir sur une idée concrète et spécifique au thème — voir exemples ci-dessus.

❌ **Annoncer les cinq éléments comme des rubriques** : "Dans cette introduction, nous allons d'abord présenter le contexte, puis la problématique…"
   ✅ Tisser les éléments dans la prose — le lecteur les ressent, ne les voit pas étiquetés.

❌ **Lister les objectifs** : "1. Analyser… 2. Évaluer… 3. Proposer…"
   ✅ Intégrer en prose avec verbes d'action : "Ce travail vise à analyser… et à évaluer…"

❌ **Phrases clichées marocaines** : "Dans le cadre de ce modeste travail…", "Ce travail humble…", "Notre humble contribution…"
   ✅ Registre professionnel — aucune fausse modestie.

❌ **Annoncer le plan mécaniquement** : "Ce rapport se compose de deux parties : la première partie et la deuxième partie."
   ✅ Varier les formules — nommer les titres réels des parties, décrire brièvement leur contenu.

❌ **Dépasser 750 mots ou rester sous 400** : trop court = manque de contexte ; trop long = empiète sur le corps du rapport.
   ✅ Viser 450–650 mots — dense et complet, pas délayé.

❌ **Écrire l'introduction sans lire le sommaire** si `sommaire.md` existe.
   ✅ L'annonce du plan (§ final) doit correspondre exactement aux titres des parties dans `sommaire.md`.

❌ **Streamer l'introduction dans le chat** après l'avoir sauvegardée.
   ✅ Envoyer uniquement la confirmation courte dans le chat — le contenu est dans le preview.

---

## ═══ RAPPEL FINAL ═══

Ces exemples ne sont que des modèles de niveau et de style. Le contenu réel dépend TOUJOURS :
- du thème réel et de la filière de l'étudiant,
- de sa problématique dans `student_memory.json`,
- de ses objectifs et de son approche méthodologique,
- du plan dans `sommaire.md` pour l'annonce des parties.

---

## Quality checklist (vérifie avant de sauvegarder)

- [ ] `profile.json` et `student_memory.json` lus
- [ ] `sommaire.md` lu si disponible — annonce du plan conforme aux titres réels
- [ ] Aucun sous-titre `###` dans le contenu de l'introduction
- [ ] Aucune liste à puces ou numérotée (sauf ✓ questions de recherche si explicitement demandé)
- [ ] Ouverture sur une idée concrète et spécifique — pas une généralité
- [ ] Contexte : 2–3 paragraphes, monte en puissance vers la problématique
- [ ] Problématique : conséquence logique du contexte, pas une annonce abrupte
- [ ] Objectifs : prose avec verbes d'action, pas de liste
- [ ] Méthodologie : un paragraphe, approche + outils/données
- [ ] Annonce du plan : titres réels des parties, formule variée
- [ ] Aucune phrase bannie (§ Tone rules du system prompt)
- [ ] 400–750 mots
- [ ] Sauvegardé dans `introduction.md`
- [ ] Seule une confirmation courte envoyée dans le chat
