---
name: rapportai-resume
description: >
  Base de connaissances pour l'agent Résumé : exemples de référence, anti-patterns,
  et guide de style. Lis ce fichier AVANT de générer le résumé.
  Les règles et le format exact sont définis dans le system prompt ; ce fichier montre
  le NIVEAU attendu — résumé FR + abstract EN + abréviations.
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

# RapportAI — Résumé : base de connaissances

Ce fichier complète le system prompt. Il contient un exemple de résumé réel,
les erreurs à éviter, et les critères de qualité.
Inspire-toi du niveau et du style — **n'utilise jamais le contenu domaine de cet exemple**.
Chaque résumé doit être écrit depuis le contenu réel du rapport : `partie-i.md`, `partie-ii.md`, `conclusion.md`.

---

## ═══ RÈGLE D'OR — le résumé synthétise, jamais depuis la mémoire ═══

1. Lis **toutes les sections disponibles** avant d'écrire : `introduction.md`, `partie-i.md`, `partie-ii.md`, `conclusion.md`.
2. Le résumé est en **prose continue** — zéro sous-titre à l'intérieur des blocs Résumé et Abstract.
3. Registre **impersonnel** : jamais "nous avons", jamais "j'ai" — constructions passives et impersonnelles.
4. Résumé FR et Abstract EN sont **indépendants linguistiquement** — ne traduis pas mécaniquement.
5. Le résumé est généré **en une seule passe** et sauvegardé dans `resume.md`. Seule une confirmation courte va dans le chat.

---

## Exemple de résumé complet (bibliothèque de référence)

> ⚠️ Cet extrait est un exemple de **niveau, style et structure uniquement**. Ne reproduis jamais ce contenu — adapte au thème réel de l'étudiant.

---

### Exemple 1 — Mémoire Master (audit externe, RPA) — extrait réel

**Contexte :** Mémoire Master, expertise comptable et audit. Thème : *La Robotic Process Automation (RPA) dans l'audit externe du cycle Achats-Fournisseurs*. Approche : descriptive + analytique + qualitative, étude de cas, entretiens semi-directifs, cabinet casablancais.

---

**Résumé**

La transformation digitale soumet les cabinets d'expertise comptable et d'audit à une pression croissante de modernisation de leurs pratiques professionnelles. Dans ce contexte, l'automatisation robotisée des processus (RPA — Robotic Process Automation) apparaît comme une technologie à fort potentiel pour améliorer l'efficacité, la qualité et l'exhaustivité des missions d'audit externe, particulièrement au sein du cycle Achats-Fournisseurs, cycle réputé pour sa densité transactionnelle et son exposition aux risques d'anomalies significatives affectant les états financiers.

Ce mémoire s'interroge sur la manière dont la RPA peut transformer les diligences d'audit externe appliquées au cycle Achats-Fournisseurs, en termes d'efficacité opérationnelle, de qualité des éléments probants et de couverture des assertions d'audit. En mobilisant une approche descriptive, analytique et qualitative fondée sur une étude de cas et des entretiens semi-directifs conduits au sein d'un cabinet d'expertise comptable et d'audit à Casablanca, cette recherche articule une revue de littérature approfondie aux réalités du terrain marocain.

Les résultats montrent que la RPA permet une automatisation significative des procédures d'audit répétitives à faible valeur ajoutée — rapprochement de factures (three-way matching), circularisation des tiers, vérification du référentiel fournisseurs, tests de contrôle sur les autorisations — libérant ainsi l'auditeur externe pour des activités analytiques, de jugement professionnel et de supervision de plus grande valeur. Les hypothèses émises sont largement confirmées : la RPA réduit le risque de non-détection, améliore la couverture en permettant un contrôle exhaustif de 100 % des transactions (vs. sondage traditionnel), renforce la traçabilité des diligences et facilite le passage vers un audit continu. Toutefois, des risques spécifiques — gouvernance des bots, dépendance aux données structurées, maintien du scepticisme professionnel — requièrent la mise en place de contrôles compensatoires adaptés et une doctrine d'utilisation formalisée dans la méthodologie du cabinet.

**Mots-clés :** RPA, automatisation, audit externe, cycle Achats-Fournisseurs, assertions d'audit, seuil de signification, ISA, normes d'audit, transformation digitale, cabinet d'audit, Maroc.

---

**Ce que cet exemple montre :**
- **Paragraphe 1** : contexte + pourquoi le sujet est pertinent (transformation digitale → pression → RPA → cycle AP)
- **Paragraphe 2** : problématique + méthodologie en une seule phrase développée
- **Paragraphe 3** : résultats spécifiques avec chiffres + nuances (risques identifiés) + contribution
- **Mots-clés** : 10 termes couvrant technologie, domaine, normes, contexte géographique — plus de 5 est courant en pratique marocaine même si le format théorique dit 5 max
- **Aucun sous-titre** dans les blocs Résumé et Abstract
- **Aucun "nous avons"** — tout est impersonnel : "ce mémoire s'interroge", "les résultats montrent", "la RPA permet"

---

## Anti-patterns — à éviter absolument

❌ **Sous-titres à l'intérieur du résumé** : "Contexte et enjeux", "Méthodologie", "Résultats"
   ✅ Prose continue — les trois éléments (contexte, méthode, résultats) sont tissés dans les paragraphes.

❌ **"Nous avons étudié…", "Dans ce travail, nous avons…"**
   ✅ Construction impersonnelle : "ce travail analyse", "l'étude montre", "les résultats indiquent".

❌ **Résumé générique sans chiffres ni résultats spécifiques** : "Les résultats sont satisfaisants et ouvrent des perspectives."
   ✅ Spécifique : nommer les modèles, les taux, les outils, les hypothèses confirmées — comme l'exemple (100 % des transactions, gouvernance des bots, etc.).

❌ **Abstract en traduction mot-à-mot trop littérale** : phrases maladroites en anglais.
   ✅ L'Abstract est la version anglaise du Résumé — même contenu, traduit en anglais académique naturel (pas de nouveau contenu, pas de traduction robotique).

❌ **Copier des phrases entières depuis partie-i.md ou partie-ii.md**.
   ✅ Synthétiser — extraire l'essentiel, reformuler en langage de résumé.

❌ **Abréviations incluses même si non pertinentes**.
   ✅ Bloc `## Liste des Abréviations` inclus UNIQUEMENT si le thème/filière génère naturellement des acronymes standards (finance → DCF, WACC ; audit → ISA, RPA ; informatique → API, ML). Sinon : omettre entièrement.

❌ **Streamer le résumé dans le chat** après l'avoir sauvegardé.
   ✅ Envoyer uniquement la confirmation courte dans le chat — le contenu est dans le preview.

---

## ═══ RAPPEL FINAL ═══

Le résumé ne s'écrit qu'après avoir lu toutes les sections disponibles. Il synthétise le rapport réel de l'étudiant — jamais depuis la mémoire ou une intuition sur le thème. Chaque phrase doit pouvoir être vérifiée dans `partie-i.md`, `partie-ii.md`, ou `conclusion.md`.

---

## Quality checklist (vérifie avant de sauvegarder)

- [ ] `introduction.md`, `partie-i.md`, `partie-ii.md`, `conclusion.md` lus (tous ceux qui existent)
- [ ] Résumé FR : 2–3 paragraphes, 200–350 mots, aucun sous-titre interne, aucun bullet
- [ ] Résumé FR : registre impersonnel — zéro "nous avons" ou "j'ai"
- [ ] Résumé FR : contexte + problématique + méthodologie + résultats couverts
- [ ] Résultats spécifiques mentionnés (modèles, chiffres, hypothèses validées) — pas de vague
- [ ] Mots-clés FR : 5–10 termes, minuscules, séparés par des virgules
- [ ] Abstract EN : version anglaise du Résumé FR — même contenu, traduction naturelle (pas mot-à-mot), 1–2 paragraphes
- [ ] Keywords EN : équivalents sémantiques des mots-clés FR
- [ ] `## Liste des Abréviations` : inclus uniquement si pertinent, tableau `| Sigle | Signification |`
- [ ] Aucune phrase copiée depuis les sections sources — tout synthétisé
- [ ] Sauvegardé dans `resume.md`
- [ ] Seule une confirmation courte envoyée dans le chat
