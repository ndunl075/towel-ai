/**
 * Themes are applied at render time, never baked into the spec. Swapping a
 * theme re-renders the same layout with different paint.
 *
 * Napkin's moat is design polish, so this file is deliberately opinionated:
 * a curated accent ramp, soft tints derived from it, and one type scale.
 */

export interface AccentPair {
  /** Border + arrow color. */
  stroke: string;
  /** Node body tint. */
  fill: string;
  /** Label color when sitting on `fill`. */
  text: string;
}

export interface Theme {
  id: string;
  name: string;
  /** Canvas background, also used as the PNG matte. */
  background: string;
  /** Subtle grid/paper texture color; null disables it. */
  grid: string | null;
  ink: string;
  muted: string;
  /** Cycled per node / per column so sibling shapes stay distinguishable. */
  accents: AccentPair[];
  node: {
    radius: number;
    strokeWidth: number;
    paddingX: number;
    paddingY: number;
    /** Drop shadow beneath node bodies; null disables it. */
    shadow: string | null;
  };
  edge: {
    stroke: string;
    width: number;
    /** Arrowhead length in px. */
    arrow: number;
    labelBackground: string;
  };
  group: {
    stroke: string;
    fill: string;
    radius: number;
    labelColor: string;
  };
  font: {
    family: string;
    title: number;
    label: number;
    detail: number;
    edgeLabel: number;
    /** Multiplied by font size to get line height. */
    lineHeight: number;
  };
}

const SANS =
  'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/**
 * v0 default. Warm paper ground, ink-dark type, five accents picked to hold
 * their own next to each other at both small and large node sizes.
 */
export const paperTheme: Theme = {
  id: "paper",
  name: "Paper",
  background: "#FBFAF7",
  grid: "#EDEAE3",
  ink: "#1B1A18",
  muted: "#6B665E",
  accents: [
    { stroke: "#4F46E5", fill: "#EDECFD", text: "#241E7A" },
    { stroke: "#0D9488", fill: "#E4F5F2", text: "#0A4A44" },
    { stroke: "#D97706", fill: "#FBF0DE", text: "#6B3A05" },
    { stroke: "#DB2777", fill: "#FCEAF2", text: "#6E1039" },
    { stroke: "#2563EB", fill: "#E7EFFE", text: "#12336E" },
  ],
  node: {
    radius: 12,
    strokeWidth: 1.5,
    paddingX: 18,
    paddingY: 14,
    shadow: "rgba(27, 26, 24, 0.07)",
  },
  edge: {
    stroke: "#A29B8F",
    width: 1.75,
    arrow: 9,
    labelBackground: "#FBFAF7",
  },
  group: {
    stroke: "#DCD7CC",
    fill: "#F4F2EC",
    radius: 16,
    labelColor: "#6B665E",
  },
  font: {
    family: SANS,
    title: 22,
    label: 15,
    detail: 12.5,
    edgeLabel: 11.5,
    lineHeight: 1.32,
  },
};

export const THEMES: Theme[] = [paperTheme];

export function getTheme(id: string | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? paperTheme;
}

/** Deterministic accent assignment so re-renders never reshuffle colors. */
export function accentFor(theme: Theme, index: number): AccentPair {
  return theme.accents[index % theme.accents.length];
}
