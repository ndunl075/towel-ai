import type { DiagramSpec, DiagramType } from "@/lib/spec";
import type { Theme } from "@/lib/theme";
import type { Point } from "@/lib/geom";

export type NodeShape = "rect" | "pill" | "circle" | "header" | "banner";

export interface RenderNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  shape: NodeShape;
  accent: number;
  labelLines: string[];
  detailLines: string[];
  /** Rendered above the label, e.g. step numbers in a list. */
  badge: string | null;
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

export interface Layout {
  width: number;
  height: number;
  title: string | null;
  titleHeight: number;
  nodes: RenderNode[];
  edges: RenderEdge[];
  groups: RenderGroup[];
  /** Set when the requested type had no layout fn and we degraded to another. */
  degradedFrom: DiagramType | null;
}

export interface LayoutContext {
  spec: DiagramSpec;
  theme: Theme;
}

export type LayoutFn = (ctx: LayoutContext) => Layout;

export const PAGE_PADDING = 40;
export const TITLE_GAP = 28;
