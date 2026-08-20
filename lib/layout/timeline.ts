import { finalize, iconResolver, sizeNode } from "./measure";
import type { Caption, Decoration, Layout, LayoutContext, RenderNode } from "./types";

const CARD_WIDTH = 190;
const COLUMN_GAP = 42;
/** Vertical distance from the spine to the near edge of a card. */
const STEM = 34;

/**
 * A horizontal spine with events alternating above and below it.
 *
 * Alternating halves the width a timeline needs and stops long labels from
 * colliding, which is what kills the naive single-row version.
 */
export function layoutTimeline(ctx: LayoutContext): Layout {
  const { spec, theme } = ctx;
  const count = spec.nodes.length;
  if (count === 0) return finalize({ title: spec.title, nodes: [], edges: [], groups: [] }, theme);

  const iconOf = iconResolver(ctx);
  const sized = spec.nodes.map((n) =>
    sizeNode(n, theme, { fixedWidth: CARD_WIDTH, maxLabelLines: 3, icon: Boolean(iconOf(n)) }),
  );
  const tallest = Math.max(...sized.map((s) => s.h));
  const step = CARD_WIDTH + COLUMN_GAP;

  const spineY = 0;
  const nodes: RenderNode[] = [];
  const decorations: Decoration[] = [];
  const captions: Caption[] = [];

  spec.nodes.forEach((node, i) => {
    const size = sized[i];
    const x = i * step;
    const cx = x + CARD_WIDTH / 2;
    const above = i % 2 === 0;
    const y = above ? spineY - STEM - size.h : spineY + STEM;

    nodes.push({
      id: node.id,
      x,
      y,
      w: CARD_WIDTH,
      h: size.h,
      shape: "rect",
      shapePoints: null,
      accent: i,
      labelLines: size.labelLines,
      detailLines: size.detailLines,
      badge: null,
      icon: iconOf(node),
      align: "center",
    });

    // Stem from the spine to the card, plus the dot that marks the moment.
    decorations.push({
      kind: "line",
      id: `stem-${node.id}`,
      x1: cx,
      y1: spineY,
      x2: cx,
      y2: above ? y + size.h : y,
      accent: i,
      dashed: false,
    });
    decorations.push({
      kind: "circle",
      id: `dot-${node.id}`,
      cx,
      cy: spineY,
      r: 6,
      accent: i,
      fill: "solid",
    });

    captions.push({
      id: `ordinal-${node.id}`,
      x: cx,
      // Sits on the opposite side of the spine from the card.
      y: above ? spineY + 26 : spineY - 16,
      text: String(i + 1),
      accent: i,
      size: "detail",
      anchor: "middle",
      weight: 650,
      uppercase: false,
    });
  });

  decorations.unshift({
    kind: "line",
    id: "spine",
    x1: -18,
    y1: spineY,
    x2: (count - 1) * step + CARD_WIDTH + 18,
    y2: spineY,
    accent: null,
    dashed: false,
  });

  // Reserve the full band on both sides so a short first card cannot make the
  // page height depend on which side the tallest card happens to land.
  const band = {
    x: -18,
    y: spineY - STEM - tallest,
    w: (count - 1) * step + CARD_WIDTH + 36,
    h: (STEM + tallest) * 2,
  };

  return finalize(
    {
      title: spec.title,
      nodes,
      edges: [],
      groups: [],
      decorations,
      captions,
      extraBounds: [band],
    },
    theme,
  );
}
