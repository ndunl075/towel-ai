import { describe, expect, it } from "vitest";

import { autoIconFor, getIcon, ICONS, matchIcon } from "@/lib/icons";

describe("the icon library", () => {
  it("has unique ids", () => {
    expect(new Set(ICONS.map((i) => i.id)).size).toBe(ICONS.length);
  });

  it("gives every icon at least one keyword and one shape", () => {
    for (const icon of ICONS) {
      expect(icon.keywords.length, icon.id).toBeGreaterThan(0);
      expect(icon.shapes.length, icon.id).toBeGreaterThan(0);
    }
  });

  /** Every glyph is stroked on the same grid so it can take the accent colour. */
  it("keeps every shape inside the 24-unit grid", () => {
    for (const icon of ICONS) {
      for (const shape of icon.shapes) {
        const points =
          shape.k === "circle"
            ? [shape.cx - shape.r, shape.cx + shape.r, shape.cy - shape.r, shape.cy + shape.r]
            : shape.k === "line"
              ? [shape.x1, shape.x2, shape.y1, shape.y2]
              : shape.k === "rect"
                ? [shape.x, shape.x + shape.w, shape.y, shape.y + shape.h]
                : [];
        for (const p of points) {
          expect(p, `${icon.id} out of bounds`).toBeGreaterThanOrEqual(-0.5);
          expect(p, `${icon.id} out of bounds`).toBeLessThanOrEqual(24.5);
        }
      }
    }
  });

  it("resolves an id back to its icon", () => {
    expect(getIcon("user")?.id).toBe("user");
    expect(getIcon("does-not-exist")).toBeNull();
    expect(getIcon(null)).toBeNull();
  });
});

describe("matchIcon", () => {
  it("matches a keyword anywhere in the text", () => {
    expect(matchIcon("A ticket arrives in the queue")?.id).toBe("ticket");
  });

  it("matches whole words only", () => {
    // "process" must not match inside "processor".
    expect(matchIcon("processor")?.id).not.toBe("cycle");
  });

  it("is case and punctuation insensitive", () => {
    expect(matchIcon("EMAIL, sent.")?.id).toBe("mail");
  });

  /** Longest keyword wins, so a specific word beats a generic one. */
  it("prefers the more specific keyword", () => {
    expect(matchIcon("the billing team")?.id).toBe("money");
  });

  it("returns null when nothing matches", () => {
    expect(matchIcon("zzz qqq")).toBeNull();
    expect(matchIcon("")).toBeNull();
  });
});

describe("autoIconFor", () => {
  it("prefers a match on the label over one on the detail", () => {
    // "repair" is only a wrench; "email" is only a mail. The label wins.
    expect(autoIconFor("Repair the unit", "send an email")).toBe("wrench");
  });

  it("falls back to the detail when the label says nothing", () => {
    expect(autoIconFor("Zzz qqq", "due by calendar month 3")).toBe("calendar");
  });

  it("returns null when neither says anything", () => {
    expect(autoIconFor("Zzz qqq", "wibble")).toBeNull();
    expect(autoIconFor("Zzz qqq", null)).toBeNull();
  });
});
