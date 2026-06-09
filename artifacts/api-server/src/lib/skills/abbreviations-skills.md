---
name: rapportai-abbreviations
description: >
  Base de connaissances pour l'agent Abréviations : règles d'extraction,
  ordre de résolution (texte → WebSearch → [À COMPLÉTER]), et format de sortie JSON.
  Lis ce fichier AVANT d'extraire les abréviations.
allowed-tools:
  - Read
  - Write
  - Glob
  - WebSearch
  - WebFetch
---

# RapportAI — Abréviations : base de connaissances

Cet agent est domaine-agnostique. Il fonctionne pour tous les étudiants :
médecine, droit, informatique, finance, génie civil, agronomie, etc.
Il n'y a pas de liste statique de sigles — l'agent extrait du texte et cherche en ligne.

---

## ═══ RÈGLE D'OR ═══

1. **Texte d'abord** — si la définition est dans le rapport, extrais-la directement.
2. **WebSearch avant d'abandonner** — cherche toujours avant de mettre `[À COMPLÉTER]`.
3. **JSON uniquement** — la sortie doit être un tableau JSON valide, rien d'autre.
4. **Déduplique** — chaque sigle une seule occurrence.
5. **Ordre alphabétique** par `abbr`.
6. **2 lettres minimum** — exclure les abréviations standard (p., n°, vol., cf., etc.).

---

## Ordre de résolution pour chaque sigle

### Étape 1 — Chercher dans le texte

Le texte introduit souvent les acronymes explicitement :

```
"la Robotic Process Automation (RPA)…"          → RPA = Robotic Process Automation
"RPA (Robotic Process Automation)…"             → même résultat
"HTA (Hypertension Artérielle)…"                → HTA = Hypertension Artérielle
"l'Intelligence Artificielle (IA)…"             → IA = Intelligence Artificielle
"le Bureau International du Travail (BIT)…"     → BIT = Bureau International du Travail
```

Si trouvé dans le texte → utiliser cette définition directement, sans chercher en ligne.

### Étape 2 — WebSearch si absent du texte

Si l'acronyme apparaît sans définition explicite, faire une recherche :

```
WebSearch("RPA signification")              → Robotic Process Automation
WebSearch("HTA définition médicale")        → Hypertension Artérielle
WebSearch("IRC insuffisance rénale")        → Insuffisance Rénale Chronique
WebSearch("OHADA droit des affaires")       → Organisation pour l'Harmonisation en Afrique du Droit des Affaires
WebSearch("MASI bourse Maroc")              → Moroccan All Shares Index
WebSearch("PCM génie chimique")             → Procédé de Changement de Matière / Process Control Module
```

Adapter la recherche au domaine du rapport (lu depuis `profile.json` → `filiere` ou `theme`).

### Étape 3 — [À COMPLÉTER] uniquement si WebSearch échoue

Après 1 tentative de recherche sans résultat clair → `"[À COMPLÉTER]"`.

---

## Ce qu'il faut extraire

**Inclure :**
- Acronymes en majuscules de 2+ lettres : `RPA`, `IA`, `HTA`, `ONU`, `OHADA`, `CNSS`
- Sigles mixtes utilisés comme acronymes : `Covid`, `OCPe`
- Tout terme introduit avec le pattern `[Nom complet] (ACRONYME)` ou `ACRONYME (Nom complet)`

**Exclure :**
- Abréviations courantes françaises : `p.`, `n°`, `vol.`, `fig.`, `etc.`, `cf.`, `ibid.`, `art.`
- Noms propres de personnes
- Mots communs en majuscules en début de phrase

---

## Anti-patterns — à éviter absolument

❌ **Sortie markdown** : `## Abréviations\n\n| RPA | Robotic... |`
   ✅ JSON uniquement : `[{"abbr": "RPA", "sig": "..."}]`

❌ **Mettre `[À COMPLÉTER]` sans avoir cherché**
   ✅ Toujours WebSearch d'abord

❌ **Signification inventée sans vérification**
   ✅ Si incertain après recherche → `[À COMPLÉTER]`

❌ **Doublons** : RPA apparaît 20 fois → une seule entrée JSON
   ✅ Un sigle = une entrée

❌ **Biais de domaine** : ne supposer que finance ou informatique
   ✅ Adapter la recherche au domaine de l'étudiant (médecine, droit, génie, etc.)

---

## Quality checklist

- [ ] `profile.json` lu pour connaître le domaine de l'étudiant
- [ ] Tous les fichiers .md lus avec Glob
- [ ] Acronymes 2+ lettres extraits
- [ ] Définitions trouvées dans le texte ou via WebSearch
- [ ] `[À COMPLÉTER]` utilisé uniquement après tentative de recherche
- [ ] Dédupliqué — chaque sigle une seule fois
- [ ] Trié alphabétiquement par `abbr`
- [ ] Sortie = JSON pur, aucun texte avant/après
- [ ] Sauvegardé dans `abbreviations.md`
