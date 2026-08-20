import type { DiagramNode, DiagramSpec, DiagramType } from "@/lib/spec";
import type { Theme } from "@/lib/theme";
import { layoutComparison } from "./comparison";
import { layoutCycle } from "./cycle";
import { layoutFunnel } from "./funnel";
import { layoutGraph } from "./graph";
import { layoutList } from "./list";
import { layoutTimeline } from "./timeline";
import { layoutVenn } from "./venn";
import type { Layout, LayoutContext, LayoutFn } from "./types";

export type { Layout, RenderEdge, RenderGroup, RenderNode } from "./types";

/**
 * Type -> layout function. Every spec type has one; the mapping is still
 * partial so a type added to the spec before its layout exists degrades to a
 * list rather than rendering nothing.
 */
const LAYOUTS: Partial<Record<DiagramType, LayoutFn>> = {
  flowchart: (ctx) => layoutGraph(ctx, { rankdir: "LR" }),
  hierarchy: (ctx) => layoutGraph(ctx, { rankdir: "TB", ranksep: 56 }),
  cycle: layoutCycle,
  comparison: layoutComparison,
  timeline: layoutTimeline,
  funnel: layoutFunnel,
  venn: layoutVenn,
  list: layoutList,
};

export function layoutSpec(
  spec: DiagramSpec,
  theme: Theme,
  iconFor?: (node: DiagramNode) => string | null,
): Layout {
  const ctx: LayoutContext = { spec, theme, iconFor };
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
