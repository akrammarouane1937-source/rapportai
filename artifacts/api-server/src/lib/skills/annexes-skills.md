---
name: rapportai-annexes
description: >
  Base de connaissances pour l'agent Annexes : règles de sélection, exemples de format,
  anti-patterns. Les annexes sont du contenu de support référencé dans le corps mais trop
  long pour y figurer. Lis ce fichier AVANT de générer ou suggérer des annexes.
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

# RapportAI — Annexes : base de connaissances

---

## ═══ RÈGLE D'OR ═══

1. **Lis `partie-ii.md` en premier** — cherche tout ce qui est référencé mais non montré : questionnaires, données brutes, code, organigrammes, textes réglementaires.
2. **Chaque annexe répond à une référence concrète** dans le corps du rapport — jamais une annexe inventée sans lien au contenu.
3. **Labels séquentiels** : Annexe A, B, C… Référence dans le corps : *(voir Annexe A — [titre])*.
4. **Contenu substantiel** — pas de placeholders vides. Si les données n'existent pas, génère un template complet et utile.
5. **Mode append** — si `annexes.md` existe déjà, ajoute sans écraser.

---

## Quand suggérer quoi

| Thème / filière | Annexes typiques |
|---|---|
| Finance, comptabilité | Modèle financier (tableau Excel → Annexe), données historiques brutes, rapport annuel extrait |
| Audit | Guide d'entretien semi-directif, grille d'évaluation des contrôles, checklist de procédures |
| Informatique / génie logiciel | Code source (Python, VBA, SQL), diagrammes UML, architecture système |
| RH, marketing | Questionnaire Likert, résultats tabulés, guide d'entretien |
| Sciences sociales | Grille d'observation, transcription d'entretien (extraits), carte conceptuelle |
| Rapport de stage | Organigramme détaillé de l'entreprise, fiche de poste, planning du stage |

---

## Exemples de format

### Questionnaire / guide d'entretien

```markdown
## Annexe A — Guide d'entretien semi-directif : perception de la RPA par les auditeurs externes

**Thème :** L'impact de la RPA sur les missions d'audit externe du cycle Achats-Fournisseurs
**Durée estimée :** 30–45 minutes
**Cible :** Auditeurs seniors et managers de mission, cabinets d'expertise comptable

### Partie 1 — Profil et contexte professionnel
1. Pouvez-vous décrire votre rôle et votre ancienneté dans le métier de l'audit externe ?
2. Avez-vous déjà été exposé à des outils d'automatisation dans le cadre de vos missions ? Lesquels ?

### Partie 2 — Pratiques actuelles sur le cycle Achats-Fournisseurs
3. Quelles procédures d'audit du cycle AP occupent le plus de temps dans vos missions ?
4. Comment procédez-vous actuellement pour le three-way matching et la circularisation des fournisseurs ?

### Partie 3 — Perception et adoption de la RPA
5. Dans quelle mesure pensez-vous que la RPA pourrait automatiser ces procédures sans compromettre les exigences ISA ?
6. Quels risques identifiez-vous dans l'utilisation de bots pour des diligences d'audit ?

### Partie 4 — Perspectives
7. Quels facteurs conditionneraient l'adoption de la RPA dans votre cabinet ?
8. Comment envisagez-vous l'évolution du rôle de l'auditeur dans un contexte d'automatisation croissante ?
```

---

### Tableau de données brutes

```markdown
## Annexe B — Données financières historiques RISMA (2017–2024)

| Année | CA (MAD m) | EBITDA (MAD m) | Marge EBITDA | Taux occupation | Phase cycle |
|---|---|---|---|---|---|
| 2017 | 892 | 298 | 33% | 52% | Expansion |
| 2018 | 956 | 334 | 35% | 55% | Expansion |
| 2019 | 1 024 | 371 | 36% | 57% | Peak |
| 2020 | 312 | -89 | -29% | 18% | Récession (COVID) |
| 2021 | 487 | 42 | 9% | 28% | Reprise |
| 2022 | 891 | 298 | 33% | 49% | Expansion |
| 2023 | 1 170 | 415 | 35% | 57% | Expansion |
| 2024 | 1 264 | 461 | 36% | 59% | Expansion |

*Source : Rapports financiers annuels RISMA, Bourse de Casablanca.*
```

---

### Code source

```markdown
## Annexe C — Code VBA : modèle DCF automatisé

```vba
' Modèle DCF — Calcul de la Valeur d'Entreprise
' Paramètres : WACC, taux de croissance terminal, EBITDA projeté

Function CalculerVE(wacc As Double, tauxCroissance As Double, _
                    ebitda() As Double) As Double
    Dim fcff() As Double
    Dim va As Double
    Dim n As Integer
    n = UBound(ebitda)
    
    ' Actualisation des flux
    For i = 1 To n
        fcff(i) = ebitda(i) * 0.65  ' approximation après CAPEX et BFR
        va = va + fcff(i) / (1 + wacc) ^ i
    Next i
    
    ' Valeur terminale
    Dim vt As Double
    vt = fcff(n) * (1 + tauxCroissance) / (wacc - tauxCroissance)
    va = va + vt / (1 + wacc) ^ n
    
    CalculerVE = va
End Function
```

*Note : Code simplifié à des fins d'illustration. Le modèle complet est disponible sur demande.*
```

---

## Anti-patterns — à éviter absolument

❌ **Annexe sans lien au corps du rapport** : "Annexe D — Définitions générales"
   ✅ Chaque annexe répond à une référence *(voir Annexe X)* dans le corps — sinon elle n'existe pas.

❌ **Questionnaire générique** : les mêmes 10 questions Likert pour n'importe quel thème.
   ✅ Questions spécifiques au thème et à la méthodologie — lire `partie-ii.md` avant.

❌ **Écraser `annexes.md`** si le fichier existe déjà.
   ✅ Toujours append — ne jamais supprimer les annexes précédentes.

❌ **Placeholder vide** : "Annexe A — [À COMPLÉTER PAR L'ÉTUDIANT]"
   ✅ Générer un contenu complet et utilisable — ou demander les données manquantes.

❌ **Streamer le contenu de l'annexe dans le chat**.
   ✅ Confirmation courte uniquement — le contenu est dans le preview.

---

## Quality checklist

- [ ] `partie-ii.md` et `introduction.md` lus — références à des données/outils identifiées
- [ ] Chaque annexe liée à une référence concrète dans le corps
- [ ] Labels séquentiels : Annexe A, B, C…
- [ ] Contenu substantiel et spécifique au thème — pas de boilerplate générique
- [ ] Format correct selon le type (questionnaire / tableau / code)
- [ ] `annexes.md` en mode append — jamais écrasé
- [ ] Seule la confirmation courte dans le chat
