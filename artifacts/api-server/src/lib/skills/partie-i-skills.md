---
name: rapportai-partie-i
description: >
  Generates Partie I of the report — adaptive to report type: theoretical framework for PFE/mémoire,
  host organisation presentation for stage/PFA. Reads sommaire.md to extract the exact Partie I
  structure. Generates content section by section (default) or in full mode. Crops relevant figures
  from uploaded PDFs using PIL. Trigger when section is "partie-i" or when the student requests
  "rédiger la partie I", "écrire la partie 1", "cadre théorique", "présentation de l'entreprise".
  Requires sommaire.md to exist — errors immediately if missing.
  Do NOT use for Partie II — that is a separate agent.
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

# Partie I Agent — Skills & Examples

This file provides worked examples of what good Partie I output looks like.
All rules, steps, and structure are in `partie-i-system.md` — do not repeat them here.

---

## Example 0 — Section-by-section approval flow

This is the default conversation pattern. Never generate the full Partie I in one shot unless the student asks.

**Agent after writing Section 1.1:**
> ✅ **Section 1.1 — Le risque de marché : définitions et cadre conceptuel** rédigée (~650 mots).
> Souhaitez-vous continuer avec **1.2 — Les instruments de mesure du risque**, modifier quelque chose dans cette section, ou passer directement à un autre chapitre ?

**Student:** "Continue."

**Agent writes 1.2, then:**
> ✅ **Section 1.2 — Les instruments de mesure du risque** rédigée (~700 mots).
> Souhaitez-vous continuer avec **1.3 — Le cadre réglementaire marocain (AMMC)**, ou ajuster quelque chose ?

**Student:** "Génère tout le reste sans t'arrêter."

**Agent:** switches to full mode, generates all remaining sections sequentially without stopping.

---

## Example 1 — PFE/Mémoire (cadre théorique)

**Context:** PFE Finance, ENCG Casablanca. Theme: *La gestion des risques dans les OPCVM marocains*. Section 1.1 — *Le risque de marché : définitions et cadre conceptuel*. Citation style: APA. No uploaded figures.

**Output:**

### 1.1 Le risque de marché : définitions et cadre conceptuel

Le risque de marché désigne la probabilité de subir des pertes financières résultant de variations défavorables des prix d'actifs cotés — cours boursiers, taux d'intérêt, taux de change ou prix des matières premières. Pour les organismes de placement collectif en valeurs mobilières (OPCVM), ce risque constitue la principale source d'exposition, dans la mesure où leurs portefeuilles sont directement valorisés aux prix de marché selon le principe de la valeur liquidative quotidienne.

La littérature financière distingue classiquement deux composantes du risque de marché. Le risque systématique, ou risque non diversifiable, reflète les fluctuations générales de l'économie — cycles conjoncturels, décisions de politique monétaire, chocs géopolitiques — auxquelles aucun portefeuille diversifié ne peut totalement se soustraire (Sharpe, 1964 ; Fama & French, 1993). Le risque spécifique, à l'inverse, est propre à un émetteur ou à un secteur et peut être atténué par la diversification. Cette distinction est au cœur de la théorie moderne du portefeuille (Markowitz, 1952), qui démontre que seul le risque systématique est rémunéré par le marché.

Dans le contexte marocain, la Bourse de Casablanca présente des caractéristiques structurelles qui amplifient certaines dimensions du risque de marché. La concentration sectorielle — les valeurs bancaires et les télécommunications représentant historiquement plus de 40 % de la capitalisation du MASI — limite la diversification effective des portefeuilles domestiques (AMMC, 2023). La faible liquidité de plusieurs compartiments accroît par ailleurs la volatilité implicite et le risque de liquidité de marché, deux dimensions que l'Autorité Marocaine du Marché des Capitaux intègre désormais dans son cadre de surveillance prudentielle.

La mesure du risque de marché a connu une évolution méthodologique majeure depuis les années 1990. La Value-at-Risk (VaR), popularisée par RiskMetrics (J.P. Morgan, 1994), permet d'estimer la perte maximale probable sur un horizon et à un seuil de confiance donnés. Malgré sa large adoption réglementaire — Bâle II puis Bâle III l'imposent aux établissements de crédit —, la VaR a montré ses limites lors de la crise de 2008 en sous-estimant les événements de queue de distribution (Taleb, 2007). La Expected Shortfall (ES), ou CVaR, a depuis été recommandée par le Comité de Bâle comme mesure complémentaire, car elle capture la sévérité des pertes au-delà du seuil de la VaR.

Ces cadres conceptuels sont directement pertinents pour la problématique de ce rapport : évaluer dans quelle mesure les OPCVM marocains disposent des outils et des processus nécessaires pour identifier, mesurer et piloter leur exposition au risque de marché conformément aux exigences réglementaires de l'AMMC.

*Figure 1.1 — Décomposition du risque total en risque systématique et risque spécifique. Source : Sharpe (1964), adapté.*

---

## Example 2 — Rapport de stage / PFA (présentation de l'organisme)

**Context:** Rapport de stage, EST Salé. Entreprise: *Attijariwafa Bank — Direction Gestion des Risques*. Section 1.2 — *Organisation et activités de la Direction Gestion des Risques*. Citation style: APA.

**Output:**

### 1.2 Organisation et activités de la Direction Gestion des Risques

La Direction Gestion des Risques (DGR) d'Attijariwafa Bank constitue l'une des fonctions de contrôle de second niveau du groupe, conformément au dispositif des trois lignes de défense préconisé par le Comité de Bâle et transposé dans la réglementation bancaire marocaine par Bank Al-Maghrib (Circulaire n° 4/W/2014). Elle est rattachée directement à la Direction Générale et entretient un reporting fonctionnel avec le Comité des Risques du Conseil d'Administration, garantissant son indépendance vis-à-vis des lignes métiers.

Sur le plan organisationnel, la DGR se structure autour de quatre pôles spécialisés : le pôle risques de crédit, le pôle risques de marché et de liquidité, le pôle risques opérationnels, et le pôle conformité et contrôle permanent. Cette segmentation reflète la taxonomie des risques bancaires définie par Bâle III et permet une expertise méthodologique approfondie dans chacun de ces domaines. L'effectif de la direction, estimé à une cinquantaine de collaborateurs au siège casablancais, est complété par des correspondants risques déployés dans les filiales africaines du groupe.

Les missions de la DGR couvrent l'ensemble du cycle de vie du risque : identification, évaluation, surveillance, reporting et atténuation. Dans le périmètre du risque de crédit — qui représente la part la plus importante des fonds propres réglementaires alloués —, la direction est responsable de la validation des modèles de notation interne (IRB), du suivi des grands risques et des concentrations sectorielles, ainsi que du calcul des provisions collectives sous IFRS 9. Pour le risque de marché, elle assure le calcul quotidien de la VaR du portefeuille de négociation et produit un rapport de limite hebdomadaire à destination du Comité ALM.

Mon stage au sein du pôle risques de marché m'a permis d'observer ces processus de l'intérieur, notamment la chaîne de traitement des données de marché (Bloomberg → système de calcul interne → tableau de bord risques) et les interactions entre la DGR et les équipes de la salle des marchés lors des dépassements de limites. Cette immersion constitue le socle empirique de la partie analytique de ce rapport.

*Figure 1.2 — Organigramme simplifié de la Direction Gestion des Risques, Attijariwafa Bank. Source : document interne, stage 2024.*

---

## Edge cases to watch

**WebSearch triggered (no uploaded documents):** When no `.txt` files exist, run WebSearch before writing. Query pattern: `"[concept clé] [filière] Morocco OR Maroc filetype:pdf site:cairn.info OR site:persee.fr"`. Synthesize — never copy verbatim. Mark unverifiable citations `[SOURCE]`.

**Page mode:** Return only the prose content for the requested page. No headers, no metadata. Clean paragraph breaks at start and end.

**Surgical edit:** If `partie-i.md` already exists and the student asks to rework one section — use `Read` to locate the passage, then `Edit` for that passage only. Never `Write` the full file unless a full regeneration is explicitly requested.
