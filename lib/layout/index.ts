import type { DiagramSpec, DiagramType } from "@/lib/spec";
import type { Theme } from "@/lib/theme";
import { layoutComparison } from "./comparison";
import { layoutCycle } from "./cycle";
import { layoutGraph } from "./graph";
import { layoutList } from "./list";
import type { Layout, LayoutContext } from "./types";

export type { Layout, RenderEdge, RenderGroup, RenderNode } from "./types";

/**
 * Type -> layout function. Types without an entry fall back to `list`, which is
 * how unimplemented v1 types (timeline, funnel, venn) degrade gracefully
 * instead of rendering nothing.
 */
const LAYOUTS: Partial<Record<DiagramType, (ctx: LayoutContext) => Layout>> = {
  flowchart: (ctx) => layoutGraph(ctx, { rankdir: "LR" }),
  hierarchy: (ctx) => layoutGraph(ctx, { rankdir: "TB", ranksep: 56 }),
  cycle: layoutCycle,
  comparison: layoutComparison,
  list: layoutList,
};

export function layoutSpec(spec: DiagramSpec, theme: Theme): Layout {
  const ctx: LayoutContext = { spec, theme };
  const fn = LAYOUTS[spec.type];

  if (!fn) {
    return { ...layoutList(ctx), degradedFrom: spec.type };
  }

  try {
    return fn(ctx);
  } catch (error) {
    // A layout that throws must not take the page down with it.
    console.error(`layout failed for type "${spec.type}"`, error);
    return { ...layoutList(ctx), degradedFrom: spec.type };
  }
}
