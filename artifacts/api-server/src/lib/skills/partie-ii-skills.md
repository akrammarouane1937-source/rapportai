---
name: rapportai-partie-ii
description: >
  Base de connaissances pour l'agent Partie II : exemples de référence, anti-patterns,
  et flow d'approbation section par section. Lis ce fichier AVANT de générer la Partie II.
  Les règles et le format exact sont définis dans le system prompt ; ce fichier montre
  le NIVEAU attendu et comment adapter selon le type de rapport et la filière.
  Requiert sommaire.md ET partie-i.md — erreur immédiate si l'un est manquant.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, WebFetch, WebSearch
---

# RapportAI — Partie II : base de connaissances

Ce fichier complète le system prompt. Il contient des exemples de prose académique appliquée,
le flow d'approbation section par section, et les erreurs à éviter.
Inspire-toi du niveau et du style — **n'utilise jamais le contenu domaine de ces exemples**.
Chaque rapport doit être écrit depuis le contexte réel de l'étudiant : `sommaire.md`, `partie-i.md`, `student_memory.json`, données uploadées.

---

## ═══ RÈGLE D'OR — le contenu vient toujours de l'étudiant ═══

1. La structure → lue depuis le bloc `## Partie II` de `sommaire.md` — autoritaire.
2. Les frameworks théoriques → relus depuis `partie-i.md` — à appliquer ici, pas à réexpliquer.
3. Les données → documents uploadés par l'étudiant ou WebSearch sur son terrain réel.
4. Ces exemples montrent comment écrire — jamais quoi écrire.
5. C'est une CONVERSATION : génère section par section, attends la validation, adapte-toi aux retours.
6. Le plan de l'étudiant (free/starter/pro) fixe la limite de pages — pas toi.

---

## Flow d'approbation — section par section (défaut)

Ne jamais générer toute la Partie II d'un coup sauf si l'étudiant le demande explicitement.

**Après chaque section, s'arrêter et demander :**
> ✅ **Section [X.X — Titre]** rédigée et enregistrée dans partie-ii.md (~[N] mots).
> Souhaitez-vous continuer avec **[X.X+1 — Titre suivant]**, modifier quelque chose, ou passer à un autre chapitre ?

**Si l'étudiant dit "continue" ou "génère tout le reste"** → passer en mode complet pour la suite.

**Exemple de conversation :**

> Agent : ✅ Section 1.1 — Présentation de l'entreprise rédigée (~580 mots). Continuer avec 1.2 — Méthodologie de l'étude ?
>
> Étudiant : Oui continue.
>
> Agent : ✅ Section 1.2 rédigée (~720 mots). Continuer avec 2.1 — Résultats de l'enquête ?
>
> Étudiant : Génère tout le reste d'un coup.
>
> Agent : → passe en mode complet pour les sections restantes.

---

## Exemples de prose académique appliquée (bibliothèque de référence)

Chaque exemple montre le niveau et le style attendus. **Le domaine est illustratif — n'en réutilise aucun contenu. Adapte au thème réel de l'étudiant.**

---

### Exemple 1 — [À REMPLACER PAR UN EXTRAIT RÉEL]

> Akram fournira un extrait réel d'une Partie II de PFE/mémoire ici.

---

### Exemple 2 — Chapitre Méthodologie (sciences de gestion)

**Contexte :** PFE Management, ENCG. Section méthodologie — approche quantitative, questionnaire Likert, SPSS.

> ⚠️ Niveau et style uniquement — ne reproduis pas ce contenu pour un autre sujet.

---

La présente recherche s'inscrit dans une démarche hypothético-déductive : partant du cadre théorique élaboré en Partie I, nous avons formulé trois hypothèses de recherche que nous soumettons à une vérification empirique. Ce positionnement nous oriente naturellement vers une approche quantitative, la nature des données collectées — des mesures d'attitudes et de perceptions sur échelle de Likert — se prêtant à un traitement statistique permettant de tester la significativité des relations identifiées.

Sur le plan épistémologique, notre étude adopte une posture positiviste. La réalité que nous cherchons à appréhender — l'impact de [variable X] sur [variable Y] au sein des entreprises marocaines du secteur [Z] — est considérée comme objectivement mesurable, indépendamment de la subjectivité du chercheur. Cette posture est cohérente avec l'usage d'un questionnaire standardisé et d'outils statistiques éprouvés.

L'instrument de collecte retenu est un questionnaire auto-administré, composé de [N] items répartis en [M] dimensions, chacune mesurant un construit théorique défini en Partie I. L'échelle de Likert à 5 points (1 = Pas du tout d'accord ; 5 = Tout à fait d'accord) a été privilégiée pour sa capacité à capturer l'intensité des perceptions tout en restant accessible aux répondants. Le questionnaire a été diffusé via Google Forms auprès d'un échantillon de [N] professionnels du secteur, sélectionnés selon un échantillonnage raisonné. Le taux de retour s'est établi à [X]%, soit [N] questionnaires exploitables.

Le traitement des données a été réalisé sous SPSS version [X]. Nous avons procédé dans un premier temps à un tri à plat afin de décrire le profil de l'échantillon et les distributions de réponses pour chaque item. Dans un second temps, des analyses bivariées (corrélations de Pearson, tests de Chi-deux) ont permis d'explorer les relations entre les variables. Enfin, une régression linéaire multiple a été conduite pour tester le pouvoir explicatif des variables indépendantes sur la variable dépendante, conformément aux hypothèses formulées.

*Figure 1.X — Répartition de l'échantillon par secteur d'activité. Source : enquête de l'auteur, [année].*

[DONNÉES REQUISES — insérer ici le graphique SPSS ou les données réelles]

---

## Anti-patterns — à éviter absolument

❌ **Générer toute la Partie II d'un coup** sans validation intermédiaire.
   ✅ Section par section — attendre l'approbation avant de continuer.

❌ **Réexpliquer la théorie de la Partie I** au lieu de l'appliquer.
   ✅ Référencer brièvement ("Comme établi en Partie I…") puis appliquer au terrain réel.

❌ **Inventer des données** quand aucun fichier n'est uploadé.
   ✅ Écrire `[DONNÉES REQUISES — à compléter par l'étudiant]` et continuer.

❌ **Imposer la structure du référentiel méthodologique** si l'étudiant a une structure différente.
   ✅ Le sommaire et les préférences de l'étudiant priment toujours sur le modèle majoritaire.

❌ **Présenter un résultat sans analyse** ("72% des répondants ont répondu oui.").
   ✅ Décrire → quantifier → visualiser → interpréter à travers un framework de la Partie I.

❌ **Fiche signalétique vide avec seulement le nom de l'entreprise**.
   ✅ WebSearch avant d'écrire la section organisme — données réelles ou `[DONNÉES REQUISES]`.

❌ **Numérotation des chapitres qui continue depuis la Partie I** (Ch. 3, Ch. 4…).
   ✅ Partie II recommence toujours à Chapitre 1 — standard académique marocain.

❌ **Figures sans caption au bon format**.
   ✅ `*Figure N — [Titre]. Source : [Référence], [Auteur/Service], [Année].*` — obligatoire.

---

## ═══ RAPPEL FINAL — le contenu vient toujours de l'étudiant ═══

Ces exemples ne sont que des modèles de style et de niveau. Le contenu réel dépend TOUJOURS :
- des données et documents uploadés par l'étudiant,
- de son `sommaire.md`, `partie-i.md` et `student_memory.json`,
- de ses préférences et retours en conversation,
- et de la limite de pages fixée par son plan.

---

## Quality checklist (vérifie avant de sauvegarder)

- [ ] `sommaire.md` lu, bloc Partie II entièrement extrait
- [ ] `partie-i.md` lu, frameworks théoriques extraits pour les ponts avec la pratique
- [ ] Tous les documents `.txt` uploadés lus
- [ ] Chaque chapitre et section du sommaire couverts — rien ajouté, rien sauté
- [ ] Flow section par section respecté — validation demandée après chaque section
- [ ] Chaque résultat : décrit → quantifié → visualisé → interprété via Partie I
- [ ] Données réelles utilisées où disponibles — `[DONNÉES REQUISES]` sinon
- [ ] Section organisme : WebSearch effectué, fiche signalétique présente
- [ ] Figures générées ou placeholders insérés avec caption au bon format
- [ ] Chaque hypothèse traitée en discussion (si définies dans student_memory.json)
- [ ] Numérotation recommence à Chapitre 1 (indépendant de la Partie I)
- [ ] Conclusion de la Partie II fait la transition vers la Conclusion Générale
- [ ] `[SOURCE]` sur les citations non vérifiables
- [ ] Enregistré dans `partie-ii.md`
