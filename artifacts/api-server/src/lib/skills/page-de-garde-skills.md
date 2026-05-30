---
name: rapportai-page-de-garde
description: >
  Generates the page de garde (cover page) of a Moroccan academic report.
  Triggered at step 2. All base info (school, filière, theme, reportType, annee,
  studentName) is injected automatically from onboarding — agent NEVER asks for these.
  Agent only asks for what is missing: encadrant(s), entreprise, jury members.
  If a .docx template is uploaded, fills its placeholders and respects its layout.
  If no template, searches for the school logo and company logo via WebSearch + WebFetch,
  then builds a standard Moroccan academic cover page.
  Saves output to page-de-garde.md.
allowed-tools: Read, Write, Glob, Bash, WebSearch, WebFetch
---

# RapportAI — Page de Garde Agent

Generates the cover page. Base info pre-loaded from onboarding.
Collects only what's missing in one message. Logo auto-fetched if no template.

---

## Pre-loaded Context (NEVER ask for these)

These are always injected in the task prompt — treat them as known facts:
- `studentName` — full name from Clerk auth
- `school` — from onboarding
- `filiere` — from onboarding
- `theme` — from step 1
- `reportType` — PFE / Stage / Mémoire
- `annee` — academic year

---

## Missing Info — Ask ONCE

If any of the following are not in the profile, ask in ONE single message:

```
Pour finaliser ta page de garde, il me manque :
1. Encadrant pédagogique ? (nom complet, ex: Pr. Mohammed Fikri)
2. Encadrant professionnel ? (si PFE/Stage — nom complet ou "non")
3. Entreprise d'accueil ? (nom exact — important pour le logo)
4. Membres du jury ? (noms complets ou "non")
```

Rules:
- If reportType = "Mémoire" → skip questions 2 and 3
- If student says "non" or skips → continue without, no follow-up
- If all fields already present in profile → skip directly to generation

---

## Two Generation Paths

### PATH A — Template uploaded

Triggered when: `template-screenshot.jpg` OR `template-text.txt` OR any `.docx` file exists in the session folder.

Steps:
1. `Glob` — list ALL files in the directory
2. If `template-screenshot.jpg` exists → `Read` it to understand the EXACT visual layout:
   - Element order (logo positions, title placement, separators, typography)
   - All fields present and their exact labels
   - Borders, decorative elements, spacing style
   - **Color palette** — note the EXACT colors used (header bars, separators, title text). These are the ONLY colors to use in output.
3. If `template-text.txt` exists → `Read` it to extract:
   - Exact placeholder names and their positions
   - Field labels word-for-word
4. Reproduce the EXACT SAME structure as the template — same order, same separators, same labels, **same colors**
5. Fill ALL placeholders with real student data from the profile
6. **LOGOS**: Only include a logo if it is VISUALLY PRESENT in the template screenshot or explicitly mentioned in template-text.txt. NEVER invent or assume a logo exists. If no logo is visible → no logo in output.
7. Do NOT search for external logos — logos are already embedded in the template if they exist
8. `Write` page-de-garde.md with the reproduced and filled content

**Critical rules for PATH A:**
- The output must be structurally identical to the template. Do NOT reorder fields, add new sections, or remove existing ones.
- Use the template's colors ONLY — never substitute your own color choices (no purple, no blue, no other default).
- Only include a logo if it is actually visible in the template. Do NOT write "Le logo [école] est présent" if no logo was visible.
- The student's school verified this exact format — any structural change will be rejected.

### PATH B — No template

Triggered when: no template files found after Glob.

Steps:
1. Search for school logo:
   ```
   WebSearch: logo [school] Maroc PNG officiel site:[school].ma
   Fallback:  logo [school] Maroc PNG transparent haute résolution
   ```
2. Search for company logo (PFE/Stage only, if entreprise provided):
   ```
   WebSearch: logo [entreprise] PNG officiel
   Fallback:  [entreprise] Maroc logo PNG
   ```
3. Download found logos:
   ```bash
   curl -L -o logo-ecole.png "[url]"
   curl -L -o logo-entreprise.png "[url]"
   ```
4. If logo not found after 2 attempts → skip silently, note once in output
5. Build cover page using standard structure below
6. `Write` page-de-garde.md

---

## Standard Cover Page Structure (PATH B)

**Color rule for PATH B:** Use the `reportColor` value provided in the task prompt (e.g. "bleu marine (#1e3a5f)"). Apply this color to: section header bars, separator lines, and title text. If no `reportColor` is provided, default to bleu marine (#1e3a5f). NEVER use purple (#7c3aed) or any other arbitrary color.

```
<!-- logos: logo-ecole.png, logo-entreprise.png -->
<!-- color: [reportColor from prompt] -->

[LOGO ÉCOLE — gauche]                    [LOGO ENTREPRISE — droite]
                                          (ou vide si Mémoire/non fourni)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ← color: reportColor

[TYPE RAPPORT EN MAJUSCULES]
Pour l'obtention du diplôme de [FILIÈRE]

Thème :
« [TITRE DU RAPPORT] »

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ← color: reportColor

Réalisé par : [NOM ÉTUDIANT]

Encadrant pédagogique : [NOM]
Encadrant professionnel : [NOM]        ← omettre si absent
Entreprise d'accueil : [NOM]           ← omettre si absent

Membres du jury :
• [JURY 1]
• [JURY 2]
• [JURY 3]                             ← omettre si absents

Année académique : [ANNEE]
```

Rules for structure:
- No "Royaume du Maroc" or "Ministère de l'Enseignement Supérieur"
- School name in UPPERCASE centered below the logos
- Filière on the line below school name
- Omit any field that is empty — no blank labels
- If no company logo → school logo centered at top
- **LOGOS**: Only include logos found via WebSearch. NEVER write "logo présent" or include a logo placeholder if none was downloaded successfully.

---

## Output File

Always save to `page-de-garde.md`.
Add at top: `<!-- logos: logo-ecole.png, logo-entreprise.png -->` if logos were downloaded.
If a logo was not found: `<!-- logo-ecole: not found -->` as a note.

---

## Quality Checklist

- [ ] Glob run first — checked for template files
- [ ] Missing info collected in ONE message (or skipped if all present)
- [ ] PATH A or PATH B chosen correctly based on template presence
- [ ] PATH A: output is structurally identical to template (same order, same labels)
- [ ] Zero placeholders remaining
- [ ] No "Royaume du Maroc" / "Ministère" lines
- [ ] Logo école left, logo entreprise right (or centered if alone)
- [ ] All optional fields omitted cleanly if absent (no empty labels)
- [ ] Saved to page-de-garde.md
- [ ] Stopped immediately after Write — no summary text
