import { z } from "zod";

/**
 * The diagram spec is the single source of truth. The LLM produces it, the
 * layout engine consumes it, the editor mutates it, and the renderer draws it.
 * Nothing downstream of extraction ever calls a model.
 */

export const DIAGRAM_TYPES = [
  "flowchart",
  "cycle",
  "hierarchy",
  "timeline",
  "comparison",
  "funnel",
  "venn",
  "list",
] as const;

export type DiagramType = (typeof DIAGRAM_TYPES)[number];

/** Types with a real layout function today. Everything else degrades to `list`. */
export const IMPLEMENTED_TYPES: DiagramType[] = [
  "flowchart",
  "cycle",
  "hierarchy",
  "comparison",
  "list",
];

export const NodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** Optional supporting line rendered under the label. */
  detail: z.string().nullable(),
  /** Id of the group this node belongs to, if any. */
  group: z.string().nullable(),
});

export const EdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string().nullable(),
});

export const GroupSchema = z.object({
  id: z.string(),
  label: z.string(),
});

export const DiagramSpecSchema = z.object({
  type: z.enum(DIAGRAM_TYPES),
  title: z.string().nullable(),
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
  groups: z.array(GroupSchema),
});

export type DiagramNode = z.infer<typeof NodeSchema>;
export type DiagramEdge = z.infer<typeof EdgeSchema>;
export type DiagramGroup = z.infer<typeof GroupSchema>;
export type DiagramSpec = z.infer<typeof DiagramSpecSchema>;

/** Cheap unique-ish id for nodes created in the editor. */
export function makeId(prefix: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  for (let i = 1; ; i++) {
    const id = `${prefix}${i}`;
    if (!used.has(id)) return id;
  }
}

/**
 * Repairs a spec that is schema-valid but structurally incoherent: dangling
 * edge endpoints, duplicate ids, self-loops, nodes pointing at missing groups.
 * A model that returns an edge to a node it never declared should not crash
 * the layout engine.
 */
export function normalizeSpec(spec: DiagramSpec): DiagramSpec {
  const seen = new Set<string>();
  const nodes: DiagramNode[] = [];
  for (const node of spec.nodes) {
    const id = node.id.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    nodes.push({
      id,
      label: node.label.trim() || id,
      detail: node.detail?.trim() ? node.detail.trim() : null,
      group: node.group?.trim() ? node.group.trim() : null,
    });
  }

  const groupIds = new Set<string>();
  const groups: DiagramGroup[] = [];
  for (const group of spec.groups) {
    const id = group.id.trim();
    if (!id || groupIds.has(id)) continue;
    groupIds.add(id);
    groups.push({ id, label: group.label.trim() || id });
  }

  // A node may name a group that was never declared - declare it for them.
  for (const node of nodes) {
    if (node.group && !groupIds.has(node.group)) {
      groupIds.add(node.group);
      groups.push({ id: node.group, label: node.group });
    }
  }

  const edgeKeys = new Set<string>();
  const edges: DiagramEdge[] = [];
  for (const edge of spec.edges) {
    const from = edge.from.trim();
    const to = edge.to.trim();
    if (!seen.has(from) || !seen.has(to) || from === to) continue;
    const key = `${from} ${to}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    edges.push({ from, to, label: edge.label?.trim() ? edge.label.trim() : null });
  }

  return {
    type: spec.type,
    title: spec.title?.trim() ? spec.title.trim() : null,
    nodes,
    edges,
    groups,
  };
}

/** Fallback used when extraction fails entirely - never render a broken graph. */
export function listSpecFromText(text: string): DiagramSpec {
  const items = text
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((line) => line.replace(/^\s*(?:[-*•–]|\d+[.)])\s*/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 12);

  return normalizeSpec({
    type: "list",
    title: null,
    nodes: items.map((label, i) => ({
      id: `n${i + 1}`,
      label: label.length > 90 ? `${label.slice(0, 87)}…` : label,
      detail: null,
      group: null,
    })),
    edges: [],
    groups: [],
  });
}
