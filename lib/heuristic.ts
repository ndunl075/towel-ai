import { normalizeSpec, type DiagramSpec, type DiagramType } from "./spec";

/**
 * A no-LLM structure extractor.
 *
 * It exists for two reasons: the app has to do something sensible with no API
 * key configured, and it is the last fallback when the model returns garbage
 * twice. It only recognises structure that is written explicitly in the text -
 * arrows, numbered steps, "A vs B" - and otherwise returns a list.
 */
export function heuristicExtract(text: string): DiagramSpec {
  const raw = text.trim();
  if (!raw) return normalizeSpec({ type: "list", title: null, nodes: [], edges: [], groups: [] });

  const title = detectTitle(raw);
  const body = title ? raw.slice(raw.indexOf("\n") + 1) : raw;

  const arrowChain = parseArrowChain(body);
  if (arrowChain) return withTitle(arrowChain, title);

  const comparison = parseComparison(body);
  if (comparison) return withTitle(comparison, title);

  const steps = parseSteps(body);
  if (steps) {
    const type: DiagramType = looksCyclic(body) ? "cycle" : "flowchart";
    return withTitle({ ...steps, type }, title);
  }

  return withTitle(
    {
      type: "list",
      title: null,
      nodes: splitItems(body).map((label, i) => ({
        id: `n${i + 1}`,
        label: trim(label),
        detail: null,
        group: null,
      })),
      edges: [],
      groups: [],
    },
    title,
  );
}

function withTitle(spec: DiagramSpec, title: string | null): DiagramSpec {
  return normalizeSpec({ ...spec, title: spec.title ?? title });
}

function detectTitle(text: string): string | null {
  const first = text.split(/\r?\n/)[0].trim();
  const heading = first.match(/^#{1,3}\s+(.+)$/);
  if (heading) return trim(heading[1]);
  // A short opening line with no terminal punctuation reads as a title.
  if (first.length > 0 && first.length <= 60 && !/[.!?;:]$/.test(first) && text.includes("\n")) {
    return trim(first);
  }
  return null;
}

/** "Draft -> Review -> Publish" on one or more lines. */
function parseArrowChain(text: string): DiagramSpec | null {
  const lines = text.split(/\r?\n/).filter((l) => /(->|=>|→|➔)/.test(l));
  if (lines.length === 0) return null;

  const nodes = new Map<string, string>();
  const edges: DiagramSpec["edges"] = [];

  for (const line of lines) {
    const parts = line
      .split(/\s*(?:->|=>|→|➔)\s*/)
      .map((p) => trim(p.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")))
      .filter(Boolean);
    if (parts.length < 2) continue;

    const ids = parts.map((label) => {
      const id = slug(label);
      if (!nodes.has(id)) nodes.set(id, label);
      return id;
    });
    for (let i = 0; i < ids.length - 1; i++) {
      edges.push({ from: ids[i], to: ids[i + 1], label: null });
    }
  }

  if (nodes.size < 2) return null;
  return {
    type: looksCyclic(text) ? "cycle" : "flowchart",
    title: null,
    nodes: [...nodes].map(([id, label]) => ({ id, label, detail: null, group: null })),
    edges,
    groups: [],
  };
}

/** "Option A: ... / Option B: ..." or markdown sections read as columns. */
function parseComparison(text: string): DiagramSpec | null {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd());
  const groups: DiagramSpec["groups"] = [];
  const nodes: DiagramSpec["nodes"] = [];
  let current: string | null = null;

  for (const line of lines) {
    const heading =
      line.match(/^#{1,6}\s+(.+)$/) ?? line.match(/^([A-Z][^:\n]{1,40}):\s*$/);
    if (heading) {
      current = slug(heading[1]);
      groups.push({ id: current, label: trim(heading[1]) });
      continue;
    }
    const item = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.+)$/);
    if (item && current) {
      nodes.push({
        id: `${current}-${nodes.length + 1}`,
        label: trim(item[1]),
        detail: null,
        group: current,
      });
    }
  }

  if (groups.length < 2 || nodes.length < 2) return null;
  return { type: "comparison", title: null, nodes, edges: [], groups };
}

/** Numbered or bulleted steps become a chain. */
function parseSteps(text: string): DiagramSpec | null {
  const items = text
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*(?:\d+[.)]|[-*•])\s+(.+)$/)?.[1])
    .filter((l): l is string => Boolean(l));
  if (items.length < 2) return null;

  const nodes = items.map((label, i) => ({
    id: `n${i + 1}`,
    label: trim(label),
    detail: null,
    group: null,
  }));
  const edges = nodes.slice(0, -1).map((n, i) => ({
    from: n.id,
    to: nodes[i + 1].id,
    label: null,
  }));

  return { type: "flowchart", title: null, nodes, edges, groups: [] };
}

function looksCyclic(text: string): boolean {
  return /\b(cycle|loop|repeat|iterate|continuous|back to the start|and repeat)\b/i.test(text);
}

function splitItems(text: string): string[] {
  return text
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 10);
}

/** Node labels stay short so the boxes stay readable. */
function trim(label: string): string {
  const clean = label.replace(/\s+/g, " ").replace(/[.:;]+$/, "").trim();
  return clean.length > 70 ? `${clean.slice(0, 67)}…` : clean;
}

function slug(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 24) || "n"
  );
}
