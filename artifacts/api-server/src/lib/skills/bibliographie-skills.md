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

## Exemples de références formatées

### APA 7th — le style le plus courant au Maroc

**Livre :**
```
Damodaran, A. (2012). *Investment valuation: Tools and techniques for determining the value of any asset* (3rd ed.). Wiley.

Rothbard, M. N. (2000). *America's great depression* (5th ed.). Ludwig von Mises Institute.
```

**Article de revue :**
```
Zarnowitz, V. (1991). What is a business cycle? *NBER Working Paper*, (3863). https://doi.org/10.3386/w3863

Kokina, J., & Blanchette, S. (2019). Early evidence of digital labor in accounting: Innovation with Robotic Process Automation. *International Journal of Accounting Information Systems*, 35, 100431. https://doi.org/10.1016/j.accinf.2019.100431
```

**Chapitre dans un ouvrage collectif :**
```
Arnold, R. A. (2002). Business cycle theory. In *Macroeconomics* (6th ed., pp. 142–158). South-Western College Publishing.
```

**Rapport institutionnel / webographie :**
```
Fonds Monétaire International. (2025). *World economic outlook: Navigating global divergences*. FMI. Consulté le 15 avril 2025 sur https://www.imf.org/en/Publications/WEO

Haut-Commissariat au Plan. (2025). *Note de conjoncture — T1 2025*. HCP. Consulté le 20 avril 2025 sur https://www.hcp.ma
```

**Thèse / mémoire :**
```
El Ouafa, M. (2024). *L'adoption des technologies d'automatisation dans les cabinets d'audit marocains* [Mémoire de master, ISCAE Casablanca]. [À COMPLÉTER — dépôt institutionnel].
```

---

### IEEE — utilisé en informatique et génie

```
[1] A. Damodaran, *Investment Valuation: Tools and Techniques for Determining the Value of Any Asset*, 3rd ed. Hoboken, NJ: Wiley, 2012.

[2] J. Kokina and S. Blanchette, "Early evidence of digital labor in accounting: Innovation with Robotic Process Automation," *Int. J. Account. Inf. Syst.*, vol. 35, p. 100431, Jun. 2019, doi: 10.1016/j.accinf.2019.100431.

[3] V. Zarnowitz, "What is a business cycle?" NBER, Cambridge, MA, Working Paper 3863, Oct. 1991.
```

---

### Harvard

```
Damodaran, A. (2012) *Investment valuation: Tools and techniques for determining the value of any asset*, 3rd edn. Wiley.

Kokina, J. & Blanchette, S. (2019) 'Early evidence of digital labor in accounting: Innovation with Robotic Process Automation', *International Journal of Accounting Information Systems*, vol. 35, p. 100431.
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
