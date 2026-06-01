---
name: Step page streamed-content init pattern
description: All step pages with streamed preview panels must init from getReport() on mount, not from empty string
---

## Rule

Every step page that has a live streamed preview (e.g. introduction, sommaire, partie-i, partie-ii, conclusion) must initialize its `streamedContent` state AND its `rawTextRef` from `getReport().<field>` on mount — never from an empty string `""`.

**Why:** If the page initializes from `""`, returning to a previously-completed step shows a blank preview until the user re-generates. Step6Page had this bug — fixed by reading `getReport().introduction` in the `useState` initializer.

## Pattern

```typescript
const [streamedContent, setStreamedContent] = useState<string>(
  () => getReport().introduction ?? ""
);
const rawTextRef = useRef<string>(getReport().introduction ?? "");
```

Both the state AND the ref must be initialized — the ref is used by the DOCX/PDF export, the state drives the live preview.

## How to apply

Check any new step page that has a preview panel: if the initial value is `""` or `undefined` and the section has a corresponding field in `getReport()`, fix it to read from `getReport().<field>` in the initializer.
