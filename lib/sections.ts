/**
 * Splitting a pasted document into independently diagrammable sections.
 *
 * This is what makes "regenerate one part" possible: each section extracts into
 * its own diagram, so fixing a bad read of section three costs one model call
 * and leaves sections one and two alone.
 *
 * The split is deliberately conservative. Only an explicit heading starts a new
 * section - never a blank line. Prose routinely puts a lead-in line, a blank,
 * and then the body it introduces (the "Build vs buy" sample does exactly
 * that), and splitting on blanks would cut those into pieces that each mean
 * nothing on their own. A document with no headings stays one section, which is
 * precisely the behaviour the app had before sections existed.
 */

export interface Section {
  /**
   * Content-addressed, so it survives edits elsewhere in the document. Editing
   * section three changes only section three's id, and the diagrams already
   * generated for one and two stay valid.
   */
  id: string;
  /** Heading text when the section had one, else a label derived from the body. */
  heading: string;
  /** True when `heading` was written by the author rather than derived. */
  explicitHeading: boolean;
  text: string;
}

const ATX = /^\s{0,3}(#{1,6})\s+(.*)$/;
const RULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
/** `---` or `===` directly under a line of text is a setext heading, not a rule. */
const SETEXT = /^\s{0,3}(=+|-+)\s*$/;

export function splitSections(input: string): Section[] {
  const text = input.replace(/\r\n?/g, "\n");
  if (!text.trim()) return [];

  const lines = text.split("\n");
  const blocks: { heading: string | null; lines: string[] }[] = [];
  let current: { heading: string | null; lines: string[] } = { heading: null, lines: [] };

  const push = () => {
    if (current.heading !== null || current.lines.some((l) => l.trim())) blocks.push(current);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const atx = ATX.exec(line);
    if (atx) {
      push();
      current = { heading: atx[2].replace(/\s+#+\s*$/, "").trim(), lines: [] };
      continue;
    }

    // Setext: this line underlines the previous one. The previous line has
    // already been added to `current`, so take it back out and promote it.
    const next = lines[i + 1];
    if (line.trim() && next !== undefined && SETEXT.test(next) && !RULE.test(line)) {
      push();
      current = { heading: line.trim(), lines: [] };
      i++; // consume the underline
      continue;
    }

    if (RULE.test(line)) {
      push();
      current = { heading: null, lines: [] };
      continue;
    }

    current.lines.push(line);
  }
  push();

  const withBody = blocks
    .map((b) => ({ heading: b.heading, text: b.lines.join("\n").trim() }))
    .filter((b) => b.text.length > 0 || b.heading);

  // A heading with nothing under it is a label for what follows, not a section.
  const merged: { heading: string | null; text: string }[] = [];
  for (const block of withBody) {
    if (!block.text && block.heading) {
      merged.push({ heading: block.heading, text: "" });
      continue;
    }
    const previous = merged[merged.length - 1];
    if (previous && !previous.text) {
      previous.text = block.text;
      if (block.heading) previous.text = `${block.heading}\n\n${block.text}`;
      continue;
    }
    merged.push({ heading: block.heading, text: block.text });
  }

  const usable = merged.filter((b) => b.text.trim().length > 0);
  if (usable.length === 0) return [];

  // No headings anywhere means no split - one section over the whole document.
  if (usable.length === 1) {
    return [makeSection(usable[0].heading, text.trim(), [])];
  }

  const out: Section[] = [];
  for (const block of usable) {
    // The heading is part of the text sent for extraction; it is usually the
    // best statement of what the section is about.
    const body = block.heading ? `${block.heading}\n\n${block.text}` : block.text;
    out.push(makeSection(block.heading, body, out.map((s) => s.id)));
  }
  return out;
}

function makeSection(heading: string | null, text: string, taken: string[]): Section {
  return {
    id: uniqueId(hash(text), taken),
    heading: heading?.trim() || deriveHeading(text),
    explicitHeading: Boolean(heading?.trim()),
    text,
  };
}

/** Two identical sections hash the same; keep both addressable. */
function uniqueId(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base;
  for (let i = 2; ; i++) {
    const id = `${base}-${i}`;
    if (!taken.includes(id)) return id;
  }
}

function deriveHeading(text: string): string {
  const first = text.split("\n").map((l) => l.trim()).find(Boolean) ?? "Section";
  const cleaned = first.replace(/^(?:[-*•–]|\d+[.)])\s*/, "").trim();
  const sentence = cleaned.split(/(?<=[.!?])\s/)[0] ?? cleaned;
  const label = sentence.length > 48 ? `${sentence.slice(0, 45).trimEnd()}…` : sentence;
  return label || "Section";
}

/** FNV-1a. Not cryptographic - it only has to be stable and cheap. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
