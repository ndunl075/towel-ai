import { finalize, iconResolver, sizeNode } from "./measure";
import type { Layout, LayoutContext, RenderNode } from "./types";

const WIDTH = 460;
const GAP = 10;
/** Room reserved on the left for the step badge. */
const BADGE_INSET = 30;

/**
 * The universal fallback. Text that fits no structure still comes out as a
 * deliberate, styled stack - never a broken graph.
 */
export function layoutList(ctx: LayoutContext): Layout {
  const { spec, theme } = ctx;
  // The badge already owns a lead slot here, and an icon takes the same one,
  // so nothing needs to widen - the icon simply replaces the step number.
  const iconOf = iconResolver(ctx);
  let y = 0;

  const nodes: RenderNode[] = spec.nodes.map((node, i) => {
    const size = sizeNode(node, theme, {
      fixedWidth: WIDTH - BADGE_INSET,
      maxLabelLines: 4,
      paddingX: 22,
    });
    const box: RenderNode = {
      id: node.id,
      x: 0,
      y,
      w: WIDTH,
      h: size.h,
      shape: "pill",
      shapePoints: null,
      accent: i,
      labelLines: size.labelLines,
      detailLines: size.detailLines,
      badge: String(i + 1),
      icon: iconOf(node),
      align: "left",
    };
    y += size.h + GAP;
    return box;
  });

  return finalize({ title: spec.title, nodes, edges: [], groups: [] }, theme);
}
