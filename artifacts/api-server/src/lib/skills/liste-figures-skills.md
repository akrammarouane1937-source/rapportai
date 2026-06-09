---
name: rapportai-liste-figures
description: >
  Base de connaissances pour l'agent Liste des Figures : exemples de format,
  règles d'extraction des légendes, et conventions de numérotation dans les PFE marocains.
  Lis ce fichier AVANT de générer la liste des figures.
allowed-tools:
  - Read
  - Write
  - Glob
---

# RapportAI — Liste des figures : base de connaissances

---

## ═══ RÈGLE D'OR ═══

1. **Extrait, ne génère pas** — chaque entrée doit exister réellement dans une section.
2. **Placeholder de page** — les numéros de page réels ne sont pas connus à ce stade → toujours `[p. X]`.
3. **Une entrée par figure** — même si la figure est mentionnée plusieurs fois.
4. **Ordre numérique** — Figure 1, Figure 2, Figure 3… jamais aléatoire.
5. **Markdown pur** — pas de JSON, pas de tableaux, juste des lignes de texte.

---

## Format standard marocain (PFE / mémoire)

Dans les rapports marocains, la liste des figures suit ce format :

```
Figure 1 — Évolution du MASI entre 2019 et 2024..............................[p. X]
Figure 2 — Organigramme de la Direction Financière de RISMA...................[p. X]
Figure 3 — Architecture du système ERP SAP déployé............................[p. X]
Figure 4 — Modèle conceptuel de la recherche (adapté de Damodaran, 2012)......[p. X]
```

Points clés :
- Tiret long `—` entre le numéro et le titre (pas un tiret court `-`)
- Points de suite entre le titre et `[p. X]`
- `[p. X]` comme placeholder de numéro de page
- Pas de virgule, pas de point final

---

## Comment identifier une légende de figure dans le texte

Le texte des sections utilise ces formats de légende :

**Format 1 — Italique avec astérisques (le plus courant) :**
```
*Figure 1 — Évolution du MASI entre 2019 et 2024. Source : Bourse de Casablanca, 2024.*
```
→ Titre = `Évolution du MASI entre 2019 et 2024`
→ Source = extraite mais non incluse dans la liste des figures

**Format 2 — Gras :**
```
**Figure 2 — Organigramme de la Direction Financière**
```

**Format 3 — Texte simple :**
```
Figure 3 — Architecture du système ERP SAP déployé
```

**Format 4 — Référence inline (pas une légende — ne pas inclure dans la liste) :**
```
La Figure 1 montre l'évolution du MASI…
comme illustré dans la Figure 2 ci-dessus
```
→ Ces références ne sont PAS des légendes — les ignorer pour la liste

---

## Exemples réels de listes des figures

### Exemple 1 — PFE Finance (5 figures)

```
Figure 1 — Évolution du MASI par rapport au CAC40 (2015–2024)................[p. X]
Figure 2 — Décomposition de la valeur d'entreprise selon Damodaran............[p. X]
Figure 3 — Cycle économique marocain (HCP, 2023)..............................[p. X]
Figure 4 — Comparaison EV/EBITDA sectoriel — hôtellerie MENA..................[p. X]
Figure 5 — Synthèse DCF RISMA (scénarios optimiste, central, pessimiste)......[p. X]
```

### Exemple 2 — PFE Informatique / SI (8 figures)

```
Figure 1 — Architecture générale du système d'information proposé..............[p. X]
Figure 2 — Diagramme de cas d'utilisation (UML).................................[p. X]
Figure 3 — Modèle Entité-Relation de la base de données.........................[p. X]
Figure 4 — Maquette de l'interface principale du tableau de bord................[p. X]
Figure 5 — Flux de traitement RPA : cycle Achats-Fournisseurs...................[p. X]
Figure 6 — Comparaison des temps de traitement avant/après RPA..................[p. X]
Figure 7 — Résultats du questionnaire : perception des auditeurs................[p. X]
Figure 8 — Roadmap d'implémentation proposée....................................[p. X]
```

---

## Numérotation — règles de cohérence

| Situation | Comportement |
|---|---|
| Numéros séquentiels (1, 2, 3…) | Ordre naturel croissant |
| Numéros par chapitre (1.1, 1.2, 2.1…) | Trier par chapitre puis par sous-numéro |
| Numéros incohérents dans le texte | Utiliser l'ordre d'apparition dans les fichiers |
| Même numéro deux fois | Garder celui avec le titre le plus complet |

---

## Anti-patterns — à éviter absolument

❌ **Inventer des figures** qui n'existent pas dans le texte
   ✅ Extraire uniquement ce qui est dans les fichiers .md

❌ **Inclure les références inline** : "comme le montre la Figure 2"
   ✅ Légendes uniquement (lignes commençant par `Figure N —` ou `*Figure N —`)

❌ **Inclure la source** dans le titre de la liste
   ✅ Titre uniquement, pas la source — `Figure 1 — Évolution du MASI...` pas `Figure 1 — Évolution du MASI. Source : HCP.`

❌ **Mettre les vrais numéros de page** (impossibles à connaître à ce stade)
   ✅ Toujours `[p. X]`

❌ **Format tableau** : `| Figure 1 | Titre | p. X |`
   ✅ Lignes de texte : `Figure 1 — Titre.......[p. X]`

---

## Quality checklist

- [ ] `partie-i.md` et `partie-ii.md` lus (+ introduction et conclusion si disponibles)
- [ ] Seules les légendes extraites (pas les références inline)
- [ ] Chaque figure = une seule entrée
- [ ] Trié par numéro de figure en ordre croissant
- [ ] Format : `Figure N — Titre.......[p. X]`
- [ ] Sauvegardé dans `liste-figures.md`
- [ ] Message court dans le chat (jamais le contenu complet)
