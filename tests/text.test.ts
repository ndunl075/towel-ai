import { describe, expect, it } from "vitest";

import { measureText, wrapText } from "@/lib/text";
import { THEMES } from "@/lib/theme";

describe("measureText", () => {
  it("grows with the text and with the font size", () => {
    expect(measureText("aaaa", 16)).toBeGreaterThan(measureText("aa", 16));
    expect(measureText("hello", 32)).toBeCloseTo(measureText("hello", 16) * 2, 5);
  });

  it("measures nothing as nothing", () => {
    expect(measureText("", 16)).toBe(0);
  });

  it("gives bold a little more room", () => {
    expect(measureText("hello", 16, true)).toBeGreaterThan(measureText("hello", 16, false));
  });

  it("makes narrow glyphs narrower than wide ones", () => {
    expect(measureText("iiii", 16)).toBeLessThan(measureText("mmmm", 16));
  });

  /**
   * Every glyph in a monospace face has the same advance. Measuring one with
   * the proportional table is what sizes a box for text a third narrower than
   * what renders.
   */
  describe("per-family profiles", () => {
    it("gives every character the same width in mono", () => {
      expect(measureText("iiiii", 16, false, "mono")).toBeCloseTo(
        measureText("mmmmm", 16, false, "mono"),
        5,
      );
    });

    it("does not do that for proportional families", () => {
      expect(measureText("iiiii", 16, false, "sans")).not.toBeCloseTo(
        measureText("mmmmm", 16, false, "sans"),
        1,
      );
    });

    it("sets a casual face wider and a serif tighter than the sans", () => {
      const sans = measureText("Frontline triage", 16, false, "sans");
      expect(measureText("Frontline triage", 16, false, "round")).toBeGreaterThan(sans);
      expect(measureText("Frontline triage", 16, false, "serif")).toBeLessThan(sans);
    });

    it("counts an emoji as one cell in mono", () => {
      expect(measureText("🙂", 16, false, "mono")).toBeCloseTo(
        measureText("x", 16, false, "mono"),
        5,
      );
    });
  });
});

describe("wrapText", () => {
  it("keeps short text on one line", () => {
    expect(wrapText("short", 500, 16, 1.3).lines).toEqual(["short"]);
  });

  it("wraps on word boundaries", () => {
    const out = wrapText("one two three four five six seven", 80, 14, 1.3, { maxLines: 10 });
    expect(out.lines.length).toBeGreaterThan(1);
    expect(out.lines.join(" ")).toBe("one two three four five six seven");
  });

  it("never reports a line wider than it measured", () => {
    const out = wrapText("one two three four five six seven eight", 90, 14, 1.3, { maxLines: 10 });
    for (const line of out.lines) {
      expect(measureText(line, 14)).toBeLessThanOrEqual(out.width + 0.001);
    }
  });

  it("hard-breaks a single word too long to fit, so one URL cannot blow out a box", () => {
    const out = wrapText("x".repeat(200), 80, 14, 1.3, { maxLines: 10 });
    expect(out.lines.length).toBeGreaterThan(1);
    expect(out.width).toBeLessThanOrEqual(85);
  });

  it("honours maxLines", () => {
    const out = wrapText("one two three four five six seven eight nine ten", 60, 14, 1.3, {
      maxLines: 2,
    });
    expect(out.lines.length).toBeLessThanOrEqual(2);
  });

  it("wraps a monospace face sooner than a proportional one at the same width", () => {
    const text = "Structure extraction pipeline stage";
    const sans = wrapText(text, 160, 14, 1.3, { maxLines: 10, metric: "sans" });
    const mono = wrapText(text, 160, 14, 1.3, { maxLines: 10, metric: "mono" });
    expect(mono.lines.length).toBeGreaterThanOrEqual(sans.lines.length);
  });

  /**
   * Always at least one line. With none, the width is Math.max() over an empty
   * array, which is -Infinity, and every box measured from it collapses.
   */
  it("returns one empty line rather than none", () => {
    const out = wrapText("", 100, 14, 1.3);
    expect(out.lines).toEqual([""]);
    expect(out.width).toBe(0);
    expect(Number.isFinite(out.width)).toBe(true);
    expect(out.height).toBeGreaterThan(0);
  });
});

describe("themes", () => {
  it("gives every theme a font profile that matches its stack", () => {
    for (const theme of THEMES) {
      expect(theme.font.family.length, theme.id).toBeGreaterThan(0);
      expect(["sans", "serif", "mono", "round"], theme.id).toContain(theme.font.metric);
      if (/monospace|Consolas|Menlo/.test(theme.font.family)) {
        expect(theme.font.metric, theme.id).toBe("mono");
      }
    }
  });

  /** The guide asks presets to vary colors, fonts and corner radius. */
  it("varies the typeface across presets, not only the palette", () => {
    expect(new Set(THEMES.map((t) => t.font.family)).size).toBeGreaterThan(1);
    expect(new Set(THEMES.map((t) => t.node.radius)).size).toBeGreaterThan(1);
    expect(new Set(THEMES.map((t) => t.background)).size).toBe(THEMES.length);
  });

  it("uses only system font stacks, so an exported SVG stands alone", () => {
    for (const theme of THEMES) {
      expect(theme.font.family, theme.id).not.toMatch(/https?:|url\(|@import/);
    }
  });
});
