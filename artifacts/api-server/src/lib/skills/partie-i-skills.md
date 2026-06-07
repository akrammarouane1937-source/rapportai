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

### Exemple 1 — PFE / Mémoire (cadre théorique) — extrait réel

**Contexte :** PFE Finance. Thème : *L'impact des cycles économiques sur les méthodes d'évaluation des entreprises*.

> ⚠️ Cet extrait est un exemple de **niveau, style et structure**. La profondeur, la longueur des sections, la place des figures et la façon de rédiger dépendent entièrement du sujet, de sa complexité et du plan de l'étudiant. Ne reproduis jamais ce contenu — écris depuis le contexte réel de l'étudiant.

---

**Introduction de la Partie I**

Ce rapport s'articule autour de deux concepts fondamentaux : les cycles économiques et les méthodes d'évaluation. Dans la première section, nous nous concentrerons sur les cycles économiques, plus précisément sur leur définition et sur la littérature qui les sous-tend. Dans la deuxième section, nous analyserons les méthodes d'évaluation et présenterons brièvement leur contexte bibliographique.

---

**1.1.1 Les cycles économiques**

*Définition*

Un cycle économique désigne les fluctuations qu'une économie subit au fil du temps. Il se compose de périodes de croissance économique et de prospérité relativement rapides, communément appelées expansion économique, et de périodes d'inactivité relative, de déclin et de dépression, généralement appelées contractions ou récessions (Zarnowitz, 1991). Le terme le plus courant pour décrire une croissance fulgurante du PIB réel est la « phase d'expansion », tandis que lorsqu'il se contracte, on parle de « récession » (Arnold, 2002).

Les cycles économiques sont mesurés par deux composantes : le PIB réel (PIB ajusté de l'inflation) (axe des Y) et le temps (axe des X) (généralement mesuré en années).

*Figure 1 — Cycles économiques. Source : Investopedia.*

Comme le montre le graphique, tous les cycles économiques se caractérisent par plusieurs étapes. Pourtant, au fil du temps, économistes et analystes des cycles économiques ont débattu de ces étapes (Heilemann et Weihs, 2007). Dans ce rapport, nous présenterons brièvement ces étapes :

- **Phase d'expansion :** Il s'agit généralement de la phase la plus longue du cycle économique. À ce stade, les indicateurs macroéconomiques liés à l'emploi, à la demande et à l'offre de biens et services augmentent de manière soutenue. Cette phase se caractérise notamment par une forte vélocité de la masse monétaire et une vague d'investissements.
- **Point de surchauffe (peak) :** Les indicateurs économiques atteignent un niveau de saturation et ne peuvent plus progresser. En raison de l'inflation et de la flambée des prix, les consommateurs commencent à réorganiser leur budget, ce qui entraîne un ralentissement de la demande.
- **Phase de récession :** La demande chute rapidement, les ventes s'effondrent, la production ralentit, et par conséquent, les revenus stagnent ou se détériorent.
- **Phase de dépression :** Sous l'effet du repli de la demande et de l'offre, la croissance économique tombe en dessous de son rythme de croisière. Le chômage augmente, les faillites se multiplient.
- **Point bas (Trough) :** C'est le niveau de saturation négatif pour une économie — tous les indicateurs positifs sont en chute libre.
- **Phase de reprise (Recovery) :** Les prix bas stimulent la demande, ce qui relance la production, l'emploi et l'investissement. Cette phase annonce la fin d'un cycle et le début d'un nouveau.

La théorie autrichienne des cycles économiques (ABCT) est l'une des théories consacrées à l'explication des cycles économiques. Elle met l'accent sur les signaux du marché et la manière dont ils communiquent des informations décentralisées aux entrepreneurs. Elle suppose que les banques centrales faussent ces signaux de prix, conduisant les entrepreneurs à prendre des décisions biaisées concernant leurs investissements — phénomène décrit par l'ABCT comme « mal-investissement ». L'ABCT décrit essentiellement les cycles économiques comme un processus d'apparition de grappes d'erreurs entrepreneuriales aboutissant à des investissements inappropriés (Rothbard, 2000).

---

**1.1.2 Les méthodes de valorisation**

Lors de l'évaluation d'une entreprise, différentes approches sont utilisées par les praticiens du secteur ; le point commun entre toutes ces méthodes est qu'elles se basent sur les caractéristiques financières de l'entreprise avec le même objectif : mettre une étiquette de prix sur cette dernière.

*Figure 2 — Méthodes d'évaluation. Source : CFI, Cours: Business Valuation.*

- **Approche par les coûts (méthode patrimoniale) :** Cette approche considère que seuls comptent les actifs et les passifs de l'entreprise. Elle consiste à agréger l'ensemble des actifs détenus, les réévaluer à leur valeur de marché actuelle, puis soustraire les dettes à leur valeur de marché.
- **Approche par le marché (valeur relative) :** Elle s'appuie sur des données accessibles concernant des entreprises comparables et des transactions antérieures, en utilisant des multiples boursiers tels que : VE/EBITDA, VE/CA, PER (DAMODARAN, 2012).
- **Flux de trésorerie actualisés (DCF) :** L'idée derrière le modèle DCF est que la valeur intrinsèque d'une entreprise est étroitement liée à sa capacité à générer des flux de trésorerie futurs positifs. Les professionnels prévoient les flux de trésorerie non endettés de l'entreprise et utilisent le coût moyen pondéré du capital (CMPC) pour les actualiser (ASQUITH, 2016).

Selon Damodaran (2000), « toutes les valorisations sont biaisées, la seule question est de savoir dans quelle mesure et dans quelle direction. »

---

**1.2.1 Au regard de l'investissement**

La plupart des investisseurs recherchent des informations fiables pour décider s'il convient d'acheter ou de vendre les actions d'une entreprise. Ils sont parfaitement conscients que la performance d'un actif dépend en partie de la position du capital dans le cycle économique. Prenons l'exemple de l'investissement réalisé par Blackstone dans Hilton en 2007 — en pleine dépression économique. Blackstone a établi sa valorisation en sachant qu'au moment où l'économie repartirait, la restructuration de la dette de Hilton serait terminée. En décembre 2013, Hilton a levé 2,3 milliards de dollars lors de son introduction en bourse.

*Figure 4 — Performance sectorielle au cours des différentes étapes du cycle économique. Source : Fidelity (2019).*

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
