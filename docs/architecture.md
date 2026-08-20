# Napkin Clone — Text → Diagram

**Thesis:** paste text, get a clean editable visual. One LLM call, deterministic rendering.

> **Status: complete.** Every stage, both LLM backends, and all three
> milestones below are implemented. See the README for what each one does and
> where it lives.

## Pipeline

```
text ──▶ LLM (structure extraction) ──▶ JSON spec ──▶ layout engine ──▶ SVG ──▶ editor canvas
```

The LLM never draws. It only classifies and extracts. All visual output is deterministic code. This is the core design decision — LLM-generated SVG is unreliable and unstylable.

## Stages

**1. Structure extraction (1 LLM call)**
- Input: raw text
- Output: strict JSON — `{ type, nodes[], edges[], groups[] }`
- `type` ∈ flowchart | cycle | hierarchy | timeline | comparison | funnel | venn | list
- Enforce with JSON schema / constrained decoding. Retry once on invalid, then fallback to `list`.

**2. Layout engine (pure TS, no LLM)**
- Per-type layout fn: dagre for flowcharts/hierarchy, radial math for cycles, columns for comparison, etc.
- Outputs positioned nodes + routed edges.

**3. Renderer**
- JSON spec → SVG via React components.
- 3–4 theme presets (colors, fonts, corner radius) applied at render, not baked into spec.
- Export: SVG + PNG (+ clipboard copy).

**4. Editor (v1, not v0)**
- Canvas with drag, inline text edit, theme switcher.
- Edits mutate the JSON spec; re-render from spec. Spec is the single source of truth → undo/redo is a spec history stack.

## Stack

| Layer | Choice |
|---|---|
| App | Next.js + React |
| Layout | dagre + custom per-type fns |
| Canvas | plain SVG + pointer events (skip tldraw for v0) |
| LLM | Anthropic w/ structured output, or local via Ollama for the local-first angle *(both shipped)* |
| Export | client-side SVG→PNG (canvas) |

## Build order

- **v0 (1 day):** text → flowchart + cycle + comparison only, 1 theme, PNG export. Ship the demo here. *(shipped)*
- **v1 (2–3 days):** remaining diagram types, themes, drag/edit, regenerate-per-section. *(shipped)*
- **v2:** multiple visual suggestions per text *(shipped, deterministically)*, icon library *(shipped)*.

The suggestions item was scoped as parallel extraction with different type
hints. It shipped as deterministic re-layout instead: layout already re-runs on
the spec in hand, so all eight alternatives render for free rather than costing
one model call each — which matters for a bring-your-own-key app whose extract
route is rate limited. Re-extraction with a type hint is still available for the
case that actually needs it, once the user has picked a shape.

## Risks

- **Napkin's moat is design polish, not tech.** If your default theme is ugly, the demo fails. Spend real time on the theme.
- Type misclassification is the main quality failure — let users manually switch diagram type as an escape hatch.
- Text that fits no structure (pure narrative) → fallback gracefully to styled list, never a broken graph.
