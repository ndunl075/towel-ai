import { borderPoint, center, fmt, polarPoint, type Point, type Rect } from "@/lib/geom";
import { finalize, sizeNode } from "./measure";
import type { Layout, LayoutContext, RenderEdge, RenderNode } from "./types";

/** How far past the node boxes each arc bows outward. */
const BULGE = 26;

/**
 * Nodes evenly spaced on a circle, connected clockwise.
 *
 * Each arrow is a quadratic that leaves one node's border, bulges out to the
 * node ring, and lands on the next node's border. Drawing a single shared ring
 * instead looks tidy on paper and terrible in practice: wide labels crowd the
 * middle, so the ring either collapses or runs underneath the boxes.
 */
export function layoutCycle(ctx: LayoutContext): Layout {
  const { spec, theme } = ctx;
  const count = spec.nodes.length;
  if (count === 0) return finalize({ title: spec.title, nodes: [], edges: [], groups: [] }, theme);

  const sized = spec.nodes.map((n) => sizeNode(n, theme, { maxWidth: 190, minWidth: 128 }));
  const maxW = Math.max(...sized.map((s) => s.w));
  const maxH = Math.max(...sized.map((s) => s.h));

  const angleStep = (Math.PI * 2) / Math.max(count, 2);
  // A chord long enough that neighbouring boxes cannot touch.
  const chord = Math.hypot(maxW, maxH) + 52;
  const radius = Math.max(
    count > 1 ? chord / (2 * Math.sin(angleStep / 2)) : 0,
    maxW * 0.85,
    140,
  );

  // Start at the top and run clockwise - the direction people read a cycle in.
  const angleAt = (i: number) => -Math.PI / 2 + i * angleStep;

  const nodes: RenderNode[] = spec.nodes.map((node, i) => {
    const size = sized[i];
    const p = polarPoint(0, 0, radius, angleAt(i));
    return {
      id: node.id,
      x: p.x - size.w / 2,
      y: p.y - size.h / 2,
      w: size.w,
      h: size.h,
      shape: "rect",
      shapePoints: null,
      accent: i,
      labelLines: size.labelLines,
      detailLines: size.detailLines,
      badge: null,
      align: "center",
    };
  });

  const edges: RenderEdge[] = [];
  const declared = new Map(spec.edges.map((e) => [`${e.from} ${e.to}`, e.label]));

  if (count > 1) {
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count;
      const fromRect = nodes[i] as Rect;
      const toRect = nodes[j] as Rect;
      const midAngle = angleAt(i) + angleStep / 2;
      // Aiming both endpoints at the gap between the nodes keeps the arrow
      // leaving and arriving on the outward-facing side of each box.
      const aim = polarPoint(0, 0, radius * 1.15, midAngle);
      const start = stepOff(borderPoint(fromRect, center(fromRect), aim), center(fromRect), 6);
      const end = stepOff(borderPoint(toRect, center(toRect), aim), center(toRect), 10);

      const control = arcControl(start, end, midAngle);
      const label = declared.get(`${spec.nodes[i].id} ${spec.nodes[j].id}`) ?? null;

      edges.push({
        id: `c${i}`,
        from: spec.nodes[i].id,
        to: spec.nodes[j].id,
        d: `M ${fmt(start.x)} ${fmt(start.y)} Q ${fmt(control.x)} ${fmt(control.y)} ${fmt(end.x)} ${fmt(end.y)}`,
        label,
        labelAt: label ? quadraticMidpoint(start, control, end) : null,
        accent: i,
        arrow: true,
      });
    }
  }

  return finalize({ title: spec.title, nodes, edges, groups: [] }, theme);
}

/**
 * Step an endpoint off the node border, away from that node. Nudging radially
 * instead would push the arrowhead into the box on the far side of the circle.
 */
function stepOff(p: Point, from: Point, by: number): Point {
  const dx = p.x - from.x;
  const dy = p.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: p.x + (dx / len) * by, y: p.y + (dy / len) * by };
}

/**
 * Control point putting the curve's apex just outside both endpoints, so every
 * arc bows outward by the same amount however the boxes happen to be sized.
 */
function arcControl(start: Point, end: Point, midAngle: number): Point {
  const startDistance = Math.hypot(start.x, start.y);
  const endDistance = Math.hypot(end.x, end.y);
  const meanDistance = (startDistance + endDistance) / 2;
  const half = angleBetween(start, end) / 2;
  const apex = Math.max(startDistance, endDistance) + BULGE;
  // Solves apex = 0.5 * meanDistance * cos(half) + 0.5 * controlRadius.
  const controlRadius = 2 * apex - meanDistance * Math.cos(half);
  return polarPoint(0, 0, controlRadius, midAngle);
}

function angleBetween(a: Point, b: Point): number {
  const dot = a.x * b.x + a.y * b.y;
  const mags = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
  if (mags === 0) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / mags)));
}

function quadraticMidpoint(start: Point, control: Point, end: Point): Point {
  return {
    x: 0.25 * start.x + 0.5 * control.x + 0.25 * end.x,
    y: 0.25 * start.y + 0.5 * control.y + 0.25 * end.y,
  };
}
