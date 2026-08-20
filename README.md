# Napkin Clone — Text → Diagram

Paste text, get a clean editable visual. One LLM call, deterministic rendering.

```
text ──▶ LLM (structure extraction) ──▶ JSON spec ──▶ layout engine ──▶ SVG ──▶ canvas
```

The LLM never draws. It classifies the text and extracts its parts into a strict
JSON spec; everything visible after that is deterministic TypeScript. See
[`docs/architecture.md`](docs/architecture.md) for the design this is built from.

## Run it

```bash
npm install
cp .env.example .env.local   # optional - see below
npm run dev
```

Then open <http://localhost:3000>. Four sample texts are one click away.

`ANTHROPIC_API_KEY` is **optional**. Without it the app falls back to a local
heuristic extractor (arrows, numbered steps, `A vs B` sections) so the pipeline
still runs end to end offline. With a key set, extraction goes through
`claude-opus-5` with a schema-constrained response.

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | unset | Enables model-based extraction |
| `NAPKIN_MODEL` | `claude-opus-5` | Model used for extraction |
| `NAPKIN_EFFORT` | `medium` | `output_config.effort` for the extraction call |

## Where things live

| Stage | Files |
|---|---|
| 1. Structure extraction | `lib/extract.ts` (model), `lib/heuristic.ts` (fallback), `app/api/extract/route.ts` |
| The spec | `lib/spec.ts` — zod schema, normalisation, repair |
| 2. Layout | `lib/layout/` — `graph.ts` (dagre), `cycle.ts`, `comparison.ts`, `timeline.ts`, `funnel.ts`, `venn.ts`, `list.ts` |
| 3. Render | `components/DiagramSvg.tsx`, `lib/theme.ts` |
| 4. Editor | `lib/document.ts` (doc + history), `lib/layout/overrides.ts`, `components/Canvas.tsx` |
| Export | `lib/export.ts` — SVG, PNG, clipboard |

`/fixtures` renders every layout from static specs in `lib/fixtures.ts`. Because
rendering is deterministic, that page is the fastest way to see a layout
regression, and it never spends a model call.

## Status

**v0 and v1 are shipped.**

All eight spec types have a real layout: `flowchart`, `hierarchy`, `cycle`,
`comparison`, `timeline`, `funnel`, `venn`, `list`. Four themes, applied at
render time. The canvas is editable, and export covers PNG, SVG and clipboard.

**Editing.** Drag a node to move it, double-click to rename it, Backspace to
delete it, plus Add node and Reset layout. Cmd/Ctrl+Z undoes anything, theme
switches and type switches included, because the whole editor state is one
`DiagramDoc` and history is a stack of those.

Drag positions are stored as *offsets* from wherever the layout engine put the
node, not as absolute points. Rename a node so its box resizes, and the nudge
still reads as the same nudge. Edges touching a moved node re-route as straight
border-to-border lines — keeping the original dagre spline would leave the
arrow pointing at where the node used to be.

**Type switching** re-lays out the spec you already have, with no second model
call. This is the escape hatch for a misclassification, which is the main
quality failure mode.

**Venn convention.** The spec gives a node one group, so overlap membership
needs a rule: a node carrying a `group` sits in that set's exclusive lobe, and
a node with `group: null` is shared by every set and sits in the middle. The
extraction prompt states the same rule.

Not built yet: regenerate-per-section, multiple suggestions per text (v2), icon
library (v2).

## How extraction fails safely

1. Model returns something that does not match the schema → one retry with the
   error fed back.
2. Still bad, or the request errors, or the model refuses → the heuristic
   extractor runs.
3. Heuristic finds no structure → a styled list.

`normalizeSpec` also repairs specs that are schema-valid but incoherent: edges
pointing at nodes that were never declared, duplicate ids, self-loops, nodes
referencing an undeclared group. A layout function that throws is caught and
falls back to the list layout rather than taking the page down.

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run typecheck  # tsc --noEmit
```
