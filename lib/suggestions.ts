import { layoutSpec, type Layout } from "./layout";
import { IMPLEMENTED_TYPES, type DiagramNode, type DiagramSpec, type DiagramType } from "./spec";
import type { Theme } from "./theme";

/**
 * "Multiple visual suggestions per text", done without spending a model call
 * per suggestion.
 *
 * The architecture note originally scoped this as parallel extraction with
 * different type hints. That buys genuinely different *content* per type, at
 * one call each - and this is a bring-your-own-key app whose extract route is
 * rate limited, so eight parallel calls to fill a preview strip is the wrong
 * default. Layout is already deterministic and already re-runs on the spec we
 * hold, so every alternative can be rendered for free and the user picks by
 * looking rather than by guessing from a list of type names.
 *
 * Re-extraction is still the better fix when the *text* was misread rather
 * than mislaid out; adopting a suggestion is free, and "Re-extract as <type>"
 * upgrades it with one call once the user has decided which shape they want.
 */
export interface Suggestion {
  type: DiagramType;
  layout: Layout;
  /** 0-1. Ranks the strip; ties fall back to the declared type order. */
  score: number;
  /** Short phrase naming the structure that earned the score. */
  reason: string;
  /**
   * False when the layout engine refused the type and degraded to another -
   * the spec genuinely cannot be drawn this way.
   */
  fits: boolean;
}

interface Shape {
  nodes: number;
  edges: number;
  /** Groups that actually have members; empty groups shape nothing. */
  liveGroups: number;
  /** Fraction of nodes carrying a detail line. */
  detailRatio: number;
  /** Fraction of details that read as a point in time. */
  timeRatio: number;
  maxIn: number;
  maxOut: number;
  hasCycle: boolean;
  /** Every node has at most one in and one out edge, and it is all one run. */
  isChain: boolean;
  /**
   * Three or more details parse as numbers that never rise. This is what a
   * funnel looks like in the data, and no other type shares the signal.
   */
  narrowing: boolean;
  /**
   * Nodes left ungrouped while named groups exist. Per the venn convention a
   * group-less node is shared by every set, so this is the overlap - and it is
   * exactly what a comparison has no column to put.
   */
  sharedNodes: number;
  /** Long labels mean prose was pasted, not steps. */
  proseLabels: boolean;
}

/**
 * A point in time, not merely a word that can appear near one. "Five a week"
 * is a rate and must not read as a date, so a bare unit never counts - it has
 * to be quantified, or be a named month, quarter or year.
 */
const COUNT = "\\d+|one|two|three|four|five|six|seven|eight|nine|ten";
const TIME = new RegExp(
  [
    "\\b(19|20)\\d{2}\\b",
    "\\bq[1-4]\\b",
    "\\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\b",
    `\\b(day|week|month|year|quarter|phase|stage|sprint|step)\\s+(${COUNT})\\b`,
    `\\b(${COUNT})\\s+(to\\s+\\w+\\s+)?(days?|weeks?|months?|years?|quarters?|sprints?)\\b`,
    "\\b(today|tomorrow|yesterday|later|finally|eventually|unscheduled)\\b",
  ].join("|"),
  "i",
);

export function suggestTypes(
  spec: DiagramSpec,
  theme: Theme,
  /** Passed straight through, so a tile previews what the canvas would draw. */
  iconFor?: (node: DiagramNode) => string | null,
): Suggestion[] {
  const shape = describe(spec);

  const suggestions = IMPLEMENTED_TYPES.map((type) => {
    const layout = layoutSpec({ ...spec, type }, theme, iconFor);
    const { score, reason } = rate(type, shape);
    // A degraded layout is not this type at all, so it never outranks one that
    // genuinely fits, whatever the structural score said.
    const fits = layout.degradedFrom === null;
    return { type, layout, score: fits ? score : 0, reason, fits };
  });

  return suggestions.sort((a, b) => {
    if (a.fits !== b.fits) return a.fits ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return IMPLEMENTED_TYPES.indexOf(a.type) - IMPLEMENTED_TYPES.indexOf(b.type);
  });
}

function describe(spec: DiagramSpec): Shape {
  const nodes = spec.nodes.length;
  const edges = spec.edges.length;

  const inDeg = new Map<string, number>();
  const outDeg = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const node of spec.nodes) {
    inDeg.set(node.id, 0);
    outDeg.set(node.id, 0);
    adjacency.set(node.id, []);
  }
  for (const edge of spec.edges) {
    outDeg.set(edge.from, (outDeg.get(edge.from) ?? 0) + 1);
    inDeg.set(edge.to, (inDeg.get(edge.to) ?? 0) + 1);
    adjacency.get(edge.from)?.push(edge.to);
  }

  const ins = [...inDeg.values()];
  const outs = [...outDeg.values()];
  const details = spec.nodes.map((n) => n.detail).filter((d): d is string => Boolean(d));
  const liveGroups = spec.groups.filter((g) => spec.nodes.some((n) => n.group === g.id)).length;
  const maxIn = ins.length ? Math.max(...ins) : 0;
  const maxOut = outs.length ? Math.max(...outs) : 0;

  return {
    nodes,
    edges,
    liveGroups,
    detailRatio: nodes ? details.length / nodes : 0,
    timeRatio: details.length ? details.filter((d) => TIME.test(d)).length / details.length : 0,
    maxIn,
    maxOut,
    hasCycle: hasCycle(spec, adjacency),
    isChain: nodes > 1 && edges === nodes - 1 && maxIn <= 1 && maxOut <= 1,
    narrowing: isNarrowing(spec.nodes.map((n) => n.detail)),
    sharedNodes: liveGroups >= 2 ? spec.nodes.filter((n) => !n.group).length : 0,
    proseLabels:
      nodes > 0 &&
      spec.nodes.reduce((sum, n) => sum + n.label.length, 0) / nodes > 34,
  };
}

/** Leading magnitude of a detail: "42,000 a month" -> 42000, "410" -> 410. */
function magnitude(detail: string): number | null {
  const cleaned = detail.replace(/[$£€%]/g, "");
  const match = /^[^\d-]*(-?[\d,]*\.?\d+)/.exec(cleaned);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function isNarrowing(details: (string | null)[]): boolean {
  const values = details.map((d) => (d ? magnitude(d) : null));
  const present = values.filter((v): v is number => v !== null);
  // Needs to be the shape of most of the diagram, not two rows that happen to
  // hold numbers.
  if (present.length < 3 || present.length < values.length - 1) return false;
  for (let i = 1; i < present.length; i++) {
    if (present[i] > present[i - 1]) return false;
  }
  return present[0] > present[present.length - 1];
}

function hasCycle(spec: DiagramSpec, adjacency: Map<string, string[]>): boolean {
  const WHITE = 0,
    GREY = 1,
    BLACK = 2;
  const colour = new Map<string, number>();
  for (const node of spec.nodes) colour.set(node.id, WHITE);

  // Iterative DFS; a grey neighbour is a back edge, so a cycle.
  for (const start of spec.nodes) {
    if (colour.get(start.id) !== WHITE) continue;
    const stack: { id: string; i: number }[] = [{ id: start.id, i: 0 }];
    colour.set(start.id, GREY);
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const neighbours = adjacency.get(frame.id) ?? [];
      if (frame.i >= neighbours.length) {
        colour.set(frame.id, BLACK);
        stack.pop();
        continue;
      }
      const next = neighbours[frame.i++];
      const state = colour.get(next);
      if (state === GREY) return true;
      if (state === WHITE) {
        colour.set(next, GREY);
        stack.push({ id: next, i: 0 });
      }
    }
  }
  return false;
}

/**
 * Structural fitness only; whether the layout accepted the spec is separate.
 *
 * The split that matters here is what each layout actually reads. flowchart
 * and hierarchy are edge-driven and say nothing without edges. cycle, timeline
 * and funnel are *order*-driven - they build their geometry from the order the
 * nodes arrive in, which is why the cycle fixture carries no edges at all and
 * is still a perfectly good ring. comparison and venn are group-driven.
 */
function rate(type: DiagramType, s: Shape): { score: number; reason: string } {
  const ordered = s.nodes >= 3 && s.edges === 0;

  switch (type) {
    case "flowchart":
      if (s.edges === 0) return { score: 0.15, reason: "no relationships to draw" };
      if (s.maxOut > 1) return { score: 0.95, reason: "branching steps" };
      return { score: 0.75, reason: "directed steps" };

    case "hierarchy":
      if (s.edges === 0) return { score: 0.1, reason: "no relationships to draw" };
      if (s.hasCycle) return { score: 0.2, reason: "a loop is not a tree" };
      if (s.maxIn <= 1 && s.maxOut > 1) return { score: 0.9, reason: "one parent per node" };
      return { score: 0.5, reason: "has relationships" };

    case "cycle":
      if (s.hasCycle) return { score: 1, reason: "returns to the start" };
      if (s.maxOut > 1) return { score: 0.1, reason: "branches instead of looping" };
      if (s.proseLabels) return { score: 0.2, reason: "prose, not steps" };
      if (ordered && s.nodes <= 8) return { score: 0.7, reason: "steps that could close a loop" };
      if (s.isChain && s.nodes >= 3) return { score: 0.5, reason: "a single run of steps" };
      return { score: 0.15, reason: "nothing loops back" };

    case "comparison":
      if (s.liveGroups < 2) return { score: 0, reason: "needs two or more groups" };
      // Edges mean the groups feed each other, which is a flow, not a weigh-up.
      if (s.edges > 0) return { score: 0.55, reason: "grouped, but the parts connect" };
      // Columns have nowhere to put a node that belongs to every group.
      if (s.sharedNodes > 0) return { score: 0.6, reason: "some parts sit in no column" };
      return { score: 0.95, reason: `${s.liveGroups} groups to weigh` };

    case "venn":
      if (s.liveGroups > 3) return { score: 0.3, reason: "too many sets to read" };
      if (s.liveGroups < 2) return { score: 0, reason: "needs two or three groups" };
      if (s.edges > 0) return { score: 0.45, reason: "sets exist, but the parts connect" };
      if (s.sharedNodes > 0) return { score: 0.95, reason: "sets with shared members" };
      return { score: 0.8, reason: `${s.liveGroups} sets that can overlap` };

    case "timeline":
      if (s.narrowing) return { score: 0.3, reason: "counts, not times" };
      if (s.timeRatio > 0.5) return { score: 0.95, reason: "details read as dates" };
      if (s.detailRatio > 0.5) return { score: 0.6, reason: "every step carries a detail" };
      if (s.proseLabels) return { score: 0.2, reason: "prose, not events" };
      if (ordered) return { score: 0.45, reason: "steps in a fixed order" };
      if (s.isChain) return { score: 0.4, reason: "a single run of steps" };
      return { score: 0.2, reason: "no times to anchor to" };

    case "funnel":
      if (s.narrowing) return { score: 1, reason: "counts that narrow at each stage" };
      if (s.hasCycle) return { score: 0.1, reason: "stages that loop do not narrow" };
      if (s.nodes < 3 || s.nodes > 7) return { score: 0.2, reason: "not a narrowing sequence" };
      if (s.proseLabels) return { score: 0.2, reason: "prose, not stages" };
      if (ordered || s.isChain) return { score: 0.6, reason: "few enough stages to stack" };
      return { score: 0.2, reason: "not a narrowing sequence" };

    case "list":
      // Always correct, never interesting. Ranks last unless nothing else fits.
      if (s.proseLabels) return { score: 0.9, reason: "prose reads best as a list" };
      if (s.edges === 0 && s.liveGroups === 0) return { score: 0.5, reason: "no structure to draw" };
      return { score: 0.25, reason: "always readable" };
  }
}
