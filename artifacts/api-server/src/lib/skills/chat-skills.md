---
name: rapportai-chat
description: >
  Knowledge base for the RapportAI dashboard chat assistant. Covers tool decision tree,
  theme/problématique selection workflows by filière, context injection templates,
  Moroccan academic conventions, and jury simulation guidance.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, WebFetch, WebSearch
---

# RapportAI — Chat Assistant Knowledge Base

---

## TOOL DECISION TREE

```
Student message
│
├─ "génère / continue / vas-y / je veux faire [section]" (section VIDE)
│   └─ navigate_to_section + context_injection built from current sections
│
├─ "améliore / réécris / raccourcis / humanise ma [section]" (section EXISTANTE)
│   └─ revise_section(section, instructions) — announce first, report updates in-place
│
├─ "trouve-moi des sources / références / bibliographie / articles"
│   └─ search_references(query in English) → present in APA 7, in French
│
├─ "taux directeur actuel / chiffres récents / actualité / loi 2026 / [URL]"
│   └─ web_search (données actuelles) or web_fetch (lire une URL précise)
│
├─ "combien de pages / mots / ma progression"
│   └─ get_report_stats
│
├─ "est-ce cohérent / analyse mon rapport / jury questions"
│   └─ analyze_coherence (reads everything) OR read_multiple_sections
│
├─ "qu'est-ce que tu penses de ma Partie I"
│   └─ read_full_section("partieI") → then comment specifically
│
├─ "aide-moi à choisir mon thème"
│   └─ MODE: THEME SELECTION (see below)
│
├─ "aide-moi à définir ma problématique"
│   └─ MODE: PROBLÉMATIQUE SELECTION (see below)
│
├─ "propose-moi un plan de chapitres"
│   └─ Write directly: Partie I (2-3 chapitres) / Partie II (2-3 chapitres) from theme + problématique
│
├─ "traduis mon résumé en anglais / abstract"
│   └─ read_full_section("resumeFr") → translate directly in chat
│
├─ "fais-moi un questionnaire / guide d'entretien"
│   └─ Write directly (see QUESTIONNAIRE DESIGN below)
│
├─ "écris mon discours de soutenance"
│   └─ read_multiple_sections(["introduction","partieI","partieII","conclusion"]) → write directly
│
└─ General question (concept, méthodo, conseil) → answer directly, no tool needed
```

---

## THEME SELECTION BY FILIÈRE

### Finance / Gestion / Comptabilité
- "L'impact de Bâle III sur la gestion des risques de crédit dans les banques marocaines"
- "La performance des OPCVM actions à la Bourse de Casablanca : analyse sur 5 ans"
- "L'adoption de l'IFRS 9 par les établissements de crédit marocains : enjeux et défis"
- "La finance participative au Maroc : bilan des premières années des banques islamiques"
- "Le rôle du contrôle interne dans la prévention de la fraude en entreprise marocaine"
- "L'évaluation des entreprises familiales marocaines en contexte de transmission"

### Informatique / Systèmes d'information
- "L'implémentation d'une solution DevOps dans une PME marocaine : retour d'expérience"
- "La sécurité des données personnelles dans les applications mobiles au Maroc post-CNDP"
- "Migration vers le cloud hybride dans une banque marocaine : architecture et gouvernance"
- "L'apport de l'intelligence artificielle dans la détection de fraude bancaire au Maroc"
- "L'automatisation des processus RPA dans un cabinet d'audit : impact sur la productivité"

### Management / RH / Marketing
- "La marque employeur comme levier de rétention des talents dans les entreprises marocaines"
- "L'impact du télétravail sur la performance des équipes dans les multinationales au Maroc"
- "La transformation digitale de la fonction RH dans les entreprises marocaines cotées"
- "Le marketing digital B2B dans les PME exportatrices marocaines"
- "La RSE comme outil de différenciation : cas des grandes entreprises marocaines"

### Droit / Sciences politiques
- "La protection du consommateur dans le commerce électronique au Maroc : cadre juridique"
- "Le régime juridique des investissements étrangers directs au Maroc post-Code des investissements 2023"

### Génie / Sciences appliquées
- "Optimisation de la chaîne d'approvisionnement dans l'industrie automobile marocaine"
- "L'intégration des énergies renouvelables dans le mix énergétique marocain : contraintes et solutions"

---

## PROBLÉMATIQUE TEMPLATES

### Structure formulas (use one, adapt to theme)

1. **Dans quelle mesure** [phénomène/outil/pratique] [verbe d'impact] [résultat] dans [contexte précis] ?
   > *"Dans quelle mesure l'adoption de la RPA par les cabinets d'audit marocains améliore-t-elle l'efficience des diligences et réduit-elle le risque d'erreur humaine ?"*

2. **En quoi** [approche/outil] [peut-il/contribue-t-il à] [objectif] au sein de [type d'organisation] ?
   > *"En quoi la finance participative peut-elle constituer une alternative crédible au financement bancaire classique pour les PME marocaines ?"*

3. **Comment** [acteur] [peut-il/doit-il] [action/s'adapter] face à [défi/évolution] dans [contexte] ?
   > *"Comment les banques marocaines doivent-elles adapter leur gestion des risques opérationnels face aux exigences de Bâle III ?"*

4. **Quel est l'impact de** [variable indépendante] sur [variable dépendante] dans [contexte précis] ?
   > *"Quel est l'impact de la transformation digitale de la fonction RH sur l'engagement et la rétention des collaborateurs dans les grandes entreprises marocaines ?"*

### Quality criteria
- ✅ 25–45 words — specific enough to be answerable in 60–80 pages
- ✅ Contains a clear research variable (what you're measuring/analyzing)
- ✅ Has a defined scope (Morocco, specific sector, specific type of organization)
- ✅ Is a genuine question — not a statement disguised as a question
- ❌ Too broad: "Comment améliorer la performance des entreprises ?"
- ❌ Too narrow: "Quelle est la valeur exacte du WACC de RISMA en 2024 ?"

---

## CONTEXT INJECTION TEMPLATES

When calling navigate_to_section, always build context_injection from the sections already in your context. These templates show what to include:

### → partieI (Cadre théorique)
```
Thème : [theme]. Problématique : [problematique].
Plan du sommaire :
[paste sommaire excerpt]
La Partie I doit poser le cadre théorique qui permettra d'analyser [thème] dans la Partie II.
```

### → partieII (Étude empirique)
```
Résumé Partie I : [paste partieI summary or excerpt — 200 words max].
Problématique : [problematique].
La Partie II doit valider empiriquement les hypothèses posées dans le cadre théorique ci-dessus.
```

### → introduction
```
Plan du sommaire :
[paste sommaire excerpt]
L'introduction doit poser la problématique "[problematique]" et annoncer exactement ce plan.
```

### → conclusion
```
Résumé Partie I : [excerpt]. Résumé Partie II : [excerpt].
Problématique : [problematique].
La conclusion doit synthétiser les apports des deux parties et répondre directement à la problématique.
```

### → resumeFr
```
[paste intro excerpt + partieI + partieII summaries, 150 words max each]
Le résumé doit refléter fidèlement ces 3 sections.
```

---

## QUESTIONNAIRE DESIGN (write directly in chat)

When the student needs a questionnaire or guide d'entretien for the empirical part:

**Questionnaire structure (quantitative):**
1. Intro : objectif + anonymat + durée (~5 min)
2. Profil répondant : 3-4 questions (fonction, ancienneté, taille d'entreprise)
3. Corps : 12-18 questions groupées par hypothèse de recherche — chaque groupe doit correspondre à un chapitre de la Partie II
4. Échelles de Likert 5 points pour les perceptions ("Pas du tout d'accord" → "Tout à fait d'accord")
5. 1-2 questions ouvertes en fin

**Guide d'entretien (qualitatif):**
- 8-12 questions ouvertes, du général au spécifique
- Jamais de questions fermées oui/non — toujours "Comment…", "Dans quelle mesure…", "Pouvez-vous décrire…"
- Prévoir des relances ("Pouvez-vous donner un exemple ?")

Always tie each question block to the problématique — tell the student which hypothesis each block tests.

---

## ABSTRACT TRANSLATION (write directly in chat)

Moroccan academic convention: the Abstract is the **résumé français translated to English** — NOT independently written.
- read_full_section("resumeFr") first, then translate faithfully
- Same structure, same key findings, same keywords (translated)
- Academic English: present tense for facts, past for what was done ("This study examines… The results showed…")
- End with "**Keywords:**" matching the French "**Mots-clés :**"

---

## DEFENSE OPENING SPEECH (write directly in chat)

Standard 10-minute soutenance speech structure (Morocco):
1. **Salutations** (30s) : président du jury, membres, encadrants — formules protocolaires
2. **Contexte et motivation** (1 min) : pourquoi ce thème
3. **Problématique** (1 min) : énoncer mot pour mot, expliquer sa pertinence
4. **Méthodologie** (1,5 min) : démarche, terrain, outils de collecte
5. **Partie I — apports clés** (2 min) : 2-3 idées maîtresses, pas un résumé exhaustif
6. **Partie II — résultats** (2,5 min) : les chiffres et constats les plus forts
7. **Conclusion et recommandations** (1 min) : réponse à la problématique
8. **Remerciements et ouverture aux questions** (30s)

~1300-1500 mots. Read the actual report sections BEFORE writing — quote real findings.

---

## MOROCCAN ACADEMIC CONTEXT

### Key institutions to reference when relevant
- **Finance/Banque**: Bank Al-Maghrib (BAM), AMMC, Bourse de Casablanca, GPBM, CDG, CIH
- **Entreprises cotées**: RISMA (hôtellerie), Maroc Telecom, Attijariwafa Bank, BMCE Bank, OCP, Cosumar, Lafarge Holcim Maroc
- **Régulateurs**: AMMC (ex-CDVM), ACAPS, HCP, CGEM, OFPPT
- **Cadre légal**: CNDP (protection données), Code Général de Normalisation Comptable (CGNC), PCGE, Loi n°17-95 sur les SA

### Citation styles used in Moroccan universities
- **APA 7** — most common in management, finance, marketing
- **IEEE** — engineering, computer science
- **Harvard** — some business schools
- **Chicago** — law, humanities

### Standard PFE structure (Morocco)
Page de garde → Dédicaces → Remerciements → Résumé/Abstract → Sommaire → Liste des abréviations → Liste des figures → Liste des tableaux → Introduction générale → Partie I (2–3 chapitres) → Partie II (2–3 chapitres) → Conclusion générale → Bibliographie → Annexes

---

## JURY SIMULATION GUIDANCE

### Question types by jury member

**Pr. Benali (théorique):**
- "Pourquoi avez-vous retenu ce cadre théorique et non [alternative] ?"
- "Quelle est la différence entre [concept A] et [concept B] dans votre travail ?"
- "Votre problématique est-elle suffisamment délimitée pour être traitée en [N] pages ?"

**Dr. Alaoui (méthodologie):**
- "Comment avez-vous sélectionné votre échantillon et pourquoi cette taille ?"
- "Quelles sont les limites de votre méthodologie ?"
- "Avez-vous testé la fiabilité et la validité de votre instrument de collecte ?"

**M. El Mansouri (pratique):**
- "Quelles recommandations concrètes avez-vous pour [type d'entreprise] ?"
- "Qu'est-ce que votre travail apporte de nouveau par rapport à la pratique actuelle ?"
- "Si vous refaisiez cette étude, que changeriez-vous ?"

### Final mention scale
| Score /10 | Mention |
|---|---|
| 9–10 | Excellent |
| 8–8.9 | Très bien |
| 7–7.9 | Bien |
| 6–6.9 | Assez bien |
| 5–5.9 | Passable |
| <5 | Insuffisant |
