import type { Offset } from "@/lib/document";
import { borderPoint, center, fmt, pointAlong, type Point, type Rect } from "@/lib/geom";
import { PAGE_PADDING, type Layout, type RenderEdge, type RenderNode } from "./types";

/**
 * Applies the editor's drag offsets on top of a freshly computed layout.
 *
 * Edges touching a moved node are re-routed as straight border-to-border
 * lines. Keeping the original dagre spline would leave the arrow pointing at
 * where the node used to be, which looks broken; a straight line is honest
 * about the fact that a human overrode the layout.
 */
export function applyOffsets(layout: Layout, offsets: Record<string, Offset>): Layout {
  const ids = Object.keys(offsets);
  if (ids.length === 0) return layout;

  const moved = new Set<string>();
  const nodes: RenderNode[] = layout.nodes.map((node) => {
    const offset = offsets[node.id];
    if (!offset) return node;

    // Clamp inside the page so a node can never be dragged out of the export.
    const x = clamp(node.x + offset.dx, PAGE_PADDING - node.w / 2, layout.width - node.w / 2);
    const y = clamp(
      node.y + offset.dy,
      PAGE_PADDING + layout.titleHeight - node.h / 2,
      layout.height - node.h / 2,
    );
    if (x === node.x && y === node.y) return node;

    moved.add(node.id);
    const dx = x - node.x;
    const dy = y - node.y;
    return {
      ...node,
      x,
      y,
      shapePoints: node.shapePoints?.map((p) => ({ x: p.x + dx, y: p.y + dy })) ?? null,
    };
  });

  if (moved.size === 0) return { ...layout, nodes };

  const rects = new Map(nodes.map((n) => [n.id, n as Rect]));
  const edges: RenderEdge[] = layout.edges.map((edge) => {
    if (!moved.has(edge.from) && !moved.has(edge.to)) return edge;
    const from = rects.get(edge.from);
    const to = rects.get(edge.to);
    if (!from || !to) return edge;

    const start = borderPoint(from, center(from), center(to));
    const end = borderPoint(to, center(to), center(from));
    const points: Point[] = [start, end];
    return {
      ...edge,
      d: `M ${fmt(start.x)} ${fmt(start.y)} L ${fmt(end.x)} ${fmt(end.y)}`,
      labelAt: edge.label ? pointAlong(points, 0.5).point : null,
    };
  });

  return { ...layout, nodes, edges };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
