import { describe, expect, it } from "vitest";

import { listSpecFromText, makeId, normalizeSpec, type DiagramSpec } from "@/lib/spec";

const spec = (partial: Partial<DiagramSpec>): DiagramSpec => ({
  type: "flowchart",
  title: null,
  nodes: [],
  edges: [],
  groups: [],
  ...partial,
});

const node = (id: string, extra: Partial<DiagramSpec["nodes"][number]> = {}) => ({
  id,
  label: id,
  detail: null,
  group: null,
  ...extra,
});

describe("normalizeSpec", () => {
  it("drops edges pointing at nodes that were never declared", () => {
    const out = normalizeSpec(
      spec({
        nodes: [node("a"), node("b")],
        edges: [
          { from: "a", to: "b", label: null },
          { from: "a", to: "ghost", label: null },
        ],
      }),
    );
    expect(out.edges).toHaveLength(1);
  });

  it("drops duplicate node ids, keeping the first", () => {
    const out = normalizeSpec(
      spec({ nodes: [node("a", { label: "First" }), node("a", { label: "Second" })] }),
    );
    expect(out.nodes).toHaveLength(1);
    expect(out.nodes[0].label).toBe("First");
  });

  it("drops self-loops", () => {
    const out = normalizeSpec(
      spec({ nodes: [node("a")], edges: [{ from: "a", to: "a", label: null }] }),
    );
    expect(out.edges).toHaveLength(0);
  });

  it("drops duplicate edges", () => {
    const out = normalizeSpec(
      spec({
        nodes: [node("a"), node("b")],
        edges: [
          { from: "a", to: "b", label: null },
          { from: "a", to: "b", label: "again" },
        ],
      }),
    );
    expect(out.edges).toHaveLength(1);
  });

  it("declares a group a node referenced but nobody defined", () => {
    const out = normalizeSpec(spec({ nodes: [node("a", { group: "left" })] }));
    expect(out.groups).toEqual([{ id: "left", label: "left" }]);
  });

  it("falls back to the id when a label is blank", () => {
    const out = normalizeSpec(spec({ nodes: [node("a", { label: "   " })] }));
    expect(out.nodes[0].label).toBe("a");
  });

  /**
   * Constrained decoding promises a string, so a model with nothing to say
   * writes the word rather than omitting the field - and a column header then
   * renders as "null". Seen from a real 2B model.
   */
  it("strips fields containing the literal word null", () => {
    const out = normalizeSpec(
      spec({
        title: "null",
        nodes: [node("a", { label: "null", detail: "undefined", group: "NULL" })],
        edges: [],
        groups: [{ id: "g", label: "null" }],
      }),
    );
    expect(out.title).toBeNull();
    expect(out.nodes[0].label).toBe("a");
    expect(out.nodes[0].detail).toBeNull();
    expect(out.nodes[0].group).toBeNull();
    expect(out.groups[0].label).toBe("g");
  });

  it("keeps 'none', which is a real thing to call a row", () => {
    const out = normalizeSpec(spec({ nodes: [node("a", { label: "None", detail: "None" })] }));
    expect(out.nodes[0].label).toBe("None");
    expect(out.nodes[0].detail).toBe("None");
  });

  it("is idempotent", () => {
    const once = normalizeSpec(
      spec({
        nodes: [node("a"), node("b")],
        edges: [{ from: "a", to: "b", label: null }],
      }),
    );
    expect(normalizeSpec(once)).toEqual(once);
  });
});

describe("listSpecFromText", () => {
  it("splits sentences into nodes and always returns a list", () => {
    const out = listSpecFromText("One thing happened. Then another. Finally a third.");
    expect(out.type).toBe("list");
    expect(out.nodes).toHaveLength(3);
  });

  it("strips bullet and number markers", () => {
    expect(listSpecFromText("- first\n* second\n1. third").nodes.map((n) => n.label)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("caps how much it will render", () => {
    const many = Array.from({ length: 40 }, (_, i) => `Item ${i}.`).join(" ");
    expect(listSpecFromText(many).nodes.length).toBeLessThanOrEqual(12);
  });

  it("truncates a single runaway line rather than blowing out the box", () => {
    const long = "x".repeat(400);
    expect(listSpecFromText(long).nodes[0].label.length).toBeLessThanOrEqual(90);
  });

  it("survives empty input", () => {
    expect(listSpecFromText("   ").nodes).toEqual([]);
  });
});

describe("makeId", () => {
  it("skips ids already taken", () => {
    expect(makeId("n", ["n1", "n2"])).toBe("n3");
  });
});
