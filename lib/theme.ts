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

/** Cool, low-chroma, technical. One structural accent doing most of the work. */
export const blueprintTheme: Theme = {
  ...paperTheme,
  id: "blueprint",
  name: "Blueprint",
  background: "#F4F6F9",
  grid: "#E1E7EF",
  ink: "#12212F",
  muted: "#5C6B7A",
  accents: [
    { stroke: "#1D4ED8", fill: "#E6EDFC", text: "#122B6B" },
    { stroke: "#0E7490", fill: "#E2F1F5", text: "#0A3C48" },
    { stroke: "#475569", fill: "#EAEEF3", text: "#25303D" },
    { stroke: "#7E22CE", fill: "#F1E9FB", text: "#421070" },
    { stroke: "#0F766E", fill: "#E3F1EF", text: "#0A3F3A" },
  ],
  node: { ...paperTheme.node, radius: 4, strokeWidth: 1.5, shadow: null },
  edge: { ...paperTheme.edge, stroke: "#8C9AAA", width: 1.5, labelBackground: "#F4F6F9" },
  group: {
    stroke: "#CFD8E3",
    fill: "#EAEFF5",
    radius: 6,
    labelColor: "#5C6B7A",
  },
};

/** Dark. Saturated strokes on near-black, no shadows to muddy the contrast. */
export const midnightTheme: Theme = {
  ...paperTheme,
  id: "midnight",
  name: "Midnight",
  background: "#14161B",
  grid: "#22262E",
  ink: "#F2F3F5",
  muted: "#9BA3AF",
  accents: [
    { stroke: "#818CF8", fill: "#232544", text: "#DDDEFB" },
    { stroke: "#2DD4BF", fill: "#12332F", text: "#CBF5EE" },
    { stroke: "#FBBF24", fill: "#33280F", text: "#FBECC8" },
    { stroke: "#F472B6", fill: "#361A28", text: "#FBD9E8" },
    { stroke: "#60A5FA", fill: "#17293F", text: "#D3E4FB" },
  ],
  node: { ...paperTheme.node, radius: 12, strokeWidth: 1.5, shadow: null },
  edge: { ...paperTheme.edge, stroke: "#5B6270", width: 1.75, labelBackground: "#14161B" },
  group: {
    stroke: "#2E333D",
    fill: "#1B1E25",
    radius: 16,
    labelColor: "#9BA3AF",
  },
};

/** Loud and flat. Thick strokes, no tint gradient, for slides seen from the back row. */
export const markerTheme: Theme = {
  ...paperTheme,
  id: "marker",
  name: "Marker",
  background: "#FFFDF8",
  grid: null,
  ink: "#171512",
  muted: "#6E6656",
  accents: [
    { stroke: "#1F2937", fill: "#FDE68A", text: "#1F2937" },
    { stroke: "#1F2937", fill: "#A7F3D0", text: "#1F2937" },
    { stroke: "#1F2937", fill: "#BFDBFE", text: "#1F2937" },
    { stroke: "#1F2937", fill: "#FBCFE8", text: "#1F2937" },
    { stroke: "#1F2937", fill: "#DDD6FE", text: "#1F2937" },
  ],
  node: { radius: 14, strokeWidth: 2.5, paddingX: 20, paddingY: 15, shadow: null },
  edge: { stroke: "#1F2937", width: 2.5, arrow: 10, labelBackground: "#FFFDF8" },
  group: {
    stroke: "#1F2937",
    fill: "#FFF8E6",
    radius: 16,
    labelColor: "#171512",
  },
};

export const THEMES: Theme[] = [paperTheme, blueprintTheme, midnightTheme, markerTheme];

export function getTheme(id: string | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? paperTheme;
}

/** Deterministic accent assignment so re-renders never reshuffle colors. */
export function accentFor(theme: Theme, index: number): AccentPair {
  return theme.accents[index % theme.accents.length];
}
