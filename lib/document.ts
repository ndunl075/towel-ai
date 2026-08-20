import { makeId, normalizeSpec, type DiagramSpec, type DiagramType } from "./spec";

/**
 * What the editor actually edits.
 *
 * The spec is still the single source of truth for structure; the extra fields
 * are the things a spec has no business carrying - where the user dragged a
 * box, which theme is on. Undo/redo is a stack of these, so a drag, a rename
 * and a theme switch all rewind through the same mechanism.
 */
export interface DiagramDoc {
  spec: DiagramSpec;
  /**
   * Node id -> offset from the position the layout engine chose. Storing a
   * delta rather than an absolute point means a drag survives a re-layout:
   * rename a node, change type, and the nudge still reads as the same nudge.
   */
  offsets: Record<string, Offset>;
  themeId: string;
}

export interface Offset {
  dx: number;
  dy: number;
}

export interface History {
  past: DiagramDoc[];
  present: DiagramDoc;
  future: DiagramDoc[];
}

const HISTORY_LIMIT = 60;

export function newDoc(spec: DiagramSpec, themeId: string): DiagramDoc {
  return { spec: normalizeSpec(spec), offsets: {}, themeId };
}

export function newHistory(doc: DiagramDoc): History {
  return { past: [], present: doc, future: [] };
}

/** Adds a new state and drops the redo branch, as every editor does. */
export function commit(history: History, next: DiagramDoc): History {
  if (next === history.present) return history;
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
  };
}

export function undo(history: History): History {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo(history: History): History {
  if (history.future.length === 0) return history;
  const [next, ...rest] = history.future;
  return {
    past: [...history.past, history.present],
    present: next,
    future: rest,
  };
}

export function canUndo(history: History): boolean {
  return history.past.length > 0;
}

export function canRedo(history: History): boolean {
  return history.future.length > 0;
}

// --- Edits -----------------------------------------------------------------

export function setLabel(doc: DiagramDoc, id: string, label: string): DiagramDoc {
  const trimmed = label.trim();
  if (!trimmed) return doc;
  return withSpec(doc, {
    ...doc.spec,
    nodes: doc.spec.nodes.map((n) => (n.id === id ? { ...n, label: trimmed } : n)),
  });
}

export function setDetail(doc: DiagramDoc, id: string, detail: string): DiagramDoc {
  const trimmed = detail.trim();
  return withSpec(doc, {
    ...doc.spec,
    nodes: doc.spec.nodes.map((n) => (n.id === id ? { ...n, detail: trimmed || null } : n)),
  });
}

export function setType(doc: DiagramDoc, type: DiagramType): DiagramDoc {
  if (doc.spec.type === type) return doc;
  // Offsets were chosen against a different layout, so they no longer mean
  // anything. Dropping them beats leaving nodes scattered.
  return { ...doc, spec: { ...doc.spec, type }, offsets: {} };
}

export function setTheme(doc: DiagramDoc, themeId: string): DiagramDoc {
  if (doc.themeId === themeId) return doc;
  return { ...doc, themeId };
}

export function setTitle(doc: DiagramDoc, title: string): DiagramDoc {
  const trimmed = title.trim();
  return withSpec(doc, { ...doc.spec, title: trimmed || null });
}

export function moveNode(doc: DiagramDoc, id: string, offset: Offset): DiagramDoc {
  return { ...doc, offsets: { ...doc.offsets, [id]: offset } };
}

export function resetPositions(doc: DiagramDoc): DiagramDoc {
  if (Object.keys(doc.offsets).length === 0) return doc;
  return { ...doc, offsets: {} };
}

export function deleteNode(doc: DiagramDoc, id: string): DiagramDoc {
  if (!doc.spec.nodes.some((n) => n.id === id)) return doc;
  const offsets = { ...doc.offsets };
  delete offsets[id];
  return {
    ...doc,
    offsets,
    spec: normalizeSpec({
      ...doc.spec,
      nodes: doc.spec.nodes.filter((n) => n.id !== id),
      // normalizeSpec drops the edges that pointed at it.
      edges: doc.spec.edges,
    }),
  };
}

/** Adds a node after `afterId`, wired into the flow when there is one. */
export function addNode(doc: DiagramDoc, afterId: string | null): DiagramDoc {
  const id = makeId("n", doc.spec.nodes.map((n) => n.id));
  const anchor = afterId ? doc.spec.nodes.find((n) => n.id === afterId) : null;
  const index = anchor ? doc.spec.nodes.indexOf(anchor) + 1 : doc.spec.nodes.length;

  const nodes = [...doc.spec.nodes];
  nodes.splice(index, 0, { id, label: "New step", detail: null, group: anchor?.group ?? null });

  const edges = [...doc.spec.edges];
  if (anchor && doc.spec.edges.length > 0) {
    edges.push({ from: anchor.id, to: id, label: null });
  }

  return withSpec(doc, { ...doc.spec, nodes, edges });
}

function withSpec(doc: DiagramDoc, spec: DiagramSpec): DiagramDoc {
  return { ...doc, spec: normalizeSpec(spec) };
}
