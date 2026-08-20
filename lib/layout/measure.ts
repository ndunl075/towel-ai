import type { DiagramNode } from "@/lib/spec";
import type { Theme } from "@/lib/theme";
import { measureText, wrapText } from "@/lib/text";
import { pathBounds, translatePath, type Rect } from "@/lib/geom";
import { PAGE_PADDING, TITLE_GAP, type Layout, type RenderNode } from "./types";

export interface SizedNode {
  labelLines: string[];
  detailLines: string[];
  w: number;
  h: number;
}

export interface SizeOptions {
  minWidth?: number;
  maxWidth?: number;
  /** Force every node in a set to the same width (columns, lists). */
  fixedWidth?: number;
  maxLabelLines?: number;
  paddingX?: number;
  paddingY?: number;
}

/**
 * A node box is sized to its own text, clamped into a band so a diagram of
 * mixed-length labels still reads as a set of related shapes.
 */
export function sizeNode(node: DiagramNode, theme: Theme, opts: SizeOptions = {}): SizedNode {
  const padX = opts.paddingX ?? theme.node.paddingX;
  const padY = opts.paddingY ?? theme.node.paddingY;
  const minWidth = opts.minWidth ?? 132;
  const maxWidth = opts.maxWidth ?? 236;
  const content = opts.fixedWidth ? opts.fixedWidth - padX * 2 : maxWidth - padX * 2;

  const label = wrapText(node.label, content, theme.font.label, theme.font.lineHeight, {
    bold: true,
    maxLines: opts.maxLabelLines ?? 3,
  });
  const detail = node.detail
    ? wrapText(node.detail, content, theme.font.detail, theme.font.lineHeight, { maxLines: 2 })
    : null;

  const textWidth = Math.max(label.width, detail?.width ?? 0);
  const w = opts.fixedWidth ?? clamp(Math.ceil(textWidth + padX * 2), minWidth, maxWidth);
  const h =
    Math.ceil(label.height + (detail ? detail.height + 4 : 0) + padY * 2);

  return {
    labelLines: label.lines,
    detailLines: detail?.lines ?? [],
    w,
    h: Math.max(h, 48),
  };
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Shifts everything so the drawing starts at the page padding, adds room for
 * the title, and reports the final canvas size.
 */
export function finalize(
  partial: Omit<Layout, "width" | "height" | "titleHeight" | "degradedFrom"> & {
    degradedFrom?: Layout["degradedFrom"];
  },
  theme: Theme,
): Layout {
  const { nodes, edges, groups, title } = partial;
  // Edges are part of the drawing: a cycle's arcs bow past every node box, and
  // sizing from node boxes alone would crop them.
  const boxes: Rect[] = [
    ...nodes,
    ...groups,
    ...edges.map((e) => pathBounds(e.d)).filter((b): b is Rect => b !== null),
  ];
  const minX = boxes.length ? Math.min(...boxes.map((n) => n.x)) : 0;
  const minY = boxes.length ? Math.min(...boxes.map((n) => n.y)) : 0;
  const maxX = boxes.length ? Math.max(...boxes.map((n) => n.x + n.w)) : 0;
  const maxY = boxes.length ? Math.max(...boxes.map((n) => n.y + n.h)) : 0;

  const titleHeight = title ? theme.font.title * theme.font.lineHeight + TITLE_GAP : 0;
  const dx = PAGE_PADDING - minX;
  const dy = PAGE_PADDING + titleHeight - minY;

  const shiftedNodes = nodes.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy }));
  const shiftedGroups = groups.map((g) => ({ ...g, x: g.x + dx, y: g.y + dy }));
  const shiftedEdges = edges.map((e) => ({
    ...e,
    d: translatePath(e.d, dx, dy),
    labelAt: e.labelAt ? { x: e.labelAt.x + dx, y: e.labelAt.y + dy } : null,
  }));

  const contentWidth = maxX - minX;
  const titleWidth = title ? measureText(title, theme.font.title, true) : 0;

  return {
    width: Math.ceil(Math.max(contentWidth, titleWidth) + PAGE_PADDING * 2),
    height: Math.ceil(maxY - minY + titleHeight + PAGE_PADDING * 2),
    title,
    titleHeight,
    nodes: shiftedNodes,
    edges: shiftedEdges,
    groups: shiftedGroups,
    degradedFrom: partial.degradedFrom ?? null,
  };
}

export function emptyNode(id: string): RenderNode {
  return {
    id,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    shape: "rect",
    accent: 0,
    labelLines: [],
    detailLines: [],
    badge: null,
    align: "center",
  };
}
