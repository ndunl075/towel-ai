import { describe, expect, it } from "vitest";

import { FIXTURES } from "@/lib/fixtures";
import { autoIconFor } from "@/lib/icons";
import { layoutSpec } from "@/lib/layout";
import { applyOffsets } from "@/lib/layout/overrides";
import { IMPLEMENTED_TYPES, normalizeSpec, type DiagramSpec } from "@/lib/spec";
import { measureText } from "@/lib/text";
import { THEMES, paperTheme } from "@/lib/theme";

const withIcons = (node: { label: string; detail: string | null }) =>
  autoIconFor(node.label, node.detail);

const empty: DiagramSpec = normalizeSpec({
  type: "flowchart",
  title: null,
  nodes: [],
  edges: [],
  groups: [],
});

describe("layoutSpec", () => {
  it("draws every fixture in every type without throwing", () => {
    for (const { name, spec } of FIXTURES) {
      for (const type of IMPLEMENTED_TYPES) {
        expect(() => layoutSpec({ ...spec, type }, paperTheme), `${name} as ${type}`).not.toThrow();
      }
    }
  });

  it("draws every fixture in every theme without throwing", () => {
    for (const { name, spec } of FIXTURES) {
      for (const theme of THEMES) {
        expect(() => layoutSpec(spec, theme, withIcons), `${name} in ${theme.id}`).not.toThrow();
      }
    }
  });

  it("gives every fixture a positive canvas and never silently drops a node", () => {
    for (const { name, spec } of FIXTURES) {
      const layout = layoutSpec(spec, paperTheme);
      expect(layout.width, name).toBeGreaterThan(0);
      expect(layout.height, name).toBeGreaterThan(0);

      // A layout may add chrome of its own - a comparison draws a header band
      // per column - but every node in the spec has to be on the page.
      const drawn = new Set(layout.nodes.map((n) => n.id));
      for (const node of spec.nodes) expect(drawn.has(node.id), `${name}: ${node.id}`).toBe(true);
    }
  });

  it("routes every edge it keeps", () => {
    for (const { name, spec } of FIXTURES) {
      const layout = layoutSpec(spec, paperTheme);
      for (const edge of layout.edges) {
        expect(edge.d.length, `${name} ${edge.id}`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps every node inside the canvas", () => {
    for (const theme of THEMES) {
      for (const { name, spec } of FIXTURES) {
        const layout = layoutSpec(spec, theme, withIcons);
        for (const node of layout.nodes) {
          expect(node.x, `${name}/${theme.id}`).toBeGreaterThanOrEqual(0);
          expect(node.y, `${name}/${theme.id}`).toBeGreaterThanOrEqual(0);
          expect(node.x + node.w, `${name}/${theme.id}`).toBeLessThanOrEqual(layout.width);
          expect(node.y + node.h, `${name}/${theme.id}`).toBeLessThanOrEqual(layout.height);
        }
      }
    }
  });

  /**
   * The bug a per-theme typeface can cause: measure a monospace face with
   * proportional widths and every box is sized for text a third narrower than
   * what renders. Boxes must fit their own measured text in every theme.
   */
  it("sizes every box to fit its own label in every theme", () => {
    for (const theme of THEMES) {
      for (const { name, spec } of FIXTURES) {
        const layout = layoutSpec(spec, theme, withIcons);
        for (const node of layout.nodes) {
          if (node.shape === "polygon") continue; // funnel bands taper by design
          const lead = node.icon || node.badge ? 30 : 0;
          for (const line of node.labelLines) {
            const width = measureText(line, theme.font.label, true, theme.font.metric);
            expect(
              width,
              `${name}/${theme.id}: "${line}" overflows its box`,
            ).toBeLessThanOrEqual(node.w - lead + 1);
          }
        }
      }
    }
  });

  it("degrades rather than throwing when a spec cannot make the type", () => {
    const noGroups = normalizeSpec({
      type: "venn",
      title: null,
      nodes: [{ id: "a", label: "Alone", detail: null, group: null }],
      edges: [],
      groups: [],
    });
    expect(layoutSpec(noGroups, paperTheme).degradedFrom).toBe("venn");
  });

  it("survives an empty spec in every type", () => {
    for (const type of IMPLEMENTED_TYPES) {
      expect(() => layoutSpec({ ...empty, type }, paperTheme), type).not.toThrow();
    }
  });

  it("is deterministic - the same spec lays out identically twice", () => {
    for (const { name, spec } of FIXTURES) {
      expect(layoutSpec(spec, paperTheme), name).toEqual(layoutSpec(spec, paperTheme));
    }
  });

  /**
   * The icon eats into the text column rather than widening the box, so the
   * label wraps a line earlier. What must never happen is the text keeping its
   * full width and running under the glyph.
   */
  it("takes the icon's lead slot out of the text column, not out of the label", () => {
    const spec = normalizeSpec({
      type: "flowchart",
      title: null,
      nodes: [{ id: "a", label: "A ticket arrives in the support queue", detail: null, group: null }],
      edges: [],
      groups: [],
    });
    const without = layoutSpec(spec, paperTheme).nodes[0];
    const withIcon = layoutSpec(spec, paperTheme, () => "ticket").nodes[0];

    expect(withIcon.icon).toBe("ticket");
    expect(without.icon).toBeNull();
    // Same words, less room for them.
    expect(withIcon.labelLines.join(" ")).toBe(without.labelLines.join(" "));
    expect(withIcon.labelLines.length).toBeGreaterThanOrEqual(without.labelLines.length);

    for (const line of withIcon.labelLines) {
      const width = measureText(line, paperTheme.font.label, true, paperTheme.font.metric);
      expect(width).toBeLessThanOrEqual(withIcon.w - 30 + 1);
    }
  });
});

describe("applyOffsets", () => {
  it("moves only the node that was dragged", () => {
    const layout = layoutSpec(FIXTURES[0].spec, paperTheme);
    const id = layout.nodes[0].id;
    const moved = applyOffsets(layout, { [id]: { dx: 25, dy: -10 } });

    const before = layout.nodes.find((n) => n.id === id)!;
    const after = moved.nodes.find((n) => n.id === id)!;
    expect(after.x).toBe(before.x + 25);
    expect(after.y).toBe(before.y - 10);

    for (const node of layout.nodes.slice(1)) {
      const same = moved.nodes.find((n) => n.id === node.id)!;
      expect({ x: same.x, y: same.y }).toEqual({ x: node.x, y: node.y });
    }
  });

  it("leaves the layout untouched when nothing was dragged", () => {
    const layout = layoutSpec(FIXTURES[0].spec, paperTheme);
    expect(applyOffsets(layout, {})).toEqual(layout);
  });
});
