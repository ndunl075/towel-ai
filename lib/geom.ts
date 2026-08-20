export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function center(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export function expand(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, w: r.w + by * 2, h: r.h + by * 2 };
}

export function boundsOf(rects: Rect[]): Rect {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.w));
  const bottom = Math.max(...rects.map((r) => r.y + r.h));
  return { x, y, w: right - x, h: bottom - y };
}

/**
 * Where the segment from `inside` to `outside` crosses the rect border.
 * Used to park arrowheads on the node edge instead of its center.
 */
export function borderPoint(rect: Rect, inside: Point, outside: Point): Point {
  const dx = outside.x - inside.x;
  const dy = outside.y - inside.y;
  if (dx === 0 && dy === 0) return inside;

  const halfW = rect.w / 2;
  const halfH = rect.h / 2;
  const c = center(rect);
  // Scale the direction vector until it touches the nearer pair of sides.
  const scaleX = dx === 0 ? Infinity : halfW / Math.abs(dx);
  const scaleY = dy === 0 ? Infinity : halfH / Math.abs(dy);
  const t = Math.min(scaleX, scaleY);
  return { x: c.x + dx * t, y: c.y + dy * t };
}

function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Drops points closer together than `min`, always keeping the endpoints. */
export function simplify(points: Point[], min = 4): Point[] {
  if (points.length <= 2) return points;
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    if (dist(out[out.length - 1], points[i]) >= min) out.push(points[i]);
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Polyline with rounded corners. Reads cleaner than raw dagre elbows. */
export function roundedPath(points: Point[], radius = 12): string {
  const pts = simplify(points);
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
  if (pts.length === 2) {
    return `M ${fmt(pts[0].x)} ${fmt(pts[0].y)} L ${fmt(pts[1].x)} ${fmt(pts[1].y)}`;
  }

  let d = `M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const next = pts[i + 1];
    const rIn = Math.min(radius, dist(prev, curr) / 2);
    const rOut = Math.min(radius, dist(curr, next) / 2);
    const a = lerpTowards(curr, prev, rIn);
    const b = lerpTowards(curr, next, rOut);
    d += ` L ${fmt(a.x)} ${fmt(a.y)} Q ${fmt(curr.x)} ${fmt(curr.y)} ${fmt(b.x)} ${fmt(b.y)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${fmt(last.x)} ${fmt(last.y)}`;
  return d;
}

function lerpTowards(from: Point, to: Point, distance: number): Point {
  const len = dist(from, to) || 1;
  const t = Math.min(1, distance / len);
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

/** Point at `t` along a polyline, plus the local direction. Used for labels. */
export function pointAlong(points: Point[], t: number): { point: Point; angle: number } {
  if (points.length < 2) {
    return { point: points[0] ?? { x: 0, y: 0 }, angle: 0 };
  }
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const len = dist(points[i - 1], points[i]);
    lengths.push(len);
    total += len;
  }
  let target = total * t;
  for (let i = 0; i < lengths.length; i++) {
    if (target <= lengths[i] || i === lengths.length - 1) {
      const a = points[i];
      const b = points[i + 1];
      const local = lengths[i] === 0 ? 0 : target / lengths[i];
      return {
        point: { x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local },
        angle: Math.atan2(b.y - a.y, b.x - a.x),
      };
    }
    target -= lengths[i];
  }
  return { point: points[points.length - 1], angle: 0 };
}

export function polarPoint(cx: number, cy: number, radius: number, angle: number): Point {
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}

/** Two decimals keeps exported SVG small and diff-friendly. */
export function fmt(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Commands emitted by this module, tokenised. Paths here only ever use
 * absolute M/L/Q, which keeps both bounds and translation exact.
 */
export interface PathCommand {
  cmd: "M" | "L" | "Q";
  coords: number[];
}

export function parsePath(d: string): PathCommand[] {
  const tokens = d.split(/\s+/).filter(Boolean);
  const out: PathCommand[] = [];
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i] as PathCommand["cmd"];
    i++;
    const arity = cmd === "Q" ? 4 : 2;
    const coords: number[] = [];
    for (let k = 0; k < arity; k++) coords.push(Number(tokens[i + k]));
    i += arity;
    if (coords.some(Number.isNaN)) continue;
    out.push({ cmd, coords });
  }
  return out;
}

export function translatePath(d: string, dx: number, dy: number): string {
  if (!d) return d;
  return parsePath(d)
    .map(({ cmd, coords }) => {
      const moved = coords.map((n, k) => fmt(n + (k % 2 === 0 ? dx : dy)));
      return `${cmd} ${moved.join(" ")}`;
    })
    .join(" ");
}

/** Tight bounding box of a path, including the true extremes of any curve. */
export function pathBounds(d: string): Rect | null {
  const commands = parsePath(d);
  if (commands.length === 0) return null;

  const xs: number[] = [];
  const ys: number[] = [];
  let cursor: Point | null = null;

  for (const { cmd, coords } of commands) {
    if (cmd === "M" || cmd === "L") {
      cursor = { x: coords[0], y: coords[1] };
      xs.push(cursor.x);
      ys.push(cursor.y);
      continue;
    }
    // Quadratic: endpoints plus the axis extremes between them.
    const control = { x: coords[0], y: coords[1] };
    const endPoint = { x: coords[2], y: coords[3] };
    const start = cursor ?? endPoint;
    xs.push(start.x, endPoint.x, ...quadraticExtremes(start.x, control.x, endPoint.x));
    ys.push(start.y, endPoint.y, ...quadraticExtremes(start.y, control.y, endPoint.y));
    cursor = endPoint;
  }

  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** The turning point of a quadratic on one axis, when it falls inside 0..1. */
function quadraticExtremes(p0: number, p1: number, p2: number): number[] {
  const denominator = p0 - 2 * p1 + p2;
  if (Math.abs(denominator) < 1e-9) return [];
  const t = (p0 - p1) / denominator;
  if (t <= 0 || t >= 1) return [];
  const mt = 1 - t;
  return [mt * mt * p0 + 2 * mt * t * p1 + t * t * p2];
}
