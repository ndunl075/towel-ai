import type { DiagramNode, DiagramSpec, DiagramType } from "@/lib/spec";
import type { Theme } from "@/lib/theme";
import type { Point } from "@/lib/geom";

export type NodeShape = "rect" | "pill" | "circle" | "header" | "banner" | "polygon";

export interface RenderNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  shape: NodeShape;
  /** Outline used instead of the rect when `shape` is "polygon" (funnel bands). */
  shapePoints: Point[] | null;
  accent: number;
  labelLines: string[];
  detailLines: string[];
  /** Rendered above the label, e.g. step numbers in a list. */
  badge: string | null;
  /** Icon id from lib/icons, drawn in the lead slot. Wins over `badge`. */
  icon: string | null;
  align: "center" | "left";
}

export interface RenderEdge {
  id: string;
  from: string;
  to: string;
  d: string;
  label: string | null;
  labelAt: Point | null;
  accent: number | null;
  arrow: boolean;
}

export interface RenderGroup {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  accent: number;
}

/**
 * Chrome that is neither a node nor an edge: the timeline spine, the circles
 * of a venn, the tick marks under a funnel. Kept as explicit geometry rather
 * than raw path strings so the final origin shift stays trivial and exact.
 */
export type Decoration =
  | {
      kind: "circle";
      id: string;
      cx: number;
      cy: number;
      r: number;
      accent: number;
      /** "tint" is a translucent wash, "solid" a marker dot, "none" outline only. */
      fill: "tint" | "solid" | "none";
    }
  | {
      kind: "line";
      id: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      accent: number | null;
      dashed: boolean;
    };

/** Free-standing text outside any node - timeline dates, venn set names. */
export interface Caption {
  id: string;
  x: number;
  y: number;
  text: string;
  accent: number | null;
  size: "label" | "detail";
  anchor: "start" | "middle" | "end";
  weight: number;
  uppercase: boolean;
}

export interface Layout {
  width: number;
  height: number;
  title: string | null;
  titleHeight: number;
  nodes: RenderNode[];
  edges: RenderEdge[];
  groups: RenderGroup[];
  decorations: Decoration[];
  captions: Caption[];
  /** Set when the requested type had no layout fn and we degraded to another. */
  degradedFrom: DiagramType | null;
}

export interface LayoutContext {
  spec: DiagramSpec;
  theme: Theme;
  /**
   * Resolves a node's icon. Supplied by layoutSpec rather than each layout so
   * icons stay off unless the document asks for them, and so sizing and
   * drawing agree about which nodes carry one.
   */
  iconFor?: (node: DiagramNode) => string | null;
}

export type LayoutFn = (ctx: LayoutContext) => Layout;

export const PAGE_PADDING = 40;
export const TITLE_GAP = 28;
