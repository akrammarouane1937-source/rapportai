---
name: rapportai-bibliographie
description: >
  Base de connaissances pour l'agent Bibliographie : exemples de références formatées
  (APA, IEEE, Harvard, Chicago), règles de résolution des marqueurs [SOURCE], et anti-patterns.
  Lis ce fichier AVANT de compiler la bibliographie.
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - WebFetch
  - WebSearch
---

# RapportAI — Bibliographie : base de connaissances

Ce fichier complète le system prompt. Il contient des exemples de références formatées
correctement, les règles de résolution des `[SOURCE]`, et les erreurs à éviter.

---

## ═══ RÈGLE D'OR ═══

1. **Jamais inventer** un DOI, numéro de volume, numéro de page, ou éditeur — utilise `[À COMPLÉTER]`.
2. **WebSearch avant de marquer** `[À COMPLÉTER]` — tente toujours de trouver la référence complète.
3. **Une seule occurrence** par source — déduplique à travers toutes les sections.
4. **Le style vient de `profile.json`** — ne suppose jamais APA sans vérifier d'abord.
5. La bibliographie est envoyée dans le preview uniquement — seule la confirmation courte va dans le chat.

---

## Exemple 1 — Bibliographie réelle (PFE Finance, style mixte APA) — extrait réel

**Contexte :** PFE Finance. Thème : *L'impact des cycles économiques sur les méthodes d'évaluation des entreprises — cas RISMA*. Style : APA, mélange livres + articles + sources web.

> ⚠️ Cet extrait montre le niveau et le format attendus dans un rapport marocain réel. Il inclut des cas concrets : `s.d.` pour les sources sans date, sources web sans URL complète, et doublons (Damodaran cité deux fois avec des éditions différentes). C'est la réalité du terrain — traite chaque cas correctement.

---

**Ouvrages**

Arnold, L. G. (2002). *Business cycle theory*. OUP Oxford.

Damodaran, A. (2000). *Applied corporate finance*. Wiley.

Damodaran, A. (2012). *Investment valuation: Tools and techniques for determining the value of any asset* (3rd ed.). Wiley.

Phalippou, L. (2017). *Private equity laid bare*. [À COMPLÉTER — éditeur non précisé dans la source].

Rothbard, M. N. (2000). *America's great depression*. Ludwig von Mises Institute.

Zarnowitz, V. (1991). *Business cycles: Theory, history, indicators, and forecasting*. University of Chicago Press.

---

**Articles de revues**

Berrada, R., & Taamouti, A. (2024). Dating the Moroccan business cycle. *African Scientific Journal*. [À COMPLÉTER — volume, numéro, pages].

Damodaran, A. (2009). Ups and downs: Valuing cyclical and commodity companies. *SSRN Electronic Journal*. https://ssrn.com/abstract=[À COMPLÉTER]

Giménez Roche, G. A. (2016). Entrepreneurial ignition of the business cycle: The corporate finance of malinvestment. *The Review of Austrian Economics*, *29*(3), 253–276.

Heilemann, U., & Weihs, H. (2007). Business cycle synchronization in the Euro Area. *Review of International Economics*. [À COMPLÉTER — volume, numéro, pages].

---

**Webographie**

Bourse de Casablanca. (s.d.). *Sociétés cotées — RISMA*. Consulté le [DATE] sur https://www.casablanca-bourse.com

Business Cycle Dating Committee. (2020). *The CEPR and NBER approaches*. Centre for Economic Policy Research. Consulté le [DATE] sur https://cepr.org

Corporate Finance Institute. (s.d.). *Business valuation course*. CFI. Consulté le [DATE] sur https://corporatefinanceinstitute.com

Damodaran, A. (2000). *An introduction to valuation*. NYU Stern. Consulté le [DATE] sur https://pages.stern.nyu.edu/~adamodar/

Fidelity. (2019). *How to invest using the business cycle*. Consulté le [DATE] sur https://www.fidelity.com

Investopedia. (s.d.). *Economic cycle*. Consulté le [DATE] sur https://www.investopedia.com/terms/e/economic-cycle.asp

Investopedia. (s.d.). *EBITDA*. Consulté le [DATE] sur https://www.investopedia.com/terms/e/ebitda.asp

NBER & CEPR. (s.d.). *Chronologies des cycles économiques*. Consulté le [DATE] sur https://www.nber.org/research/business-cycle-dating

RISMA. (s.d.). *Rapports financiers*. Consulté le [DATE] sur https://risma.ma

Statista. (s.d.). *GDP 2025–2030*. Consulté le [DATE] sur https://www.statista.com

---

**Ce que cet exemple montre :**
- `s.d.` = *sans date* — à utiliser quand l'année de publication n'est pas trouvable
- Sources web toujours avec `Consulté le [DATE]` — l'agent doit insérer la date réelle du jour
- Refs partielles (volume, pages manquants) → `[À COMPLÉTER]` — ne pas inventer
- Doublons (Damodaran 2000 book + article separate) → deux entrées distinctes si titres différents
- CFI course = source professionnelle, classe en Webographie même si c'est un cours payant

---

## Exemples de format par style

### APA 7th — rappel format

**Livre :**
```
Damodaran, A. (2012). *Investment valuation: Tools and techniques for determining the value of any asset* (3rd ed.). Wiley.
```

**Article de revue :**
```
Giménez Roche, G. A. (2016). Entrepreneurial ignition of the business cycle. *The Review of Austrian Economics*, *29*(3), 253–276.
```

**Source web :**
```
Investopedia. (s.d.). *Economic cycle*. Consulté le 15 mai 2025 sur https://www.investopedia.com/terms/e/economic-cycle.asp
```

---

### IEEE — utilisé en informatique et génie

```
[1] A. Damodaran, *Investment Valuation: Tools and Techniques for Determining the Value of Any Asset*, 3rd ed. Hoboken, NJ: Wiley, 2012.

[2] G. A. Giménez Roche, "Entrepreneurial ignition of the business cycle: The corporate finance of malinvestment," *Rev. Austrian Econ.*, vol. 29, no. 3, pp. 253–276, 2016.

[3] Investopedia. "Economic Cycle." Accessed: May 15, 2025. [Online]. Available: https://www.investopedia.com/terms/e/economic-cycle.asp
```

---

### Harvard

```
Damodaran, A. (2012) *Investment valuation: Tools and techniques for determining the value of any asset*, 3rd edn. Wiley.

Giménez Roche, G. A. (2016) 'Entrepreneurial ignition of the business cycle', *The Review of Austrian Economics*, vol. 29, no. 3, pp. 253–276.
```

---

## Résolution des marqueurs `[SOURCE]`

Quand une section contient `[SOURCE]`, lis les 2–3 phrases autour pour identifier :
1. Le nom de l'auteur mentionné (souvent dans la phrase)
2. L'année approximative ou le concept cité
3. Le domaine (finance, audit, informatique…)

Puis WebSearch : `"[Nom auteur]" "[concept]" site:scholar.google.com OR site:researchgate.net`

**Exemple :**
> "La RPA peut réduire de 60 à 80 % le temps consacré aux tâches répétitives [SOURCE]"

→ Search : `RPA audit time reduction 60 80 percent site:scholar.google.com`
→ Si trouvé : compléter la référence complète en APA/IEEE
→ Si non trouvé après 2 tentatives : `[À COMPLÉTER — affirmation sur la réduction de temps RPA : rechercher source primaire]`

---

## Classification des sections (APA / Harvard / Chicago)

| Section | Ce qu'elle contient |
|---|---|
| **Ouvrages** | Livres, chapitres de livres, manuels |
| **Articles de revues** | Articles peer-reviewed, working papers, NBER papers |
| **Thèses et mémoires** | PFE, mémoires de master, thèses de doctorat |
| **Webographie** | Sites web, rapports institutionnels, données en ligne — toujours avec date d'accès |

IEEE = liste numérotée unique, aucune classification par type.

---

## Anti-patterns — à éviter absolument

❌ **Inventer un DOI ou un numéro de page** : `doi: 10.xxxx/invented`
   ✅ `[À COMPLÉTER]` pour tout champ non vérifié.

❌ **Webographie sans date d'accès** : `https://www.imf.org/report`
   ✅ Toujours : `Consulté le DD mois AAAA sur https://...`

❌ **Même source en double** si citée dans partie-i ET partie-ii.
   ✅ Dédupliquer — chaque source apparaît une seule fois.

❌ **Streamer la liste complète dans le chat** après sauvegarde.
   ✅ Confirmation courte uniquement : N références, N `[À COMPLÉTER]`.

❌ **Marquer `[À COMPLÉTER]` sans avoir tenté WebSearch**.
   ✅ Toujours chercher d'abord — WebSearch sur titre + auteur + année.

❌ **Mélanger les styles** : APA dans Ouvrages, IEEE dans Articles.
   ✅ Un seul style pour toute la bibliographie — celui de `profile.json`.

---

## Quality checklist (vérifie avant de sauvegarder)

- [ ] `profile.json` lu — style de citation confirmé
- [ ] Tous les fichiers `.md` scannés avec Glob
- [ ] Grep exécuté sur tous les fichiers avec le pattern complet
- [ ] Tous les `[SOURCE]` traités (résolus ou marqués `[À COMPLÉTER]` avec contexte)
- [ ] Aucun DOI, volume, ou page inventé
- [ ] Références dédupliquées — chaque source une seule fois
- [ ] Sources web avec date d'accès `Consulté le DD mois AAAA`
- [ ] Classification correcte (Ouvrages / Articles / Thèses / Webographie pour APA ; liste numérotée pour IEEE)
- [ ] Tri alphabétique (APA/Harvard/Chicago) ou numérique ordre d'apparition (IEEE)
- [ ] Sauvegardé dans `bibliographie.md`
- [ ] Seule la confirmation courte dans le chat (N références, N `[À COMPLÉTER]`)
