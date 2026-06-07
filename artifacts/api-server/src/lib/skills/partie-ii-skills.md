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

### Exemple 1 — PFE Finance (étude de cas, valorisation DCF) — extrait réel

**Contexte :** PFE Finance. Thème : *L'impact des cycles économiques sur les méthodes d'évaluation des entreprises — cas RISMA*. Partie II = cadre pratique, deux scénarios DCF.

> ⚠️ Cet extrait est un exemple de **niveau, style et structure**. La profondeur, la longueur, la place des figures, le nombre de scénarios dépendent entièrement du sujet et du plan de l'étudiant. Ne reproduis jamais ce contenu — écris depuis le contexte réel de l'étudiant.

---

**Introduction de la Partie II**

Dans le cadre de cette étude de cas, le travail a consisté à la valorisation de RISMA, le 1er groupe hôtelier marocain, grâce au modèle DCF (Discounted Cash-Flow), en ayant mis en place deux scénarios pour pouvoir établir la valeur d'entreprise (EV) et comprendre comment elle évolue en fonction de la sensibilité du taux de croissance de l'EBITDA vis-à-vis des différents cycles économiques passés.

Les scénarios retenus reposent sur un ensemble d'hypothèses et d'une méthodologie que nous avons jugés pertinents pour projeter l'EBITDA de l'entreprise et, in fine, calculer la valeur d'entreprise. Tout investisseur se doit de répondre à une question évidente : acheter ou vendre l'action d'une entreprise ? La valorisation rigoureuse aide à mieux répondre à cette question qui pourra révéler si l'action est sous-évaluée ou surévaluée.

---

**2.1 L'organisme d'accueil**

*Figure 5 — Logo UCM. Source : site officiel Upline Capital Management.*

Upline Capital Management, qu'on appelle souvent UCM, est une société de gestion d'actifs marocaine qui existe depuis 1999. Elle appartient à 100 % au Groupe Banque Populaire, via sa filiale Banque d'Affaires Upline Group, qui a vu le jour en 1992. Ce Upline Group constitue le bras armé du Groupe Banque Populaire dans tout ce qui touche à la banque d'investissement. Il est structuré autour de plusieurs pôles : conseil et ingénierie financière, gestion d'actifs, intermédiation boursière, bourse en ligne, capital-investissement et courtage en assurance.

Pour ce qui est d'UCM plus spécifiquement, cette société est spécialisée dans la gestion des fonds d'investissement, qu'il s'agisse de clients de la banque, d'institutionnels ou de clients privés. Grâce à une expertise éprouvée dans la gestion d'actifs, elle propose une large gamme de solutions pensées pour s'adapter aux objectifs et aux exigences de chaque client. La gestion des risques reste un pilier de l'organisation, intégrée directement dans ses processus à travers un contrôle à trois niveaux, ce qui garantit aux clients une vraie sécurité et transparence.

---

**2.2.1 Données et méthodologie**

*Figure 6 — Logo RISMA. Source : site officiel RISMA.*

Nous avons opté pour RISMA pour réaliser cette étude de valorisation car l'entreprise réunit plusieurs critères offrant un bon cas d'analyse. RISMA est le groupe hôtelier marocain numéro 1, propriétaire et exploitant de 23 établissements sur l'ensemble du territoire, gérés sous contrat avec de grandes marques internationales (Accor, Sofitel, Ibis). En tant que société cotée à la Bourse de Casablanca, ses états financiers et rapports annuels sont publics depuis plus de dix ans. Par ailleurs, le secteur de l'hôtellerie est très cyclique — très sensible aux conjonctures économiques, aux flux touristiques et aux événements géopolitiques — ce qui permet d'étudier comment l'EBITDA de RISMA s'est historiquement adapté aux phases des cycles économiques.

**Chiffres clés 2024 :**

| Indicateur | Valeur | Variation |
|---|---|---|
| Chiffre d'affaires | MAD 1 264m | +8% vs 2023 |
| EBITDA | MAD 461m (36% du CA) | +11% vs 2023 |
| Taux d'occupation | 59% | +2 pts vs 2023 |
| Dette nette | MAD 1 086m | -18% vs 2023 |
| RNPG | MAD 183m | +33% vs 2023 |

*Figure X — Chiffres clés RISMA 2024. Source : rapport financier annuel 2024.*

Les résultats financiers de RISMA pour l'année 2024 témoignent d'une amélioration significative de sa performance. Le chiffre d'affaires atteint 1 264 millions de dirhams, en hausse de 8 %, traduisant une dynamique positive soutenue par la reprise du tourisme. L'EBITDA progresse de 11 %, révélant une amélioration de la rentabilité opérationnelle plus rapide que la croissance des revenus — signe d'une meilleure maîtrise des charges d'exploitation.

La méthode retenue dans le premier scénario suit les étapes suivantes :

*Figure 8 — Étapes du premier scénario DCF. Source : auteur.*

Pour reconstituer le chiffre d'affaires de manière aussi réaliste que possible, nous nous sommes appuyés sur les sites de réservation en ligne, hôtel par hôtel, en relevant les prix affichés mois par mois pour identifier les périodes de haute et de basse saison. La formule appliquée est la suivante :

**CA = ((PrixBas × 30 × MoisBas × Chambres) + (PrixHaut × 30 × MoisHaut × Chambres)) × TauxOccupation**

Pour vérifier la cohérence de cette approche, un test simple a été réalisé : en élevant le taux d'occupation de 2 points et les prix de 5 % sur le CA 2023, on obtient une hausse de 8 % — exactement la progression enregistrée par RISMA en 2024. Ce résultat valide la robustesse de la méthode de reconstitution.

---

**2.2.2 Résultats du modèle — hors plan d'expansion**

*Figure 12 — Résultat DCF premier scénario. Source : fichier Excel.*

Le modèle DCF présenté permet d'estimer la valeur actuelle des flux de trésorerie futurs générés par le périmètre actuel d'activité de RISMA. Il s'appuie sur un taux de croissance terminal de 2 % et un WACC de 8,325 %, calculé à partir d'un coût des fonds propres de 11,09 %, d'un coût de la dette de 4 %, et d'une structure de capital composée à 61 % de capitaux propres et 39 % de dette.

Sur la période de projection 2025–2030, les flux de trésorerie disponibles non endettés varient entre 259 et 528 millions MAD. Après actualisation, la valeur actuelle nette des flux projetés atteint 1 724 millions MAD, tandis que la valeur terminale actualisée est estimée à 5 274 millions MAD. L'ensemble conduit à une EV de 6 998 millions MAD. En soustrayant la dette nette de 1 086 millions MAD, on obtient une valeur des fonds propres de 5 912 millions MAD, soit une valeur par action de 410,27 MAD contre un cours boursier de 300,6 MAD — un potentiel de revalorisation implicite de +34,87 %.

---

**2.3.1 Données et méthodologie — scénario 2 (EBITDA corrigé des cycles)**

Dans ce scénario, nous introduisons des ajustements visant à intégrer l'impact des cycles économiques dans la projection de l'EBITDA. La première étape consiste à identifier la chronologie des cycles pour chaque région, en s'appuyant sur une recherche publiée dans l'*African Scientific Journal* (Dating the Moroccan Business Cycle, 2024).

Les taux de croissance moyens de l'EBITDA de RISMA par phase de cycle révèlent :
- **Phase d'expansion** : croissance moyenne pondérée de **+9,37 %**
- **Phase de récession** : croissance moyenne pondérée de **-14,37 %**

Les projections macroéconomiques du FMI (croissance de 3,9 % en 2025, 3,7 % en 2026) et les données du HCP (croissance de 4,2 % au T1 2025) permettent de qualifier la période 2025–2030 de phase d'expansion. En conséquence, le taux de croissance retenu pour la projection de l'EBITDA est de **9,37 %** — taux moyen observé lors des précédentes phases d'expansion.

---

**2.3.2 Résultats de l'ajustement**

| KmAD | 2024 | 2025 | 2026 | 2027 | 2028 | 2029 | 2030 |
|---|---|---|---|---|---|---|---|
| EBITDA | 461 000 | 504 196 | 551 439 | 603 109 | 659 620 | 721 426 | 789 024 |
| Taux de croissance | — | 9,37% | 9,37% | 9,37% | 9,37% | 9,37% | 9,37% |

*Tableau 5 — Projection d'EBITDA RISMA 2025–2030. Source : fichier Excel.*

La valeur d'entreprise s'élève à 7 588 millions MAD. En soustrayant la dette nette de 1 086 millions MAD, on obtient une valeur des fonds propres de 6 503 millions MAD, soit une valeur estimée par action de **453,87 MAD** — un potentiel de revalorisation de **+48,32 %** par rapport au cours actuel de 306 MAD.

La comparaison des deux scénarios montre que l'intégration des cycles économiques conduit à une valorisation supérieure (+43,60 MAD par action), confirmant l'hypothèse centrale du rapport : ignorer la dynamique cyclique sous-estime la valeur intrinsèque de l'entreprise en phase d'expansion.

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
