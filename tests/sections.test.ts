import { describe, expect, it } from "vitest";

import { SAMPLES } from "@/lib/samples";
import { splitSections } from "@/lib/sections";

describe("splitSections", () => {
  it("returns nothing for empty input", () => {
    expect(splitSections("")).toEqual([]);
    expect(splitSections("   \n  \t ")).toEqual([]);
  });

  it("keeps a document with no headings as one section", () => {
    const sections = splitSections("The light came in sideways. Nobody agreed on the desks.");
    expect(sections).toHaveLength(1);
    expect(sections[0].explicitHeading).toBe(false);
  });

  /**
   * The regression this splitter exists to avoid. Prose writes a lead-in line,
   * a blank, then the body it introduces; splitting on blanks cuts one
   * comparison into fragments that each mean nothing.
   */
  it("never splits on a blank line", () => {
    const text = `Build vs buy for our billing system.

Building in-house:
- Full control over the data model

Buying an off-the-shelf platform:
- Live in about three weeks`;
    expect(splitSections(text)).toHaveLength(1);
  });

  it("leaves every shipped sample that has no headings intact", () => {
    for (const sample of SAMPLES.filter((s) => !s.text.includes("\n# "))) {
      expect(splitSections(sample.text).length, sample.label).toBe(1);
    }
  });

  it("splits on ATX headings and keeps the heading as the name", () => {
    const sections = splitSections("# Onboarding\n\nSigns up.\n\n# Billing\n\nCharged monthly.");
    expect(sections.map((s) => s.heading)).toEqual(["Onboarding", "Billing"]);
    expect(sections.every((s) => s.explicitHeading)).toBe(true);
  });

  it("splits on setext headings", () => {
    const sections = splitSections("Onboarding\n==========\n\nSigns up.\n\nBilling\n-------\n\nMonthly.");
    expect(sections.map((s) => s.heading)).toEqual(["Onboarding", "Billing"]);
  });

  it("splits on a horizontal rule", () => {
    expect(splitSections("Step one happens.\n\n---\n\nStep two happens.")).toHaveLength(2);
  });

  it("folds a heading that has nothing under it into what follows", () => {
    const sections = splitSections("# Title Only\n\n## Real Section\n\nBody text here.");
    expect(sections).toHaveLength(1);
  });

  it("carries the heading into the text sent for extraction", () => {
    const [section] = splitSections("# Onboarding\n\nUser signs up.\n\n# Billing\n\nMonthly.");
    expect(section.text.startsWith("Onboarding")).toBe(true);
  });

  /**
   * The property the whole feature rests on: ids are content-addressed, so
   * editing one section leaves every other section's generated diagram valid.
   */
  it("changes only the edited section's id", () => {
    const before = "# A\n\nAlpha body.\n\n# B\n\nBravo body.\n\n# C\n\nCharlie body.";
    const after = before.replace("Bravo body.", "Bravo body, revised.");
    const a = splitSections(before);
    const b = splitSections(after);

    expect(a.map((s) => s.heading)).toEqual(b.map((s) => s.heading));
    const changed = a.filter((s, i) => s.id !== b[i].id).map((s) => s.heading);
    expect(changed).toEqual(["B"]);
  });

  it("reuses the same id when an edit is reverted", () => {
    const original = "# A\n\nAlpha.\n\n# B\n\nBravo.";
    const edited = original.replace("Bravo.", "Bravo two.");
    expect(splitSections(edited)[1].id).not.toBe(splitSections(original)[1].id);
    expect(splitSections(edited.replace("Bravo two.", "Bravo."))[1].id).toBe(
      splitSections(original)[1].id,
    );
  });

  it("keeps two identical sections separately addressable", () => {
    const sections = splitSections("# A\n\nSame body.\n\n# B\n\nSame body.");
    expect(sections).toHaveLength(2);
    expect(sections[0].id).not.toBe(sections[1].id);
  });
});
