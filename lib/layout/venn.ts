import type { DiagramNode } from "@/lib/spec";
import { finalize, sizeNode } from "./measure";
import { layoutComparison } from "./comparison";
import type { Caption, Decoration, Layout, LayoutContext, RenderNode } from "./types";

const RADIUS = 180;
/** Centre-to-centre distance as a fraction of the radius. */
const SPREAD = 1.08;

/**
 * Two or three overlapping sets.
 *
 * Convention, mirrored in the extraction prompt: a node carrying a `group` sits
 * in that set's exclusive lobe; a node with no group is shared by every set and
 * sits in the middle. The spec has one group per node, so this is the only way
 * shared membership can be expressed without a second field the model would
 * have to get right.
 */
export function layoutVenn(ctx: LayoutContext): Layout {
  const { spec, theme } = ctx;
  const sets = spec.groups.filter((g) => spec.nodes.some((n) => n.group === g.id)).slice(0, 3);

  // One circle is not a venn, and four legible circles do not exist.
  if (sets.length < 2) {
    return { ...layoutComparison(ctx), degradedFrom: "venn" };
  }

  const centres = circleCentres(sets.length);
  const lobeDistance = exclusiveLobeDistance(sets.length);

  const decorations: Decoration[] = centres.map((c, i) => ({
    kind: "circle",
    id: `set-${sets[i].id}`,
    cx: c.x,
    cy: c.y,
    r: RADIUS,
    accent: i,
    fill: "tint",
  }));

  const captions: Caption[] = centres.map((c, i) => {
    const unit = normalize(c);
    // Outside the rim. Inside looks more classical but collides with whatever
    // sits in that set's exclusive lobe, which is on the same radial line.
    const distance = magnitude(c) + RADIUS + 14;
    return {
      id: `label-${sets[i].id}`,
      x: unit.x * distance,
      y: unit.y * distance + 5,
      text: sets[i].label,
      accent: i,
      size: "label",
      anchor: "middle",
      weight: 650,
      uppercase: true,
    };
  });

  const nodes: RenderNode[] = [];

  sets.forEach((set, i) => {
    const unit = normalize(centres[i]);
    stack(
      spec.nodes.filter((n) => n.group === set.id),
      { x: unit.x * lobeDistance, y: unit.y * lobeDistance },
      i,
    );
  });

  // Anything not in a declared set is shared by all of them.
  const shared = spec.nodes.filter((n) => !sets.some((s) => s.id === n.group));
  stack(shared, { x: 0, y: sets.length === 2 ? 0 : RADIUS * 0.16 }, 0);

  function stack(members: DiagramNode[], at: { x: number; y: number }, accent: number) {
    if (members.length === 0) return;
    const sized = members.map((n) =>
      sizeNode(n, theme, {
        maxWidth: 134,
        minWidth: 92,
        maxLabelLines: 3,
        paddingX: 12,
        paddingY: 9,
      }),
    );
    const gap = 6;
    const total = sized.reduce((sum, s) => sum + s.h, 0) + (sized.length - 1) * gap;
    let y = at.y - total / 2;

    members.forEach((node, k) => {
      const size = sized[k];
      nodes.push({
        id: node.id,
        x: at.x - size.w / 2,
        y,
        w: size.w,
        h: size.h,
        shape: "pill",
        shapePoints: null,
        accent,
        labelLines: size.labelLines,
        detailLines: size.detailLines,
        badge: null,
        // Venn pills are packed to fit inside a lobe; widening them for a lead
        // slot pushes members out through the circle. No icons here either.
        icon: null,
        align: "center",
      });
      y += size.h + gap;
    });
  }

  return finalize({ title: spec.title, nodes, edges: [], groups: [], decorations, captions }, theme);
}

/** Two circles side by side; three in the usual triangle. */
function circleCentres(count: number): { x: number; y: number }[] {
  if (count === 2) {
    const offset = (RADIUS * SPREAD) / 2;
    return [
      { x: -offset, y: 0 },
      { x: offset, y: 0 },
    ];
  }
  const d = centreDistance();
  return [
    { x: 0, y: -d },
    { x: -d * Math.cos(Math.PI / 6), y: d * 0.5 },
    { x: d * Math.cos(Math.PI / 6), y: d * 0.5 },
  ];
}

function centreDistance(): number {
  return (RADIUS * SPREAD) / 2;
}

/**
 * Distance from the middle to the centre of a set's exclusive lobe.
 *
 * Placing nodes at the circle's own centre puts them in the overlap, which is
 * exactly the region they do not belong to. Solving for where the neighbouring
 * circles stop reaching, then taking the midpoint of what is left, is the only
 * way this stays right as the radius and spread change.
 */
function exclusiveLobeDistance(count: number): number {
  const d = count === 2 ? (RADIUS * SPREAD) / 2 : centreDistance();
  const outerEdge = d + RADIUS;

  if (count === 2) {
    // The other circle reaches to RADIUS - d along this direction.
    return (Math.max(RADIUS - d, 0) + outerEdge) / 2;
  }

  // Neighbours sit 120 degrees away: t^2 + t*d + d^2 - R^2 = 0.
  const discriminant = 4 * RADIUS * RADIUS - 3 * d * d;
  const innerEdge = discriminant <= 0 ? 0 : (-d + Math.sqrt(discriminant)) / 2;
  return (innerEdge + outerEdge) / 2;
}

function magnitude(p: { x: number; y: number }): number {
  return Math.hypot(p.x, p.y) || 1;
}

function normalize(p: { x: number; y: number }): { x: number; y: number } {
  const len = magnitude(p);
  return { x: p.x / len, y: p.y / len };
}
