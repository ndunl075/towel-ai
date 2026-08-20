import dagre from "@dagrejs/dagre";

import type { DiagramNode } from "@/lib/spec";
import { measureText } from "@/lib/text";
import {
  borderPoint,
  boundsOf,
  center,
  expand,
  pointAlong,
  roundedPath,
  type Point,
  type Rect,
} from "@/lib/geom";
import { finalize, iconResolver, sizeNode } from "./measure";
import type { Layout, LayoutContext, RenderEdge, RenderGroup, RenderNode } from "./types";

export interface GraphOptions {
  rankdir: "TB" | "LR";
  ranksep?: number;
  nodesep?: number;
}

/**
 * Shared dagre driver for the layered types (flowchart, hierarchy).
 *
 * Groups are handled as dagre compound nodes so members stay adjacent, but the
 * drawn group box is recomputed from member bounds afterwards - dagre's own
 * cluster rect is padded inconsistently across rank directions.
 */
export function layoutGraph(ctx: LayoutContext, opts: GraphOptions): Layout {
  const { spec, theme } = ctx;
  const iconOf = iconResolver(ctx);
  const sized = new Map<string, ReturnType<typeof sizeNode>>();
  for (const node of spec.nodes) {
    sized.set(node.id, sizeNode(node, theme, { icon: Boolean(iconOf(node)) }));
  }

  const positions = runDagre(spec.nodes, spec, theme, opts, sized, true);

  const accentOf = accentAssigner(spec);
  const nodes: RenderNode[] = spec.nodes.map((node) => {
    const size = sized.get(node.id)!;
    const pos = positions.nodes.get(node.id) ?? { x: 0, y: 0 };
    return {
      id: node.id,
      x: pos.x - size.w / 2,
      y: pos.y - size.h / 2,
      w: size.w,
      h: size.h,
      shape: "rect",
      shapePoints: null,
      accent: accentOf(node),
      labelLines: size.labelLines,
      detailLines: size.detailLines,
      badge: null,
      icon: iconOf(node),
      align: "center",
    };
  });

  const rectById = new Map(nodes.map((n) => [n.id, n as Rect]));

  const edges: RenderEdge[] = [];
  for (const [i, edge] of spec.edges.entries()) {
    const from = rectById.get(edge.from);
    const to = rectById.get(edge.to);
    if (!from || !to) continue;

    const routed = positions.edges.get(edgeKey(edge.from, edge.to)) ?? [];
    const points: Point[] = [center(from), ...routed, center(to)];
    const clipped = clipEnds(points, from, to);
    const label = edge.label;
    const at = label ? pointAlong(clipped, 0.5).point : null;

    edges.push({
      id: `e${i}`,
      from: edge.from,
      to: edge.to,
      d: roundedPath(clipped, 14),
      label,
      labelAt: at,
      accent: null,
      arrow: true,
    });
  }

  const groups = buildGroups(spec, nodes, theme);

  return finalize({ title: spec.title, nodes, edges, groups }, theme);
}

type Sized = ReturnType<typeof sizeNode>;

function runDagre(
  specNodes: DiagramNode[],
  spec: LayoutContext["spec"],
  theme: LayoutContext["theme"],
  opts: GraphOptions,
  sized: Map<string, Sized>,
  useGroups: boolean,
): { nodes: Map<string, Point>; edges: Map<string, Point[]> } {
  const g = new dagre.graphlib.Graph({ directed: true, compound: true });
  g.setGraph({
    rankdir: opts.rankdir,
    ranksep: opts.ranksep ?? 64,
    nodesep: opts.nodesep ?? 34,
    edgesep: 16,
    marginx: 0,
    marginy: 0,
  });
  g.setDefaultEdgeLabel(() => ({}));

  const groupIds = new Set(spec.groups.map((gr) => gr.id));
  if (useGroups) {
    for (const group of spec.groups) {
      g.setNode(clusterId(group.id), { label: group.label });
    }
  }

  for (const node of specNodes) {
    const size = sized.get(node.id)!;
    g.setNode(node.id, { width: size.w, height: size.h });
    if (useGroups && node.group && groupIds.has(node.group)) {
      g.setParent(node.id, clusterId(node.group));
    }
  }

  for (const edge of spec.edges) {
    const label = edge.label;
    g.setEdge(
      edge.from,
      edge.to,
      label
        ? {
            width: Math.ceil(measureText(label, theme.font.edgeLabel, false, theme.font.metric)) + 12,
            height: Math.ceil(theme.font.edgeLabel * 1.5),
            labelpos: "c",
          }
        : {},
    );
  }

  try {
    dagre.layout(g);
  } catch {
    // Compound layout is the only failure mode we have seen; retry flat.
    if (useGroups) return runDagre(specNodes, spec, theme, opts, sized, false);
    throw new Error("dagre layout failed");
  }

  const nodes = new Map<string, Point>();
  for (const node of specNodes) {
    const laid = g.node(node.id) as { x?: number; y?: number } | undefined;
    nodes.set(node.id, { x: laid?.x ?? 0, y: laid?.y ?? 0 });
  }

  const edges = new Map<string, Point[]>();
  for (const e of g.edges()) {
    const label = g.edge(e) as { points?: Point[] } | undefined;
    if (label?.points?.length) {
      // Trim dagre's own endpoint stubs; we re-derive them from node borders.
      edges.set(edgeKey(e.v, e.w), label.points.slice(1, -1));
    }
  }

  return { nodes, edges };
}

function clusterId(id: string): string {
  return `cluster:${id}`;
}

function edgeKey(from: string, to: string): string {
  return `${from}\u0000${to}`;
}

/** Replace the center-anchored endpoints with points on the node borders. */
function clipEnds(points: Point[], from: Rect, to: Rect): Point[] {
  const out = [...points];
  out[0] = borderPoint(from, center(from), out[1] ?? center(to));
  out[out.length - 1] = borderPoint(to, center(to), out[out.length - 2] ?? center(from));
  return out;
}

function buildGroups(
  spec: LayoutContext["spec"],
  nodes: RenderNode[],
  theme: LayoutContext["theme"],
): RenderGroup[] {
  if (spec.groups.length === 0) return [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const groups: RenderGroup[] = [];
  const labelBand = theme.font.detail * theme.font.lineHeight + 10;

  for (const [i, group] of spec.groups.entries()) {
    const members = spec.nodes
      .filter((n) => n.group === group.id)
      .map((n) => byId.get(n.id))
      .filter((n): n is RenderNode => Boolean(n));
    if (members.length === 0) continue;

    const box = expand(boundsOf(members as Rect[]), 18);
    groups.push({
      id: group.id,
      label: group.label,
      x: box.x,
      y: box.y - labelBand,
      w: box.w,
      h: box.h + labelBand,
      accent: i,
    });
  }
  return groups;
}

/** Nodes in the same group share an accent; otherwise accents cycle by index. */
function accentAssigner(spec: LayoutContext["spec"]): (node: DiagramNode) => number {
  const groupIndex = new Map(spec.groups.map((g, i) => [g.id, i]));
  const order = new Map(spec.nodes.map((n, i) => [n.id, i]));
  return (node) => {
    if (node.group && groupIndex.has(node.group)) return groupIndex.get(node.group)!;
    return order.get(node.id) ?? 0;
  };
}
