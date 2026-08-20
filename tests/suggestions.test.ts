import { describe, expect, it } from "vitest";

import { FIXTURES } from "@/lib/fixtures";
import { normalizeSpec, type DiagramSpec } from "@/lib/spec";
import { suggestTypes } from "@/lib/suggestions";
import { paperTheme } from "@/lib/theme";

const rank = (spec: DiagramSpec) => suggestTypes(spec, paperTheme);
const order = (spec: DiagramSpec) => rank(spec).map((s) => s.type);

const spec = (partial: Partial<DiagramSpec>): DiagramSpec =>
  normalizeSpec({ type: "list", title: null, nodes: [], edges: [], groups: [], ...partial });

describe("suggestTypes", () => {
  it("offers every implemented type", () => {
    expect(rank(FIXTURES[0].spec)).toHaveLength(8);
  });

  it("ranks each fixture's declared type in the top three", () => {
    for (const { name, spec: fixture } of FIXTURES) {
      expect(order(fixture).slice(0, 3), name).toContain(fixture.type);
    }
  });

  it("marks a type the layout engine refuses as not fitting", () => {
    // No groups at all, so there is no comparison or venn to draw.
    const flat = spec({ nodes: [{ id: "a", label: "A", detail: null, group: null }] });
    const unfit = rank(flat).filter((s) => !s.fits).map((s) => s.type);
    expect(unfit).toEqual(expect.arrayContaining(["comparison", "venn"]));
  });

  it("sorts every fitting type ahead of every unfitting one", () => {
    const results = rank(FIXTURES[0].spec);
    const lastFit = results.map((s) => s.fits).lastIndexOf(true);
    const firstUnfit = results.map((s) => s.fits).indexOf(false);
    if (firstUnfit !== -1) expect(lastFit).toBeLessThan(firstUnfit);
  });

  /**
   * cycle, timeline and funnel build geometry from node *order*, not edges.
   * Scoring them on edges ranked `cycle` last for its own fixture.
   */
  it("rates an edgeless run of steps as a plausible cycle", () => {
    const steps = spec({
      nodes: ["one", "two", "three", "four"].map((id) => ({
        id,
        label: id,
        detail: null,
        group: null,
      })),
    });
    const cycle = rank(steps).find((s) => s.type === "cycle")!;
    expect(cycle.score).toBeGreaterThan(0.5);
  });

  it("puts cycle first when the edges actually loop back", () => {
    const looped = spec({
      type: "cycle",
      nodes: ["a", "b", "c"].map((id) => ({ id, label: id, detail: null, group: null })),
      edges: [
        { from: "a", to: "b", label: null },
        { from: "b", to: "c", label: null },
        { from: "c", to: "a", label: null },
      ],
    });
    expect(order(looped)[0]).toBe("cycle");
  });

  /** Descending numeric details are a funnel and nothing else. */
  it("puts funnel first for counts that narrow", () => {
    const narrowing = spec({
      nodes: [
        { id: "a", label: "Visits", detail: "42,000 a month", group: null },
        { id: "b", label: "Trials", detail: "6,100", group: null },
        { id: "c", label: "Active", detail: "2,400", group: null },
        { id: "d", label: "Paid", detail: "410", group: null },
      ],
    });
    expect(order(narrowing)[0]).toBe("funnel");
  });

  /** "Five a week" is a rate, not a date - it must not read as a timeline. */
  it("does not treat a bare unit as a date", () => {
    const rates = spec({
      nodes: [
        { id: "a", label: "Interview", detail: "Five a week", group: null },
        { id: "b", label: "Prioritise", detail: "Two a week", group: null },
        { id: "c", label: "Sketch", detail: "One a week", group: null },
      ],
    });
    const timeline = rank(rates).find((s) => s.type === "timeline")!;
    expect(timeline.reason).not.toBe("details read as dates");
  });

  it("puts timeline first when the details really are dates", () => {
    const dated = spec({
      nodes: [
        { id: "a", label: "Kickoff", detail: "Q1 2024", group: null },
        { id: "b", label: "Beta", detail: "Q3 2024", group: null },
        { id: "c", label: "GA", detail: "March 2025", group: null },
      ],
    });
    expect(order(dated)[0]).toBe("timeline");
  });

  /** A group-less node alongside groups is the venn overlap. */
  it("prefers venn over comparison when sets share members", () => {
    const shared = spec({
      nodes: [
        { id: "a", label: "Only A", detail: null, group: "left" },
        { id: "b", label: "Only B", detail: null, group: "right" },
        { id: "both", label: "Shared", detail: null, group: null },
      ],
      groups: [
        { id: "left", label: "Left" },
        { id: "right", label: "Right" },
      ],
    });
    const ranked = order(shared);
    expect(ranked.indexOf("venn")).toBeLessThan(ranked.indexOf("comparison"));

    // Pin the reason too. The ordering alone survives losing this signal,
    // because penalising comparison is enough to reorder them - so asserting
    // only the order lets the venn branch be deleted without a test noticing.
    const venn = rank(shared).find((s) => s.type === "venn")!;
    expect(venn.reason).toBe("sets with shared members");
    expect(venn.score).toBeGreaterThan(0.9);
  });

  it("prefers comparison when the groups share nothing", () => {
    const split = spec({
      nodes: [
        { id: "a", label: "Only A", detail: null, group: "left" },
        { id: "b", label: "Only B", detail: null, group: "right" },
      ],
      groups: [
        { id: "left", label: "Left" },
        { id: "right", label: "Right" },
      ],
    });
    const ranked = order(split);
    expect(ranked.indexOf("comparison")).toBeLessThan(ranked.indexOf("venn"));
  });

  it("puts list first for pasted prose", () => {
    const prose = spec({
      nodes: [
        { id: "a", label: "The light came in sideways all afternoon", detail: null, group: null },
        { id: "b", label: "Nobody agreed where the desks should go", detail: null, group: null },
        { id: "c", label: "Somehow that never mattered at all", detail: null, group: null },
      ],
    });
    expect(order(prose)[0]).toBe("list");
  });

  it("puts flowchart first when the steps branch", () => {
    const branching = spec({
      type: "flowchart",
      nodes: ["a", "b", "c"].map((id) => ({ id, label: id, detail: null, group: null })),
      edges: [
        { from: "a", to: "b", label: null },
        { from: "a", to: "c", label: null },
      ],
    });
    expect(order(branching)[0]).toBe("flowchart");
  });
});
