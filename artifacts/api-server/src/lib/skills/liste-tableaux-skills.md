---
name: rapportai-liste-tableaux
description: >
  Base de connaissances pour l'agent Liste des Tableaux : exemples de format,
  règles d'extraction des légendes, et conventions de numérotation dans les PFE marocains.
  Lis ce fichier AVANT de générer la liste des tableaux.
allowed-tools:
  - Read
  - Write
  - Glob
---

# RapportAI — Liste des tableaux : base de connaissances

---

## ═══ RÈGLE D'OR ═══

1. **Extrait, ne génère pas** — chaque entrée doit exister réellement dans une section.
2. **Placeholder de page** — les numéros de page réels ne sont pas connus → toujours `[p. X]`.
3. **Une entrée par tableau** — même si référencé plusieurs fois dans le texte.
4. **Ordre numérique** — Tableau 1, Tableau 2, Tableau 3… jamais aléatoire.
5. **Markdown pur** — pas de JSON, pas de tableaux, juste des lignes de texte.

---

## Format standard marocain (PFE / mémoire)

```
Tableau 1 — Comparaison des indicateurs de performance (2020–2024)............[p. X]
Tableau 2 — Récapitulatif des hypothèses de recherche.........................[p. X]
Tableau 3 — Résultats du questionnaire : perception des auditeurs..............[p. X]
Tableau 4 — Synthèse des ratios financiers RISMA vs secteur...................[p. X]
```

Points clés :
- Tiret long `—` entre le numéro et le titre
- Points de suite entre le titre et `[p. X]`
- Pas de virgule, pas de point final après le titre

---

## Comment identifier une légende de tableau dans le texte

**Format 1 — Italique avec astérisques :**
```
*Tableau 1 — Comparaison des ratios de liquidité. Source : états financiers RISMA, 2024.*
```
→ Titre = `Comparaison des ratios de liquidité`

**Format 2 — Gras :**
```
**Tableau 2 — Récapitulatif des entretiens réalisés**
```

**Format 3 — Texte simple :**
```
Tableau 3 — Résultats du questionnaire Likert
```

**Format 4 — Markdown table avec légende :**
```
*Tableau 4 — Évolution du chiffre d'affaires*

| Année | CA (MAD m) | Variation |
|---|---|---|
| 2022 | 891 | +15% |
```
→ Capturer la légende `*Tableau 4 — ...*`, pas le contenu du tableau

**Format 5 — Référence inline (NE PAS inclure) :**
```
Comme le montre le Tableau 2…
(voir Tableau 3)
```

---

## Exemples réels de listes des tableaux

### Exemple 1 — PFE Finance (6 tableaux)

```
Tableau 1 — Présentation des méthodes d'évaluation utilisées..................[p. X]
Tableau 2 — Données macroéconomiques marocaines (PIB, inflation) 2018–2024...[p. X]
Tableau 3 — Phases du cycle économique et méthodes de valorisation adaptées..[p. X]
Tableau 4 — Hypothèses du modèle DCF — scénario central.......................[p. X]
Tableau 5 — Résultats de valorisation RISMA selon les trois scénarios.........[p. X]
Tableau 6 — Comparaison EV/EBITDA : RISMA vs pairs sectoriels MENA............[p. X]
```

### Exemple 2 — PFE Audit / RPA (7 tableaux)

```
Tableau 1 — Comparaison RPA vs ERP vs BPO pour l'automatisation audit........[p. X]
Tableau 2 — Grille d'évaluation des risques ISA 315 — cycle AP...............[p. X]
Tableau 3 — Cartographie des diligences d'audit automatisables par RPA........[p. X]
Tableau 4 — Résultats de l'enquête : niveau d'adoption de la RPA..............[p. X]
Tableau 5 — Analyse SWOT de l'implémentation RPA dans les cabinets marocains..[p. X]
Tableau 6 — Critères de sélection des outils RPA (UiPath, Automation Anywhere)[p. X]
Tableau 7 — Matrice de risques de l'implémentation RPA........................[p. X]
```

---

## Distinguer figures et tableaux

| Élément | Ce que c'est |
|---|---|
| **Tableau** | Grille avec lignes et colonnes, chiffres ou texte structuré |
| **Figure** | Graphique, schéma, organigramme, carte, image, diagramme |

En cas de doute (ex: "Graphique 1 —") : un graphique est une figure, pas un tableau. Ne l'inclure que dans la liste des figures.

---

## Anti-patterns — à éviter absolument

❌ **Inventer des tableaux** qui n'existent pas dans le texte
   ✅ Extraire uniquement ce qui est dans les fichiers .md

❌ **Inclure les tableaux Markdown sans légende**
   ✅ Inclure uniquement les tableaux avec une légende `Tableau N — Titre`

❌ **Inclure les graphiques** dans la liste des tableaux
   ✅ Graphiques et schémas → liste des figures uniquement

❌ **Inclure les références inline** : "(voir Tableau 2)"
   ✅ Légendes uniquement

❌ **Mettre les vrais numéros de page**
   ✅ Toujours `[p. X]`

---

## Quality checklist

- [ ] `partie-i.md` et `partie-ii.md` lus (+ introduction et conclusion si disponibles)
- [ ] Seules les légendes de tableau extraites (pas les références inline)
- [ ] Tableaux distincts des figures (pas de graphiques dans cette liste)
- [ ] Chaque tableau = une seule entrée
- [ ] Trié par numéro en ordre croissant
- [ ] Format : `Tableau N — Titre.......[p. X]`
- [ ] Sauvegardé dans `liste-tableaux.md`
- [ ] Message court dans le chat (jamais le contenu complet)
