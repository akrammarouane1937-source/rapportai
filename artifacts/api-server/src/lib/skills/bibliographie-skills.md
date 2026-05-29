---
name: rapportai-bibliographie
description: >
  Compiles the complete bibliography of a Moroccan academic report — extracts all citations
  from generated sections, completes missing info via WebSearch, formats per citation style.
  Handles APA, IEEE, Harvard, Chicago. Resolves [SOURCE] markers. Never invents DOIs.
allowed-tools: Read, Write, Glob, Grep, WebFetch, WebSearch
---

# RapportAI — Bibliographie Generator

Scans all .md sections, extracts citations, completes via WebSearch, formats and saves.

---

## Steps

1. Read `profile.json` → `citationStyle` (default: APA 7th)
2. Glob all `.md` files, read each one
3. Grep for `\[SOURCE\]|(\(.+?, \d{4}\))|\[\d+\]`
4. Deduplicate, complete missing fields via WebSearch
5. Format per citation style
6. Save to `bibliographie.md`

---

## Citation Styles

| Style | Sort order | Grouping |
|---|---|---|
| APA 7th | Alphabetical by first author | Ouvrages / Articles / Webographie |
| IEEE | Order of first appearance | Single numbered list |
| Harvard | Alphabetical | Ouvrages / Articles / Webographie |
| Chicago | Alphabetical | Ouvrages / Articles / Webographie |

---

## Rules

- Never invent a DOI, volume, page number, or publisher
- Mark unresolvable fields as `[À COMPLÉTER]`
- Web sources must include access date: "Consulté le DD mois AAAA"
- Each source appears once only — deduplicate across all sections
- `[SOURCE]` markers: read surrounding context, search, complete or flag

---

## Error handling

| Condition | Response |
|---|---|
| No .md files found | `<error>Aucune section générée.</error>` |
| No citations found | Empty bibliography with note |
| WebSearch fails | Keep available info + `[À COMPLÉTER]` |
