import { wrapText } from "@/lib/text";
import { finalize, iconResolver, sizeNode } from "./measure";
import { layoutList } from "./list";
import type { Layout, LayoutContext, RenderGroup, RenderNode } from "./types";

const COLUMN_WIDTH = 236;
const COLUMN_GAP = 24;
const ITEM_GAP = 10;
const PANEL_PAD = 14;

/**
 * One column per group, header card on top, items stacked underneath.
 * Columns are equal width so the eye compares rows, not shapes.
 */
export function layoutComparison(ctx: LayoutContext): Layout {
  const { spec, theme } = ctx;
  const iconOf = iconResolver(ctx);
  const columns = spec.groups.filter((g) => spec.nodes.some((n) => n.group === g.id));

  // A comparison with fewer than two columns is just a list.
  if (columns.length < 2) {
    return { ...layoutList(ctx), degradedFrom: "comparison" };
  }

  const headerHeight = (label: string) =>
    Math.ceil(
      wrapText(label, COLUMN_WIDTH - 2 * PANEL_PAD - 12, theme.font.label, theme.font.lineHeight, {
        bold: true,
        maxLines: 2,
      }).height + 22,
    );

  const nodes: RenderNode[] = [];
  const groups: RenderGroup[] = [];
  let columnHeights: number[] = [];

  // First pass: measure so every column panel can share one height.
  const measured = columns.map((group) => {
    const items = spec.nodes.filter((n) => n.group === group.id);
    const sizes = items.map((n) =>
      sizeNode(n, theme, {
        fixedWidth: COLUMN_WIDTH - PANEL_PAD * 2,
        maxLabelLines: 4,
        icon: Boolean(iconOf(n)),
      }),
    );
    const header = headerHeight(group.label);
    const body = sizes.reduce((sum, s) => sum + s.h, 0) + Math.max(0, sizes.length - 1) * ITEM_GAP;
    return { group, items, sizes, header, body };
  });

  // Headers share one height so the first item in every column starts level.
  const headerBand = Math.max(...measured.map((m) => m.header));
  const panelHeight = headerBand + Math.max(...measured.map((m) => m.body)) + PANEL_PAD * 2 + ITEM_GAP;
  columnHeights = measured.map(() => panelHeight);

  measured.forEach((column, index) => {
    const x = index * (COLUMN_WIDTH + COLUMN_GAP);
    const headerLines = wrapText(
      column.group.label,
      COLUMN_WIDTH - 2 * PANEL_PAD - 12,
      theme.font.label,
      theme.font.lineHeight,
      { bold: true, maxLines: 2 },
    ).lines;

    groups.push({
      id: column.group.id,
      label: "",
      x,
      y: 0,
      w: COLUMN_WIDTH,
      h: columnHeights[index],
      accent: index,
    });

    nodes.push({
      id: `header:${column.group.id}`,
      x: x + PANEL_PAD,
      y: PANEL_PAD,
      w: COLUMN_WIDTH - PANEL_PAD * 2,
      h: headerBand,
      shape: "header",
      shapePoints: null,
      accent: index,
      labelLines: headerLines,
      detailLines: [],
      badge: null,
      icon: null,
      align: "center",
    });

    let y = PANEL_PAD + headerBand + ITEM_GAP;
    column.items.forEach((item, i) => {
      const size = column.sizes[i];
      nodes.push({
        id: item.id,
        x: x + PANEL_PAD,
        y,
        w: size.w,
        h: size.h,
        shape: "rect",
        shapePoints: null,
        accent: index,
        labelLines: size.labelLines,
        detailLines: size.detailLines,
        badge: null,
        icon: iconOf(item),
        align: "left",
      });
      y += size.h + ITEM_GAP;
    });
  });

  // Nodes the model never assigned to a column would otherwise vanish.
  const orphans = spec.nodes.filter((n) => !columns.some((g) => g.id === n.group));
  let orphanY = panelHeight + 24;
  for (const [i, node] of orphans.entries()) {
    const size = sizeNode(node, theme, {
      fixedWidth: COLUMN_WIDTH - PANEL_PAD * 2,
      icon: Boolean(iconOf(node)),
    });
    nodes.push({
      id: node.id,
      x: 0,
      y: orphanY,
      w: size.w,
      h: size.h,
      shape: "rect",
      shapePoints: null,
      accent: columns.length + i,
      labelLines: size.labelLines,
      detailLines: size.detailLines,
      badge: null,
      icon: iconOf(node),
      align: "left",
    });
    orphanY += size.h + ITEM_GAP;
  }

  return finalize({ title: spec.title, nodes, edges: [], groups }, theme);
}
