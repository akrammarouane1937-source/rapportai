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

**Deux styles valides existent :**
- **Style prose continue** (Exemple 1) : aucun sous-titre dans l'introduction — c'est le format par défaut.
- **Style structuré numéroté** (Exemple 2) : sous-titres numérotés à l'intérieur de l'introduction — utilise ce format UNIQUEMENT si le canevas de l'étudiant ou son professeur l'impose explicitement. Sinon, toujours préférer la prose continue.

---

### Exemple 1 — PFE Finance (prose continue, style standard) — extrait réel

**Contexte :** PFE Finance. Thème : *L'impact des cycles économiques sur les méthodes d'évaluation des entreprises*. Style : prose continue, zéro sous-titre, questions ✓ en fin de problématique.

---

La formule utilisée pour calculer le PIB, qui est la somme de la valeur ajoutée des entreprises d'une économie, démontre clairement que chaque entreprise contribue à l'économie, tout en étant elle-même soumise à ses dynamiques. En effet, les cycles économiques sont mesurés par la croissance du PIB, ce qui implique automatiquement que les entreprises représentent un canal de transmission des forces et des faiblesses d'une économie. Les entreprises ont contribué à façonner les cycles économiques du passé et subissent constamment les répercussions des fluctuations économiques. Il est intéressant de noter qu'elles continueront de le faire et de subir l'impact des fluctuations économiques.

Par conséquent, l'évaluation d'une entreprise ne doit pas être réalisée indépendamment de l'évolution de son économie sous-jacente. Autrement dit, les paramètres choisis dans un modèle d'évaluation doivent être déduits de manière à tenir compte du fait que les chiffres pourraient raisonnablement être gonflés ou aplatis par la conjoncture économique. L'une des méthodes d'évaluation les plus répandues est le modèle DCF. Cette approche facilite l'estimation de la juste valeur d'une entreprise par les professionnels et les aide ainsi à formuler un jugement logique sur la valeur d'une action (achat ou vente). Le modèle DCF, comme son nom l'indique, repose sur des projections de flux de trésorerie, généralement sur une période de cinq ans. Et qui dit futur dit passé. Cela implique que les estimations doivent plus ou moins se baser sur les données historiques de l'entreprise concernée. Il faut également considérer le bêta, le WACC, ainsi que le taux de croissance à l'infini, un paramètre difficile à estimer. Les flux de trésorerie, comme nous le verrons plus loin dans ce rapport, sont principalement basés sur l'EBITDA. Les professionnels de la finance d'entreprise doivent estimer cet indicateur pour les cinq années à venir, puis soustraire et ajouter d'autres indicateurs selon un processus en cascade afin d'obtenir les flux de trésorerie disponibles pour l'entreprise (FCFF). Autrement dit, les prévisions d'EBITDA, point de départ du modèle DCF, ont des répercussions sur l'ensemble du processus, et plus on avance dans le processus, plus ces répercussions s'accentuent, ce qui entraîne une forte volatilité du résultat final. Par conséquent, le résultat, qui est fondamentalement la valeur d'entreprise, sera profondément modifié.

Ce rapport souligne que des erreurs d'évaluation peuvent survenir si l'on choisit d'ignorer complètement la situation du cycle économique et la réaction de certains indicateurs, dans notre cas principalement l'EBITDA. Cela pourrait conduire à des prévisions biaisées et, in fine, à des jugements irrationnels.

Dès lors, il est essentiel d'étudier la performance historique de l'entreprise par rapport aux phases du cycle économique, et d'analyser la réaction de l'EBITDA aux fluctuations du PIB, afin d'élaborer des prévisions qui tiennent compte de sa sensibilité aux fluctuations économiques.

Le but est de répondre aux questions suivantes :

✓ Comment les cycles économiques peuvent-ils impacter un modèle de valorisation ?
✓ Comment capturer cet impact dans un modèle DCF ?

---

### Exemple 2 — Mémoire Master (introduction structurée et numérotée) — extrait réel

**Contexte :** Mémoire Master, expertise comptable et audit. Thème : *La Robotic Process Automation (RPA) dans l'audit externe du cycle Achats-Fournisseurs*. Style : sous-titres numérotés à l'intérieur de l'introduction — imposé par le canevas de l'école.

> ⚠️ Ce style structuré avec numéros n'est PAS le format par défaut. Utilise-le uniquement si le canevas de l'étudiant ou son professeur l'impose. Pour tout autre cas, utilise la prose continue (Exemple 1).

---

**1. Cadre général : la transformation digitale comme rupture pour les cabinets d'audit**

Le début du XXIe siècle est marqué par une accélération sans précédent des innovations technologiques. La diffusion des systèmes ERP (Enterprise Resource Planning), la dématérialisation des flux documentaires et, plus récemment, l'émergence de l'intelligence artificielle, du cloud computing et de l'automatisation robotisée transforment en profondeur les modèles opérationnels de toutes les organisations, y compris les cabinets d'expertise comptable et d'audit. Selon Daidj, Bordeaux et Neyrial (2023), ces innovations constituent un point d'inflexion stratégique majeur pour la profession comptable et d'audit. Les cabinets des Big Four — Deloitte, PwC, EY, KPMG — mais aussi des réseaux de taille intermédiaire tels que Mazars ou Grant Thornton, ont d'ores et déjà intégré ces technologies dans leurs stratégies d'innovation, créant des laboratoires dédiés et des centres d'excellence pour développer ce qu'il est désormais convenu d'appeler l'audit augmenté.

Dans ce contexte, la Robotic Process Automation (RPA), définie comme une technologie permettant à des logiciels agents (bots) de reproduire les actions humaines réalisées sur des interfaces numériques pour exécuter des processus répétitifs, structurés et à haut volume, s'impose comme l'une des innovations les plus accessibles et les plus immédiatement déployables au sein des fonctions d'audit externe. Contrairement à l'intelligence artificielle générative qui requiert des données massives et des infrastructures sophistiquées, la RPA peut être déployée sur des processus existants sans modification des systèmes sous-jacents (Kokina & Blanchette, 2019), ce qui en fait un levier d'automatisation particulièrement adapté aux cabinets d'audit en phase de modernisation.

Pour les auditeurs externes, la pression à la modernisation s'inscrit dans un cadre encore plus structurant : les évolutions successives des normes ISA (International Standards on Auditing), publiées par l'IAASB (International Auditing and Assurance Standards Board), poussent la profession à adopter des méthodes plus rigoureuses, fondées sur les risques, et à tirer parti des technologies disponibles pour renforcer la qualité de leurs opinions sur les états financiers.

**2. Cadre spécifique : le cycle Achats-Fournisseurs, terrain prioritaire de l'audit externe**

Parmi les cycles opérationnels de l'entreprise, le cycle Achats-Fournisseurs (Purchase-to-Pay, P2P) occupe une place centrale dans les préoccupations de l'auditeur externe. Ce cycle, qui s'étend du référencement des fournisseurs jusqu'au règlement des factures, concentre une proportion significative des décaissements de l'entité auditée — certaines études estiment que 60 à 80 % des dépenses opérationnelles transitent par ce cycle — et impacte directement plusieurs postes clés des états financiers : achats, dettes fournisseurs, charges à payer, stocks.

L'auditeur externe doit, conformément aux normes ISA 315 et ISA 330, évaluer les risques d'anomalies significatives inhérents au cycle et concevoir des procédures d'audit adaptées pour les réduire à un niveau acceptable. Or, les caractéristiques transactionnelles du cycle — volume élevé, répétitivité des opérations, règles de traitement codifiées — génèrent à la fois des risques multiples (fraude aux faux fournisseurs, doublons de factures, erreurs de rapprochement, manipulations comptables) et des opportunités réelles d'automatisation des diligences d'audit.

Des études récentes (Moffitt, Rozario & Vasarhelyi, 2018 ; Huang, 2019 ; Eulerich, Waddoups & Wood, 2022) démontrent que l'automatisation de certaines procédures d'audit du cycle achats permet non seulement de réduire les coûts de la mission mais également d'améliorer significativement la qualité et l'exhaustivité des éléments probants collectés. Dans le contexte marocain, si la transformation digitale des entreprises progresse, l'adoption de technologies avancées dans les cabinets d'expertise comptable et d'audit reste encore limitée (Ouhoud & El Ouafa, 2025).

**3. Intérêt de la recherche**

Sur le plan académique, ce mémoire contribue à la littérature encore émergente sur la RPA dans l'audit externe, en adoptant une perspective francophone et en articulant les cadres théoriques disponibles (normes ISA, COSO 2013, approche par les risques) avec les réalités empiriques du marché marocain. Sur le plan managérial, les résultats fournissent aux associés de cabinets d'audit et aux managers de mission des éléments de décision concrets pour évaluer le potentiel de la RPA dans leurs pratiques professionnelles.

**4. Problématique centrale**

Face à l'accélération de la transformation digitale et aux nouvelles exigences des normes internationales d'audit, la question centrale de cette recherche est la suivante :

Dans quelle mesure la Robotic Process Automation (RPA) peut-elle améliorer l'efficacité et la qualité des missions d'audit externe appliquées au cycle Achats-Fournisseurs, en termes de planification de la mission, d'évaluation des risques, d'exécution des diligences et de fiabilité des éléments probants collectés ?

**5. Questions subsidiaires**

Cette problématique centrale se décline en quatre questions de recherche :

Q1 : Quelles procédures d'audit externe du cycle Achats-Fournisseurs présentent le plus fort potentiel d'automatisation par la RPA, dans le respect des normes ISA ?
Q2 : Dans quelle mesure l'implémentation de la RPA améliore-t-elle la couverture des assertions d'audit et réduit-elle le risque de non-détection des anomalies significatives ?
Q3 : Quels risques spécifiques la RPA introduit-elle dans la mission d'audit externe, et quels contrôles compensatoires permettent de maintenir la qualité et l'indépendance requises par les normes ISA ?
Q4 : Quels sont les facteurs organisationnels et techniques conditionnant le succès du déploiement de la RPA dans un cabinet d'expertise comptable et d'audit marocain ?

**6. Hypothèses de recherche**

H1 : Les procédures d'audit externe répétitives et à fort volume du cycle Achats-Fournisseurs (rapprochement de factures, circularisation des fournisseurs, vérification du référentiel tiers, tests de contrôle sur les autorisations) sont les plus favorables à l'automatisation par la RPA, dans le respect des diligences requises par les normes ISA.
H2 : L'implémentation de la RPA améliore significativement la couverture des assertions d'audit en permettant une analyse exhaustive de l'ensemble des transactions, là où l'audit traditionnel procède par sondage limité.
H3 : La RPA introduit de nouveaux risques dans la mission d'audit externe (gouvernance des bots, dépendance aux données structurées, biais d'automatisation) qui nécessitent la mise en place d'un cadre de gouvernance dédié.
H4 : Le succès du déploiement de la RPA est conditionné par l'alignement stratégique des associés, la disponibilité de compétences hybrides (audit + IT), la qualité des données sources et la compatibilité avec les exigences d'indépendance et de scepticisme professionnel des normes ISA.

**7. Méthodologie**

Cette recherche adopte une démarche combinant : une approche descriptive pour cartographier les processus du cycle Achats-Fournisseurs et les procédures d'audit externe qui s'y appliquent ; une approche analytique pour examiner les liens entre automatisation RPA, qualité des éléments probants et couverture des assertions d'audit, en mobilisant le cadre normatif ISA (ISA 315, ISA 330, ISA 500, ISA 505, ISA 520, ISA 530) et le référentiel COSO 2013 ; une approche qualitative fondée sur une étude de cas unique et des entretiens semi-directifs menés auprès d'auditeurs externes et d'associés de cabinet.

**8. Structure du mémoire**

Ce mémoire est organisé en deux parties complémentaires. La première partie est consacrée aux fondements théoriques et à la revue de littérature : le premier chapitre retrace le cadre normatif de l'audit externe et présente la RPA comme outil au service des missions d'audit externe ; le second chapitre opère un zoom sur le cycle Achats-Fournisseurs, en cartographiant ses sous-processus, les assertions d'audit qui s'y attachent et les opportunités concrètes d'automatisation. La seconde partie présente l'étude empirique : le premier chapitre expose le cadre méthodologique et décrit la conception d'une solution RPA intégrée dans la méthodologie de mission ; le second chapitre analyse les résultats des entretiens semi-directifs conduits auprès de professionnels de l'audit et formule des recommandations pratiques.

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
