import { describe, expect, it } from "vitest";

import {
  addNode,
  adoptSpec,
  canRedo,
  canUndo,
  commit,
  deleteNode,
  iconForNode,
  moveNode,
  newDoc,
  newHistory,
  redo,
  resetIcon,
  resetPositions,
  setDetail,
  setIcon,
  setLabel,
  setShowIcons,
  setTheme,
  setTitle,
  setType,
  undo,
} from "@/lib/document";
import { normalizeSpec, type DiagramSpec } from "@/lib/spec";

const spec: DiagramSpec = normalizeSpec({
  type: "flowchart",
  title: "Support",
  nodes: [
    { id: "a", label: "A ticket arrives", detail: null, group: null },
    { id: "b", label: "Zzz qqq", detail: null, group: null },
  ],
  edges: [{ from: "a", to: "b", label: null }],
  groups: [],
});

const doc = () => newDoc(spec, "paper");
const node = (d: ReturnType<typeof doc>, id: string) => d.spec.nodes.find((n) => n.id === id)!;

describe("history", () => {
  it("starts with nothing to undo or redo", () => {
    const h = newHistory(doc());
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
  });

  it("round-trips through undo and redo", () => {
    const start = doc();
    const h = commit(newHistory(start), setTheme(start, "midnight"));
    expect(h.present.themeId).toBe("midnight");
    expect(undo(h).present.themeId).toBe("paper");
    expect(redo(undo(h)).present.themeId).toBe("midnight");
  });

  it("drops the redo branch once something new is committed", () => {
    const start = doc();
    const back = undo(commit(newHistory(start), setTheme(start, "midnight")));
    expect(canRedo(back)).toBe(true);
    expect(canRedo(commit(back, setTheme(back.present, "marker")))).toBe(false);
  });

  it("ignores a commit that changed nothing", () => {
    const h = newHistory(doc());
    expect(commit(h, h.present)).toBe(h);
  });

  it("bounds how far back it remembers", () => {
    let h = newHistory(doc());
    for (let i = 0; i < 200; i++) h = commit(h, { ...h.present, themeId: `t${i}` });
    expect(h.past.length).toBeLessThanOrEqual(60);
  });
});

describe("edits", () => {
  it("renames a node", () => {
    expect(node(setLabel(doc(), "a", "Renamed"), "a").label).toBe("Renamed");
  });

  it("refuses to leave a node unnamed", () => {
    const d = doc();
    expect(setLabel(d, "a", "   ")).toBe(d);
  });

  it("sets and clears a detail line", () => {
    expect(node(setDetail(doc(), "a", "within 2h"), "a").detail).toBe("within 2h");
    expect(node(setDetail(setDetail(doc(), "a", "x"), "a", "  "), "a").detail).toBeNull();
  });

  it("sets and clears the title", () => {
    expect(setTitle(doc(), "New title").spec.title).toBe("New title");
    expect(setTitle(doc(), "   ").spec.title).toBeNull();
  });

  it("drops drag offsets when the type changes, since they meant another layout", () => {
    const moved = moveNode(doc(), "a", { dx: 10, dy: 10 });
    expect(setType(moved, "timeline").offsets).toEqual({});
  });

  it("stores a drag as an offset, not an absolute point", () => {
    expect(moveNode(doc(), "a", { dx: 4, dy: -2 }).offsets.a).toEqual({ dx: 4, dy: -2 });
    expect(resetPositions(moveNode(doc(), "a", { dx: 4, dy: -2 })).offsets).toEqual({});
  });

  it("removes a node together with the edges that pointed at it", () => {
    const after = deleteNode(doc(), "b");
    expect(after.spec.nodes.map((n) => n.id)).toEqual(["a"]);
    expect(after.spec.edges).toHaveLength(0);
  });

  it("forgets a deleted node's offset and icon", () => {
    let d = moveNode(doc(), "b", { dx: 5, dy: 5 });
    d = setIcon(d, "b", "star");
    const after = deleteNode(d, "b");
    expect(after.offsets.b).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(after.icons, "b")).toBe(false);
  });

  it("adds a node wired into the flow", () => {
    const after = addNode(doc(), "a");
    expect(after.spec.nodes).toHaveLength(3);
    expect(after.spec.edges.some((e) => e.from === "a" && e.to !== "b")).toBe(true);
  });

  it("adopts a replacement spec and drops positions that no longer apply", () => {
    const d = setIcon(moveNode(doc(), "a", { dx: 9, dy: 9 }), "a", "star");
    const replaced = adoptSpec(d, normalizeSpec({ ...spec, type: "cycle" }));
    expect(replaced.offsets).toEqual({});
    expect(replaced.icons).toEqual({});
    expect(replaced.themeId).toBe("paper");
  });
});

describe("icon resolution", () => {
  it("matches from the text by default", () => {
    expect(iconForNode(doc(), node(doc(), "a"))).toBe("ticket");
  });

  it("returns nothing at all when icons are switched off", () => {
    const off = setShowIcons(doc(), false);
    expect(iconForNode(off, node(off, "a"))).toBeNull();
  });

  it("lets an explicit choice win over the match", () => {
    const d = setIcon(doc(), "a", "star");
    expect(iconForNode(d, node(d, "a"))).toBe("star");
  });

  /**
   * Absent means "use the matcher", null means "the user cleared it". Collapse
   * the two and clearing an icon just re-matches it on the next render.
   */
  it("keeps 'cleared' distinct from 'never chosen'", () => {
    const cleared = setIcon(doc(), "a", null);
    expect(iconForNode(cleared, node(cleared, "a"))).toBeNull();

    const back = resetIcon(cleared, "a");
    expect(iconForNode(back, node(back, "a"))).toBe("ticket");
  });
});
