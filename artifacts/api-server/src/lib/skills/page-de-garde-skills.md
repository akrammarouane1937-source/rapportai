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

**Triggered when** any of these files exist after Glob:

| Fichier détecté | Action |
|---|---|
| `template-screenshot.png/jpg/jpeg` | Read → lecture visuelle directe |
| `template.pdf` ou `template-page-de-garde.pdf` | Read → lecture visuelle directe (Claude lit les PDFs nativement) |
| `template-text.txt` | Read → extraction structurelle (labels, ordre des champs, placeholders) |
| `template.docx` | ⚠️ Ne PAS tenter Read visuel — .docx non supporté. Si template-text.txt dispo → utilise-le. Sinon → PATH B + message unique à l'étudiant : "Uploadez une capture d'écran ou un PDF de votre template pour que je reproduise exactement la mise en page." |

Steps (pour image ou PDF) :
1. `Glob` — lister tous les fichiers du dossier de session
2. `Read` le fichier template (image ou PDF) — observer TOUT :
   - **Ordre des éléments** de haut en bas (logos, école, filière, titre, séparateurs, champs, année)
   - **Couleurs exactes** : header bars, séparateurs, texte titre — noter les codes hex si visibles
   - **Labels mot-pour-mot** : "Réalisé par :" vs "Présenté par :" vs "Étudiant :" — reproduire exactement
   - **Logos** : présents/absents, position gauche/droite/centré
   - **Séparateurs et bordures** : ligne simple, double, épaisseur, couleur
3. Reproduire la structure IDENTIQUE — même ordre, mêmes séparateurs, mêmes labels, mêmes couleurs
4. Remplir TOUS les placeholders avec les données réelles de l'étudiant depuis profile.json
5. **LOGOS** : inclure un logo UNIQUEMENT s'il est visuellement présent dans le template. Jamais inventer ni supposer.
6. Ne PAS chercher de logos externes — ils sont déjà dans le template s'ils existent
7. `Write` page-de-garde.md

**Règles critiques PATH A :**
- Structure identique au template — ne pas réordonner les champs, ne pas ajouter de sections, ne pas en supprimer
- Couleurs du template UNIQUEMENT — jamais substituer ses propres couleurs (pas de violet #7c3aed, pas de bleu arbitraire)
- Un logo non visible dans le template = pas de logo dans l'output
- Le format a été validé par l'école — tout écart sera rejeté

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

- [ ] Glob run first — checked for all template formats (png/jpg/pdf/txt/docx)
- [ ] Missing info collected in ONE message (or skipped if all present)
- [ ] PATH A or PATH B chosen correctly based on template presence
- [ ] PATH A: output is structurally identical to template (same order, same labels)
- [ ] Zero placeholders remaining
- [ ] No "Royaume du Maroc" / "Ministère" lines
- [ ] Logo école left, logo entreprise right (or centered if alone)
- [ ] All optional fields omitted cleanly if absent (no empty labels)
- [ ] Saved to page-de-garde.md
- [ ] After Write: output ONLY brief confirmation ("✅ Page de garde générée…") — never the full content in chat
