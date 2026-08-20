import type { DiagramNode } from "@/lib/spec";
import type { Theme } from "@/lib/theme";
import { measureText, wrapText } from "@/lib/text";
import { pathBounds, translatePath, type Rect } from "@/lib/geom";
import {
  PAGE_PADDING,
  TITLE_GAP,
  type Caption,
  type Decoration,
  type Layout,
  type LayoutContext,
  type RenderNode,
} from "./types";

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
  /** Reserve the lead slot for an icon, the way a badge occupies one. */
  icon?: boolean;
}

/** Width of the lead slot an icon or a badge sits in. */
export const LEAD_INSET = 30;

/**
 * A node box is sized to its own text, clamped into a band so a diagram of
 * mixed-length labels still reads as a set of related shapes.
 */
export function sizeNode(node: DiagramNode, theme: Theme, opts: SizeOptions = {}): SizedNode {
  const padX = opts.paddingX ?? theme.node.paddingX;
  const padY = opts.paddingY ?? theme.node.paddingY;
  const minWidth = opts.minWidth ?? 132;
  const maxWidth = opts.maxWidth ?? 236;
  // The icon eats into the text column, so wrapping has to know about it too -
  // otherwise a fixed-width card overflows instead of wrapping a line earlier.
  const lead = opts.icon ? LEAD_INSET : 0;
  const content = (opts.fixedWidth ? opts.fixedWidth : maxWidth) - padX * 2 - lead;

  const label = wrapText(node.label, content, theme.font.label, theme.font.lineHeight, {
    bold: true,
    maxLines: opts.maxLabelLines ?? 3,
    metric: theme.font.metric,
  });
  const detail = node.detail
    ? wrapText(node.detail, content, theme.font.detail, theme.font.lineHeight, {
        maxLines: 2,
        metric: theme.font.metric,
      })
    : null;

  const textWidth = Math.max(label.width, detail?.width ?? 0);
  const w = opts.fixedWidth ?? clamp(Math.ceil(textWidth + padX * 2 + lead), minWidth, maxWidth);
  const h =
    Math.ceil(label.height + (detail ? detail.height + 4 : 0) + padY * 2);

  return {
    labelLines: label.lines,
    detailLines: detail?.lines ?? [],
    w,
    h: Math.max(h, 48),
  };
}

/**
 * Icons are opt-in per document, so a layout must ask rather than assume. This
 * is the one place that decides what "no icons" means: null everywhere.
 */
export function iconResolver(ctx: LayoutContext): (node: DiagramNode) => string | null {
  return (node) => ctx.iconFor?.(node) ?? null;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Shifts everything so the drawing starts at the page padding, adds room for
 * the title, and reports the final canvas size.
 */
export function finalize(
  partial: Omit<
    Layout,
    "width" | "height" | "titleHeight" | "degradedFrom" | "decorations" | "captions"
  > & {
    degradedFrom?: Layout["degradedFrom"];
    decorations?: Decoration[];
    captions?: Caption[];
    /** Rects that claim space without drawing anything. */
    extraBounds?: Rect[];
  },
  theme: Theme,
): Layout {
  const { nodes, edges, groups, title } = partial;
  const decorations = partial.decorations ?? [];
  const captions = partial.captions ?? [];
  // Edges and decorations are part of the drawing: a cycle's arcs bow past
  // every node box, and sizing from node boxes alone would crop them.
  const boxes: Rect[] = [
    ...nodes,
    ...groups,
    ...edges.map((e) => pathBounds(e.d)).filter((b): b is Rect => b !== null),
    ...decorations.map(decorationBounds),
    ...captions.map((c) => captionBounds(c, theme)),
    ...(partial.extraBounds ?? []),
  ];
  const minX = boxes.length ? Math.min(...boxes.map((n) => n.x)) : 0;
  const minY = boxes.length ? Math.min(...boxes.map((n) => n.y)) : 0;
  const maxX = boxes.length ? Math.max(...boxes.map((n) => n.x + n.w)) : 0;
  const maxY = boxes.length ? Math.max(...boxes.map((n) => n.y + n.h)) : 0;

  const titleHeight = title ? theme.font.title * theme.font.lineHeight + TITLE_GAP : 0;
  const dx = PAGE_PADDING - minX;
  const dy = PAGE_PADDING + titleHeight - minY;

  const shiftedNodes = nodes.map((n) => ({
    ...n,
    x: n.x + dx,
    y: n.y + dy,
    shapePoints: n.shapePoints?.map((p) => ({ x: p.x + dx, y: p.y + dy })) ?? null,
  }));
  const shiftedGroups = groups.map((g) => ({ ...g, x: g.x + dx, y: g.y + dy }));
  const shiftedEdges = edges.map((e) => ({
    ...e,
    d: translatePath(e.d, dx, dy),
    labelAt: e.labelAt ? { x: e.labelAt.x + dx, y: e.labelAt.y + dy } : null,
  }));

  const shiftedDecorations = decorations.map((d) =>
    d.kind === "circle"
      ? { ...d, cx: d.cx + dx, cy: d.cy + dy }
      : { ...d, x1: d.x1 + dx, y1: d.y1 + dy, x2: d.x2 + dx, y2: d.y2 + dy },
  );
  const shiftedCaptions = captions.map((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));

  const contentWidth = maxX - minX;
  const titleWidth = title ? measureText(title, theme.font.title, true, theme.font.metric) : 0;

  return {
    width: Math.ceil(Math.max(contentWidth, titleWidth) + PAGE_PADDING * 2),
    height: Math.ceil(maxY - minY + titleHeight + PAGE_PADDING * 2),
    title,
    titleHeight,
    nodes: shiftedNodes,
    edges: shiftedEdges,
    groups: shiftedGroups,
    decorations: shiftedDecorations,
    captions: shiftedCaptions,
    degradedFrom: partial.degradedFrom ?? null,
  };
}

/** Approximate, but it only has to stop a caption being cropped at the edge. */
function captionBounds(caption: Caption, theme: Theme): Rect {
  const size = caption.size === "label" ? theme.font.label : theme.font.detail;
  const width =
    measureText(caption.text, size, caption.weight >= 600, theme.font.metric) *
    (caption.uppercase ? 1.12 : 1);
  const x =
    caption.anchor === "middle"
      ? caption.x - width / 2
      : caption.anchor === "end"
        ? caption.x - width
        : caption.x;
  return { x, y: caption.y - size, w: width, h: size * 1.4 };
}

function decorationBounds(d: Decoration): Rect {
  if (d.kind === "circle") {
    return { x: d.cx - d.r, y: d.cy - d.r, w: d.r * 2, h: d.r * 2 };
  }
  const x = Math.min(d.x1, d.x2);
  const y = Math.min(d.y1, d.y2);
  return { x, y, w: Math.abs(d.x2 - d.x1), h: Math.abs(d.y2 - d.y1) };
}
