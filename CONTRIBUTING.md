# Contributing

Thanks for taking a look. This is a small project with one strong opinion, so
the guidance below is mostly about keeping that opinion intact.

## Getting set up

```bash
npm install
npm run dev
```

No API key needed. Without `ANTHROPIC_API_KEY` the app falls back to the local
heuristic extractor, so the whole pipeline runs end to end offline — that is
the path CI exercises too.

Before opening a PR:

```bash
npm run typecheck
npm run build
```

Both must pass. CI runs exactly these.

## The one rule

**The model never draws.** It classifies text and fills in a JSON spec; every
pixel after that is deterministic TypeScript. A change that has the model emit
SVG, CSS, colours, coordinates, or any other visual output is not a change this
project wants — that path is unreliable and unstylable, which is the whole
reason the pipeline is shaped this way. See
[`docs/architecture.md`](docs/architecture.md).

Practically, that means:

- `lib/extract.ts` is the only file allowed to call a model.
- The spec (`lib/spec.ts`) carries structure, never presentation. No colours, no
  coordinates, no font sizes.
- Themes are applied at render time (`lib/theme.ts`), so the same spec can be
  drawn four ways.

## Adding a layout

1. Write `lib/layout/<type>.ts` exporting `(ctx: LayoutContext) => Layout`. Use
   `sizeNode` for boxes and `finalize` at the end — `finalize` handles the
   origin shift, the title band, and page bounds.
2. Register it in the `LAYOUTS` map in `lib/layout/index.ts`.
3. Add a fixture to `lib/fixtures.ts` and look at `/fixtures`.

Layout code must be pure and deterministic. It runs on the server and in the
browser and has to agree with itself, which is why text is measured with the
table in `lib/text.ts` rather than a canvas context. Anything that reads the
DOM, the clock, or a random number belongs somewhere else.

Degrade, never crash. A layout that cannot represent the spec it was handed
should return another layout with `degradedFrom` set (see `comparison.ts`
falling back to a list), and the dispatcher catches throws for the cases nobody
anticipated.

## Adding a theme

Add a `Theme` to `lib/theme.ts` and push it into `THEMES`. Check it against
every fixture on `/fixtures`, including the dark-background case — the exported
SVG paints its own background, so a theme that only looks right on the app's
canvas is not finished.

## Testing

There is no unit test suite yet. `/fixtures` is the regression check: it renders
every layout from static specs, so a screenshot diff of that page catches
geometry changes without spending a model call. If you change layout maths,
look at that page before and after.

Contributions that add a real test harness are welcome.
