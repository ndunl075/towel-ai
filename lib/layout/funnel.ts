import type { Point } from "@/lib/geom";
import { wrapText } from "@/lib/text";
import { finalize } from "./measure";
import type { Caption, Layout, LayoutContext, RenderNode } from "./types";

const TOP_WIDTH = 520;
const NARROWEST = 0.34;
const BAND_GAP = 8;
const MIN_BAND_HEIGHT = 62;

/**
 * Stages narrowing top to bottom, each a trapezoid whose width encodes its
 * position in the funnel. Stage order is spec order - the model is told to
 * list the widest stage first.
 */
export function layoutFunnel(ctx: LayoutContext): Layout {
  const { spec, theme } = ctx;
  const count = spec.nodes.length;
  if (count === 0) return finalize({ title: spec.title, nodes: [], edges: [], groups: [] }, theme);
  if (count === 1) return singleBand(ctx);

  const widthAt = (i: number) => TOP_WIDTH * (1 - (1 - NARROWEST) * (i / count));

  const nodes: RenderNode[] = [];
  const captions: Caption[] = [];
  let y = 0;

  spec.nodes.forEach((node, i) => {
    const topWidth = widthAt(i);
    const bottomWidth = widthAt(i + 1);
    // Text has to fit the narrow end, not the wide one.
    const usable = bottomWidth - 36;
    const label = wrapText(node.label, usable, theme.font.label, theme.font.lineHeight, {
      metric: theme.font.metric,
      bold: true,
      maxLines: 2,
    });
    const detail = node.detail
      ? wrapText(node.detail, usable, theme.font.detail, theme.font.lineHeight, {
          maxLines: 1,
          metric: theme.font.metric,
        })
      : null;
    const height = Math.max(
      MIN_BAND_HEIGHT,
      Math.ceil(label.height + (detail ? detail.height + 4 : 0) + 28),
    );

    const points: Point[] = [
      { x: -topWidth / 2, y },
      { x: topWidth / 2, y },
      { x: bottomWidth / 2, y: y + height },
      { x: -bottomWidth / 2, y: y + height },
    ];

    nodes.push({
      id: node.id,
      x: -topWidth / 2,
      y,
      w: topWidth,
      h: height,
      shape: "polygon",
      shapePoints: points,
      accent: i,
      labelLines: label.lines,
      detailLines: detail?.lines ?? [],
      badge: null,
      // A trapezoid band is centred text on a shape that changes width per row;
      // a lead slot would sit over the taper. Funnels carry no icons.
      icon: null,
      align: "center",
    });

    captions.push({
      id: `stage-${node.id}`,
      x: topWidth / 2 + 16,
      y: y + height / 2 + 4,
      text: `Stage ${i + 1}`,
      accent: i,
      size: "detail",
      anchor: "start",
      weight: 600,
      uppercase: true,
    });

    y += height + BAND_GAP;
  });

  return finalize({ title: spec.title, nodes, edges: [], groups: [], captions }, theme);
}

/** One stage is not a funnel; draw it as a plain band rather than a sliver. */
function singleBand(ctx: LayoutContext): Layout {
  const { spec, theme } = ctx;
  const node = spec.nodes[0];
  const label = wrapText(node.label, TOP_WIDTH - 40, theme.font.label, theme.font.lineHeight, {
    metric: theme.font.metric,
    bold: true,
    maxLines: 2,
  });
  const height = Math.max(MIN_BAND_HEIGHT, Math.ceil(label.height + 28));

  return finalize(
    {
      title: spec.title,
      nodes: [
        {
          id: node.id,
          x: -TOP_WIDTH / 2,
          y: 0,
          w: TOP_WIDTH,
          h: height,
          shape: "rect",
          shapePoints: null,
          accent: 0,
          labelLines: label.lines,
          detailLines: [],
          badge: null,
          icon: null,
          align: "center",
        },
      ],
      edges: [],
      groups: [],
    },
    theme,
  );
}
