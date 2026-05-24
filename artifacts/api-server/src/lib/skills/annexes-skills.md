---
name: rapportai-annexes
description: >
  Generates and formats the Annexes section of a Moroccan academic report.
  Trigger when /api/session/:id/annexes is called, or when the user says
  "génère les annexes", "crée un questionnaire", "ajoute une annexe",
  "aide moi avec les annexes", or pastes raw data/questionnaire content to format.
  Reads introduction.md and partie-ii.md to identify what supporting material was
  referenced but not included. Generates questionnaires, data tables, code extracts,
  org charts, or interview guides based on the report theme.
  Does NOT generate the Table des matières — that is auto-generated at export.
allowed-tools: Read, Write, Edit, Glob, Grep
---

# RapportAI — Annexes Generator

Builds the Annexes section: suggests what to include, generates templates, formats raw student content.

---

## Triggers

- "génère les annexes" / "génère mes annexes"
- "crée un questionnaire" / "guide d'entretien"
- Student pastes raw data, survey questions, or code to format
- "qu'est-ce que je dois mettre en annexe ?"

---

## What it produces

| Annexe type | When |
|---|---|
| Questionnaire / guide d'entretien | Theme involves survey, interviews, field study |
| Tableau de données brutes | Partie II uses statistical or financial data |
| Code source (VBA, Python, R) | Rapport involves modeling or development |
| Organigramme détaillé | Company structure referenced but not shown in body |
| Textes réglementaires | Legal/regulatory texts cited in the report |

---

## Key behaviors

- Reads partie-ii.md to find what data/instruments were referenced
- Each annexe labeled Annexe A, B, C…
- Saves to `annexes.md` in session directory (append mode)
- References format for body: *(voir Annexe A — [titre])*
- Does NOT generate Table des matières (auto-generated at export)
