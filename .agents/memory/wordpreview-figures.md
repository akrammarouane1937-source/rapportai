---
name: WordPreview A4 figure cards
description: Figures render as A4 cards after section content in the HTML preview; how figurePlacement is passed
---

## Rule

`WordPreview.tsx` renders figures as A4-sized image cards **after** the section Markdown content. The figures come from the `figurePlacement` prop, which is passed down from `PartieIPage` and `PartieIIPage`.

**Why:** Figures extracted from uploaded PDFs (via the figures workflow) need to be visible in the live HTML preview alongside the generated text — not just in the annexe panel.

## How to apply

When adding a new section page that can reference figures:
1. Pass `figurePlacement` prop to `WordPreview` (type: `FigureItem[]`)
2. `WordPreview` renders them after the main content block
3. The `figureStore` (Zustand) holds all approved figures — read from there

If figures are not showing in a section preview, first check: is `figurePlacement` being passed? Is it reading from `figureStore` or a stale local state?
