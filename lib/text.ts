/**
 * Deterministic text metrics.
 *
 * Layout must produce identical geometry on the server and in the browser, so
 * it cannot measure with a canvas context. These per-character advance widths
 * are calibrated against the system sans stack in `theme.ts` and are accurate
 * to a few percent - close enough that padding absorbs the error.
 */

const NARROW = "iljtfrI.,;:!|'`()[]{}-/\\ ";
const WIDE = "mwMW@%";
const CAPS = "ABCDEFGHIJKLMNOPQRSTUVXYZ";

/** Advance width as a fraction of font size. */
function charWidth(ch: string): number {
  if (ch === " ") return 0.26;
  if (ch === "i" || ch === "l" || ch === "j" || ch === "." || ch === ",") return 0.26;
  if (NARROW.includes(ch)) return 0.32;
  if (WIDE.includes(ch)) return 0.9;
  if (CAPS.includes(ch)) return 0.68;
  if (ch >= "0" && ch <= "9") return 0.56;
  // Anything outside Latin-1 (CJK, emoji) is roughly full-width.
  if (ch.charCodeAt(0) > 0x2e80) return 1.0;
  return 0.545;
}

export function measureText(text: string, fontSize: number, bold = false): number {
  let units = 0;
  for (const ch of text) units += charWidth(ch);
  // Semibold runs a touch wider than regular.
  return units * fontSize * (bold ? 1.045 : 1);
}

export interface WrappedText {
  lines: string[];
  width: number;
  height: number;
}

/**
 * Greedy word wrap. Words longer than `maxWidth` are hard-broken so a single
 * URL can never blow out the node box.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number,
  lineHeight: number,
  opts: { bold?: boolean; maxLines?: number } = {},
): WrappedText {
  const bold = opts.bold ?? false;
  const maxLines = opts.maxLines ?? 4;
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  const push = () => {
    if (current) lines.push(current);
    current = "";
  };

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measureText(candidate, fontSize, bold) <= maxWidth || !current) {
      if (measureText(candidate, fontSize, bold) > maxWidth && !current) {
        // Single word too wide for the box: hard-break it.
        let chunk = "";
        for (const ch of word) {
          if (measureText(chunk + ch, fontSize, bold) > maxWidth && chunk) {
            lines.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        current = chunk;
        continue;
      }
      current = candidate;
    } else {
      push();
      current = word;
    }
  }
  push();

  let out = lines;
  if (out.length > maxLines) {
    out = out.slice(0, maxLines);
    const last = out[maxLines - 1];
    out[maxLines - 1] = `${last.replace(/[\s.,;:]+$/, "")}…`;
  }
  if (out.length === 0) out = [""];

  return {
    lines: out,
    width: Math.max(...out.map((l) => measureText(l, fontSize, bold))),
    height: out.length * fontSize * lineHeight,
  };
}
