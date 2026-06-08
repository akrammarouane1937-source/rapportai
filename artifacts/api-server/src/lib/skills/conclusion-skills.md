---
name: rapportai-conclusion
description: >
  Base de connaissances pour l'agent Conclusion : exemples de référence, anti-patterns,
  et guide de style. Lis ce fichier AVANT de générer la Conclusion Générale.
  Les règles et le format exact sont définis dans le system prompt ; ce fichier montre
  le NIVEAU attendu et comment articuler synthèse, apports, limites et perspectives.
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
---

# RapportAI — Conclusion : base de connaissances

Ce fichier complète le system prompt. Il contient des exemples de prose académique,
les erreurs à éviter, et les critères de qualité.
Inspire-toi du niveau et du style — **n'utilise jamais le contenu domaine de ces exemples**.
Chaque conclusion doit être écrite depuis les résultats réels de l'étudiant : `partie-i.md`, `partie-ii.md`, `student_memory.json`.

---

## ═══ RÈGLE D'OR — la conclusion répond à la problématique, pas à une formule ═══

1. Lis `introduction.md` pour récupérer le libellé exact de la problématique — la conclusion doit y répondre directement.
2. Lis `partie-ii.md` pour extraire chaque résultat d'hypothèse : confirmée / partiellement / infirmée.
3. Lis `partie-i.md` pour nommer le cadre théorique retenu.
4. Ces exemples montrent comment articuler — jamais quoi conclure.
5. La conclusion est générée **en une seule passe** et sauvegardée dans `conclusion.md`. Seule une confirmation courte va dans le chat.
6. **Style** : prose continue par défaut (pas de `###` subheadings) — sauf si le canevas ou le professeur l'impose explicitement.

**Structure imposée par le jury — 5 éléments dans cet ordre :**
1. **Rappel du problème** (ouverture — reformuler la problématique)
2. **Synthèse des principaux résultats** (les plus essentiels — pas tout)
3. **Hypothèses** : confirmées ou non — UNIQUEMENT si approche quantitative
4. **Contributions** (points forts : théoriques + pratiques)
5. **Limites** (être conscient des limites de sa recherche)
6. **Perspectives** (conclusion ouverte : nouveau problème OU pistes futures — ne pas "clore" la recherche)

---

## Exemples de prose académique (bibliothèque de référence)

> ⚠️ Ces extraits sont des exemples de **niveau, style et structure uniquement**. Ne reproduis jamais ce contenu — adapte aux résultats réels de l'étudiant.

---

### Exemple 1 — PFE Finance (conclusion courte, prose continue) — extrait réel

**Contexte :** PFE Finance. Thème : *L'impact des cycles économiques sur les méthodes d'évaluation des entreprises — cas RISMA*. Style : prose continue, ~300 mots, synthèse + apports + perspectives tissés ensemble.

---

Les modèles de valorisation ont toujours intégré divers facteurs afin de générer une valeur d'entreprise la plus proche possible de sa juste valeur. Parmi les méthodes les plus reconnues, le modèle d'actualisation des flux de trésorerie (DCF) constitue le cœur de la démarche adoptée dans cette étude sur le cas de RISMA. L'idée centrale consiste à projeter les flux de trésorerie futurs puis à les ramener à leur valeur actuelle à l'aide des paramètres bien connus que sont le WACC (coût moyen pondéré du capital) et le taux de croissance à l'infini.

Cependant, afin d'obtenir ces flux de trésorerie, le premier indicateur utilisé dans le modèle DCF est généralement l'EBITDA. Cette variable constitue une base intermédiaire à laquelle on ajoute ou retranche certains éléments (CAPEX, variation du BFR, impôts, etc.) afin d'arriver à une estimation fiable du cash-flow opérationnel. De ce fait, il est impératif que l'EBITDA soit traité avec rigueur et ajusté de manière pertinente. Les projections futures de l'EBITDA doivent alors tenir compte de son comportement historique, en particulier de ses réactions face aux cycles économiques passés, qu'il s'agisse de périodes de récession ou d'expansion.

C'est dans cette optique que les deux scénarios développés dans ce rapport ont été construits. Ils utilisent des hypothèses similaires sur les paramètres de valorisation (taux d'actualisation, taux de croissance terminale, structure financière, etc.), à une exception majeure : dans le second scénario, nous avons analysé l'évolution historique de l'EBITDA de RISMA sur une période de six ans, afin d'ajuster les projections futures en tenant compte des fluctuations économiques observées au cours de cette période.

Dans la dernière partie de ce travail, nous avons comparé les deux scénarios et formulé une lecture critique de leurs résultats. L'objectif est de montrer l'importance d'intégrer la dynamique économique dans toute démarche de valorisation rigoureuse. Les résultats montrent à quel point une valorisation peut évoluer de manière significative lorsque l'on introduit une logique cyclique dans le modèle, ce qui amène à s'interroger sur l'influence réelle des cycles économiques dans les processus de valorisation financière.

---

### Exemple 2 — Mémoire Master (conclusion longue, quatre blocs distincts en prose) — extrait réel

**Contexte :** Mémoire Master, expertise comptable et audit. Thème : *La RPA dans l'audit externe du cycle Achats-Fournisseurs*. Style : prose continue, ~600 mots, quatre blocs thématiques clairement articulés mais sans sous-titres `###`.

---

Ce mémoire avait pour ambition d'explorer la contribution de la Robotic Process Automation (RPA) à la modernisation des missions d'audit externe du cycle Achats-Fournisseurs. En articulant une revue de littérature approfondie avec une investigation empirique ancrée dans les réalités d'un cabinet d'expertise comptable et d'audit casablancais, il apporte des réponses concrètes à la question centrale : dans quelle mesure la RPA peut-elle améliorer l'efficacité et la qualité des missions d'audit externe du cycle Achats-Fournisseurs, en termes de planification de la mission, d'évaluation des risques, d'exécution des diligences et de fiabilité des éléments probants collectés ?

Sur le plan théorique, la Partie I a mis en évidence la cohérence profonde entre les exigences des normes ISA — qui imposent des éléments probants suffisants et adéquats (ISA 500), une évaluation rigoureuse des risques d'anomalies significatives (ISA 315), et le maintien permanent du scepticisme professionnel (ISA 200) — et les capacités propres de la RPA : automatisation des diligences répétitives, traitement exhaustif de 100 % des transactions, traçabilité complète des travaux (ISA 230), et possibilité de monitoring continu en cours de mission. La comparaison systématique des technologies disponibles a confirmé que la RPA constitue, à ce stade de maturité technologique, l'option la plus accessible et la plus directement conforme aux exigences normatives de l'audit externe.

Sur le plan empirique, la Partie II a confirmé les quatre hypothèses de recherche. Le diagnostic des pratiques actuelles du Cabinet a mis en lumière trois zones de faiblesse méthodologique réelles — couverture insuffisante du three-way matching (22 % des transactions), circularisation sous-exploitée (47 % de taux de réponse), absence de monitoring continu du cycle en cours de mission — qui correspondent précisément aux domaines d'application prioritaires de la RPA. La simulation conduite sur 1 247 factures réelles a produit des résultats probants : réduction de 86 % du temps de traitement du three-way matching, passage à une couverture exhaustive de 100 % des transactions pour les assertions d'exactitude et d'occurrence, augmentation du taux de réponse à la circularisation de 47 % à 72 %, réduction du risque de non-détection d'une magnitude de 81 %.

Les apports de ce travail se situent à trois niveaux. Sur le plan académique, il contribue à la littérature encore rare sur la RPA dans l'audit externe en langue française, en ancrant la réflexion dans le cadre normatif ISA et les réalités du marché marocain. Sur le plan méthodologique, il propose un cadre original d'évaluation des opportunités d'automatisation des diligences d'audit externe, intégrant les contraintes normatives comme critère de sélection. Sur le plan opérationnel, il fournit aux cabinets d'audit une feuille de route concrète, un cadre de gouvernance des bots adapté aux exigences ISA et une doctrine d'utilisation formalisée pour structurer leur démarche de déploiement.

Les limites inhérentes à l'approche par étude de cas unique — généralisation restreinte, résultats simulés plutôt que produits en mission réelle, évolution rapide du cadre normatif ISA — ouvrent des perspectives de recherche importantes : une étude longitudinale suivant un déploiement effectif de la RPA dans le cadre d'une mission d'audit légal sur 12 à 24 mois, une étude comparative multi-cabinets, et une exploration des synergies entre la RPA et l'intelligence artificielle générative dans les processus d'audit externe.

En définitif, ce mémoire confirme que la RPA n'est pas un simple outil d'efficience, mais un vecteur de transformation de la qualité même de l'audit externe. En libérant les auditeurs des diligences d'exécution répétitives, elle les repositionne dans leur mission fondamentale : l'exercice du jugement professionnel, l'analyse des risques d'anomalies significatives complexes, et la formulation d'une opinion motivée et fiable au service des actionnaires et des tiers. C'est à cette condition — et à celle du maintien absolu du scepticisme professionnel vis-à-vis des outputs automatisés — que la RPA contribuera pleinement à élever la qualité de l'audit externe au XXIe siècle.

---

## Anti-patterns — à éviter absolument

❌ **Introduire de nouveaux arguments ou résultats** non mentionnés dans les parties.
   ✅ La conclusion ne fait que synthétiser — tout ce qu'elle dit doit venir de partie-i.md ou partie-ii.md.

❌ **Répondre vaguement à la problématique** : "Cette étude a montré que le sujet est complexe et mérite d'être approfondi."
   ✅ Réponse directe et spécifique : nommer les résultats, les modèles, les chiffres.

❌ **Formuler les hypothèses sans statut** : ne pas dire si H1, H2, H3 sont confirmées ou infirmées.
   ✅ Chaque hypothèse doit avoir un verdict explicite : "L'hypothèse H1 est confirmée / partiellement validée / infirmée."

❌ **Limites minimisées ou génériques** : "Les données ont quelques limites naturelles."
   ✅ Limites précises : "La période d'analyse (2019–2023) exclut les effets de la crise énergétique post-2023."

❌ **Perspectives vagues** : "Des recherches futures pourraient approfondir ce sujet."
   ✅ Pistes concrètes : type d'étude, terrain, méthode, horizon temporel.

❌ **Clôture molle** : "En conclusion, ce sujet est prometteur et les perspectives sont nombreuses."
   ✅ Dernière phrase = affirmation précise sur où la recherche ou la pratique doit aller.

❌ **Sous-titres `###`** par défaut sans que le canevas le demande.
   ✅ Prose continue par défaut — les quatre blocs sont tissés dans les paragraphes.

❌ **Streamer la conclusion dans le chat** après l'avoir sauvegardée.
   ✅ Envoyer uniquement la confirmation courte dans le chat — le contenu est dans le preview.

---

## ═══ RAPPEL FINAL ═══

La conclusion ne résume pas le plan — elle répond à la problématique. Tout le contenu vient TOUJOURS :
- de la problématique exacte dans `introduction.md`,
- des résultats des hypothèses dans `partie-ii.md`,
- du cadre théorique retenu dans `partie-i.md`.

---

## Quality checklist (vérifie avant de sauvegarder)

- [ ] `introduction.md` lu — libellé exact de la problématique extrait
- [ ] `student_memory.json` lu — hypothèses et leurs directions notées
- [ ] `partie-i.md` lu — cadre théorique principal identifié
- [ ] `partie-ii.md` lu — résultats des hypothèses + 3–4 trouvailles clés extraits
- [ ] **Rappel du problème** en ouverture (40–60 mots)
- [ ] **Synthèse des résultats** : les plus essentiels uniquement (120–180 mots)
- [ ] **Hypothèses** : verdict explicite pour chaque H — SEULEMENT si approche quantitative
- [ ] **Contributions** : théoriques + pratiques + ancrage marocain si pertinent (80–120 mots)
- [ ] **Limites** : spécifiques, pas minimisées (60–90 mots)
- [ ] **Perspectives** : conclusion ouverte — nouveau problème OU pistes (3–4 concrètes, 80–120 mots)
- [ ] Total : 500–700 mots
- [ ] Prose continue par défaut — `###` subheadings seulement si canevas l'impose
- [ ] Aucun argument nouveau non mentionné dans les parties
- [ ] Dernière phrase = affirmation précise, pas vague
- [ ] Sauvegardé dans `conclusion.md`
- [ ] Seule une confirmation courte envoyée dans le chat
