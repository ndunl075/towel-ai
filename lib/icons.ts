/**
 * The icon library.
 *
 * Same rule as everything else downstream of extraction: the model never draws.
 * Icons are a fixed local set matched against the words already in the spec, so
 * they cost nothing, render identically every time, and survive export - an
 * exported SVG has to stand on its own with no network behind it.
 *
 * Shapes are described rather than written as raw path data so each icon can be
 * authored correctly and restyled with the theme. Everything is stroked on a
 * 24x24 grid with no fills, which is what lets one icon sit legibly on four
 * different theme backgrounds.
 */

export type IconShape =
  | { k: "path"; d: string }
  | { k: "circle"; cx: number; cy: number; r: number }
  | { k: "line"; x1: number; y1: number; x2: number; y2: number }
  | { k: "rect"; x: number; y: number; w: number; h: number; r?: number };

export interface Icon {
  id: string;
  /** Shown in the picker. */
  label: string;
  /**
   * Matched as whole words against a node's label and detail. Order within the
   * library breaks ties, so put the specific ones first.
   */
  keywords: string[];
  shapes: IconShape[];
}

export const ICON_VIEWBOX = 24;

export const ICONS: Icon[] = [
  {
    id: "user",
    label: "Person",
    keywords: ["user", "person", "customer", "client", "agent", "reporter", "visitor", "someone"],
    shapes: [
      { k: "circle", cx: 12, cy: 8, r: 3.5 },
      { k: "path", d: "M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" },
    ],
  },
  {
    id: "users",
    label: "Team",
    keywords: ["team", "users", "people", "group", "staff", "everyone", "audience", "squad"],
    shapes: [
      { k: "circle", cx: 9, cy: 8, r: 3 },
      { k: "path", d: "M3 19c0-3.1 2.7-4.8 6-4.8s6 1.7 6 4.8" },
      { k: "path", d: "M16 5.5a3 3 0 0 1 0 5.8" },
      { k: "path", d: "M17.5 14.6c2.1.6 3.5 2.1 3.5 4.4" },
    ],
  },
  {
    id: "document",
    label: "Document",
    keywords: ["document", "doc", "file", "report", "paper", "form", "record", "contract", "spec"],
    shapes: [
      { k: "path", d: "M6 3h7l5 5v13H6z" },
      { k: "path", d: "M13 3v5h5" },
      { k: "line", x1: 9, y1: 13, x2: 15, y2: 13 },
      { k: "line", x1: 9, y1: 17, x2: 15, y2: 17 },
    ],
  },
  {
    id: "ticket",
    label: "Ticket",
    keywords: ["ticket", "issue", "case", "request", "enquiry", "inquiry"],
    shapes: [
      { k: "path", d: "M3 8.5V6h18v2.5a2.4 2.4 0 0 0 0 7V18H3v-2.5a2.4 2.4 0 0 0 0-7z" },
      { k: "line", x1: 13, y1: 9, x2: 13, y2: 15 },
    ],
  },
  {
    id: "inbox",
    label: "Queue",
    keywords: ["queue", "inbox", "backlog", "pipeline", "intake", "waiting"],
    shapes: [
      { k: "path", d: "M3 13h5l1.5 3h5L16 13h5" },
      { k: "path", d: "M3 13 6 5h12l3 8v6H3z" },
    ],
  },
  {
    id: "mail",
    label: "Email",
    keywords: ["email", "mail", "message", "notify", "notification", "invite", "newsletter"],
    shapes: [
      { k: "rect", x: 3, y: 5, w: 18, h: 14, r: 2 },
      { k: "path", d: "M3.5 6.5 12 13l8.5-6.5" },
    ],
  },
  {
    id: "chat",
    label: "Conversation",
    keywords: ["chat", "conversation", "interview", "feedback", "comment", "discuss", "talk", "support"],
    shapes: [{ k: "path", d: "M5 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" }],
  },
  {
    id: "calendar",
    label: "Calendar",
    keywords: ["calendar", "schedule", "date", "weekly", "monthly", "quarter", "meeting", "sprint"],
    shapes: [
      { k: "rect", x: 3.5, y: 5, w: 17, h: 15, r: 2 },
      { k: "line", x1: 3.5, y1: 10, x2: 20.5, y2: 10 },
      { k: "line", x1: 8, y1: 3, x2: 8, y2: 6.5 },
      { k: "line", x1: 16, y1: 3, x2: 16, y2: 6.5 },
    ],
  },
  {
    id: "clock",
    label: "Time",
    keywords: ["time", "clock", "delay", "wait", "duration", "deadline", "sla", "hours", "days"],
    shapes: [
      { k: "circle", cx: 12, cy: 12, r: 8.5 },
      { k: "path", d: "M12 7v5.3l3.4 2" },
    ],
  },
  {
    id: "search",
    label: "Research",
    keywords: ["search", "research", "discovery", "find", "investigate", "triage", "review", "audit", "analysis"],
    shapes: [
      { k: "circle", cx: 11, cy: 11, r: 6.5 },
      { k: "line", x1: 15.8, y1: 15.8, x2: 20.5, y2: 20.5 },
    ],
  },
  {
    id: "check",
    label: "Done",
    keywords: ["done", "complete", "approved", "resolve", "resolved", "close", "closed", "success", "pass", "accept", "verified", "confirm"],
    shapes: [
      { k: "circle", cx: 12, cy: 12, r: 8.5 },
      { k: "path", d: "m8.2 12.3 2.6 2.6 5-5.2" },
    ],
  },
  {
    id: "close",
    label: "Rejected",
    keywords: ["reject", "rejected", "fail", "failure", "cancel", "denied", "decline", "block", "stop", "error", "churn"],
    shapes: [
      { k: "circle", cx: 12, cy: 12, r: 8.5 },
      { k: "line", x1: 9.2, y1: 9.2, x2: 14.8, y2: 14.8 },
      { k: "line", x1: 14.8, y1: 9.2, x2: 9.2, y2: 14.8 },
    ],
  },
  {
    id: "alert",
    label: "Risk",
    keywords: ["risk", "alert", "warning", "escalate", "escalation", "urgent", "problem", "incident", "caution"],
    shapes: [
      { k: "path", d: "M12 3.8 21 19.5H3z" },
      { k: "line", x1: 12, y1: 10, x2: 12, y2: 14 },
      { k: "circle", cx: 12, cy: 16.8, r: 0.9 },
    ],
  },
  {
    id: "bug",
    label: "Bug",
    keywords: ["bug", "defect", "fault", "regression", "crash"],
    shapes: [
      { k: "rect", x: 8, y: 7.5, w: 8, h: 12, r: 4 },
      { k: "line", x1: 3.5, y1: 11, x2: 8, y2: 11 },
      { k: "line", x1: 16, y1: 11, x2: 20.5, y2: 11 },
      { k: "line", x1: 3.5, y1: 17, x2: 8, y2: 17 },
      { k: "line", x1: 16, y1: 17, x2: 20.5, y2: 17 },
      { k: "path", d: "M9.5 7.5 8 4.5" },
      { k: "path", d: "m14.5 7.5 1.5-3" },
    ],
  },
  {
    id: "wrench",
    label: "Fix",
    keywords: ["fix", "repair", "maintain", "patch", "tool", "build", "engineering", "specialist"],
    shapes: [
      { k: "path", d: "M15.5 3.5a5 5 0 0 0-5 6.4L4 16.4V20h3.6l6.5-6.5a5 5 0 0 0 6.4-5l-3 3-3.2-.8-.8-3.2z" },
    ],
  },
  {
    id: "lightbulb",
    label: "Idea",
    keywords: ["idea", "insight", "learn", "concept", "sketch", "brainstorm", "hypothesis", "proposal"],
    shapes: [
      { k: "path", d: "M12 3.5a6 6 0 0 1 3.6 10.8V17H8.4v-2.7A6 6 0 0 1 12 3.5z" },
      { k: "line", x1: 9.5, y1: 20, x2: 14.5, y2: 20 },
    ],
  },
  {
    id: "rocket",
    label: "Launch",
    keywords: ["launch", "ship", "release", "deploy", "rollout", "go-live", "start", "begin", "kickoff"],
    shapes: [
      { k: "path", d: "M12 3c3.2 2.4 5 6 5 10l-2.5 3h-5L7 13c0-4 1.8-7.6 5-10z" },
      { k: "circle", cx: 12, cy: 10.5, r: 2 },
      { k: "path", d: "M9.5 18.5c-.8 1.3-.9 2.4-.5 3.5 1.1-.4 2-1.1 2.5-2.2" },
      { k: "path", d: "M14.5 18.5c.8 1.3.9 2.4.5 3.5-1.1-.4-2-1.1-2.5-2.2" },
    ],
  },
  {
    id: "cycle",
    label: "Repeat",
    keywords: ["repeat", "loop", "iterate", "cycle", "again", "continuous", "recurring", "feedback"],
    shapes: [
      { k: "path", d: "M20 12a8 8 0 0 1-13.7 5.6" },
      { k: "path", d: "M4 12a8 8 0 0 1 13.7-5.6" },
      { k: "path", d: "M17.5 3v3.6h-3.6" },
      { k: "path", d: "M6.5 21v-3.6h3.6" },
    ],
  },
  {
    id: "filter",
    label: "Filter",
    keywords: ["filter", "narrow", "qualify", "screen", "shortlist", "funnel", "sort"],
    shapes: [{ k: "path", d: "M3.5 5h17l-6.5 7.6V20l-4-2.2v-5.2z" }],
  },
  {
    id: "chart",
    label: "Metrics",
    keywords: ["metric", "metrics", "chart", "report", "analytics", "measure", "stats", "number", "volume", "traffic", "visits"],
    shapes: [
      { k: "line", x1: 4, y1: 20, x2: 20, y2: 20 },
      { k: "rect", x: 6, y: 12, w: 3.4, h: 6 },
      { k: "rect", x: 11.3, y: 8, w: 3.4, h: 10 },
      { k: "rect", x: 16.6, y: 14, w: 3.4, h: 4 },
    ],
  },
  {
    id: "trending-up",
    label: "Growth",
    keywords: ["growth", "increase", "scale", "improve", "up", "convert", "conversion", "revenue"],
    shapes: [
      { k: "path", d: "m3.5 17 5.5-5.5 3.5 3.5 6-6.5" },
      { k: "path", d: "M14.5 8.5h4v4" },
    ],
  },
  {
    id: "money",
    label: "Money",
    keywords: ["money", "cost", "price", "pricing", "billing", "payment", "paid", "invoice", "budget", "spend", "revenue", "vendor", "charge"],
    shapes: [
      { k: "circle", cx: 12, cy: 12, r: 8.5 },
      { k: "path", d: "M14.6 9.2c-.6-.8-1.6-1.2-2.6-1.2-1.7 0-2.8.9-2.8 2.1 0 3 5.6 1.5 5.6 4.5 0 1.3-1.2 2.2-2.8 2.2-1.2 0-2.2-.5-2.8-1.4" },
      { k: "line", x1: 12, y1: 6, x2: 12, y2: 18 },
    ],
  },
  {
    id: "cart",
    label: "Purchase",
    keywords: ["purchase", "buy", "cart", "order", "checkout", "shop", "sale", "sell"],
    shapes: [
      { k: "path", d: "M3 4h2.2l2.3 10.5h9.4L19 7H6" },
      { k: "circle", cx: 9, cy: 19, r: 1.5 },
      { k: "circle", cx: 16.5, cy: 19, r: 1.5 },
    ],
  },
  {
    id: "database",
    label: "Data",
    keywords: ["data", "database", "store", "storage", "warehouse", "records", "dataset", "table"],
    shapes: [
      { k: "path", d: "M4.5 6c0-1.4 3.4-2.5 7.5-2.5S19.5 4.6 19.5 6s-3.4 2.5-7.5 2.5S4.5 7.4 4.5 6z" },
      { k: "path", d: "M4.5 6v12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5V6" },
      { k: "path", d: "M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5" },
    ],
  },
  {
    id: "server",
    label: "Infrastructure",
    keywords: ["server", "infrastructure", "infra", "host", "hosting", "platform", "compute", "machine"],
    shapes: [
      { k: "rect", x: 3.5, y: 4, w: 17, h: 6.5, r: 1.5 },
      { k: "rect", x: 3.5, y: 13.5, w: 17, h: 6.5, r: 1.5 },
      { k: "line", x1: 7, y1: 7.2, x2: 7.01, y2: 7.2 },
      { k: "line", x1: 7, y1: 16.8, x2: 7.01, y2: 16.8 },
    ],
  },
  {
    id: "cloud",
    label: "Cloud",
    keywords: ["cloud", "saas", "hosted", "remote", "online", "internet", "web"],
    shapes: [{ k: "path", d: "M7.5 18.5a4 4 0 0 1-.4-8A5.5 5.5 0 0 1 17.6 11a3.8 3.8 0 0 1-.6 7.5z" }],
  },
  {
    id: "code",
    label: "Code",
    keywords: ["code", "develop", "development", "implement", "programming", "software", "api"],
    shapes: [
      { k: "path", d: "m8.5 8.5-4.5 3.5 4.5 3.5" },
      { k: "path", d: "m15.5 8.5 4.5 3.5-4.5 3.5" },
      { k: "line", x1: 13.2, y1: 5, x2: 10.8, y2: 19 },
    ],
  },
  {
    id: "lock",
    label: "Security",
    keywords: ["security", "secure", "lock", "auth", "compliance", "privacy", "permission", "access", "pci"],
    shapes: [
      { k: "rect", x: 4.5, y: 10.5, w: 15, h: 9.5, r: 2 },
      { k: "path", d: "M8 10.5V8a4 4 0 0 1 8 0v2.5" },
    ],
  },
  {
    id: "shield",
    label: "Protection",
    keywords: ["protect", "protection", "shield", "guard", "safety", "reliability", "backup"],
    shapes: [{ k: "path", d: "M12 3.2 20 6v6c0 4.6-3.3 7.9-8 9.3-4.7-1.4-8-4.7-8-9.3V6z" }],
  },
  {
    id: "globe",
    label: "Global",
    keywords: ["global", "world", "globe", "international", "market", "region", "country"],
    shapes: [
      { k: "circle", cx: 12, cy: 12, r: 8.5 },
      { k: "line", x1: 3.5, y1: 12, x2: 20.5, y2: 12 },
      { k: "path", d: "M12 3.5c2.2 2.4 3.4 5.4 3.4 8.5s-1.2 6.1-3.4 8.5c-2.2-2.4-3.4-5.4-3.4-8.5s1.2-6.1 3.4-8.5z" },
    ],
  },
  {
    id: "building",
    label: "Company",
    keywords: ["company", "business", "office", "organisation", "organization", "enterprise", "vendor", "department", "building"],
    shapes: [
      { k: "rect", x: 4.5, y: 4, w: 15, h: 16, r: 1.5 },
      { k: "line", x1: 9, y1: 8.5, x2: 11, y2: 8.5 },
      { k: "line", x1: 13, y1: 8.5, x2: 15, y2: 8.5 },
      { k: "line", x1: 9, y1: 12.5, x2: 11, y2: 12.5 },
      { k: "line", x1: 13, y1: 12.5, x2: 15, y2: 12.5 },
      { k: "path", d: "M10.5 20v-3.5h3V20" },
    ],
  },
  {
    id: "flag",
    label: "Milestone",
    keywords: ["milestone", "flag", "goal", "target", "objective", "phase", "stage", "step"],
    shapes: [
      { k: "path", d: "M6 4h11l-2 3.5L17 11H6" },
      { k: "line", x1: 6, y1: 3, x2: 6, y2: 21 },
    ],
  },
  {
    id: "star",
    label: "Priority",
    keywords: ["priority", "star", "favourite", "favorite", "best", "premium", "pro", "highlight", "featured"],
    shapes: [{ k: "path", d: "m12 3.8 2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9z" }],
  },
  {
    id: "layers",
    label: "Layers",
    keywords: ["layer", "layers", "tier", "tiers", "level", "stack", "architecture", "component"],
    shapes: [
      { k: "path", d: "m12 3.5 8.5 4.3L12 12 3.5 7.8z" },
      { k: "path", d: "m3.5 12.2 8.5 4.3 8.5-4.3" },
      { k: "path", d: "m3.5 16.4 8.5 4.3 8.5-4.3" },
    ],
  },
  {
    id: "branch",
    label: "Branch",
    keywords: ["branch", "split", "decision", "fork", "option", "choice", "either", "variant"],
    shapes: [
      { k: "circle", cx: 7, cy: 5.5, r: 2.2 },
      { k: "circle", cx: 7, cy: 18.5, r: 2.2 },
      { k: "circle", cx: 17, cy: 9.5, r: 2.2 },
      { k: "path", d: "M7 7.7v8.6" },
      { k: "path", d: "M17 11.7c0 3-2.4 4.6-6.5 5.2" },
      { k: "path", d: "M7 5.5h5a5 5 0 0 1 5 4" },
    ],
  },
  {
    id: "target",
    label: "Outcome",
    keywords: ["outcome", "result", "aim", "hit", "focus", "precision", "accuracy"],
    shapes: [
      { k: "circle", cx: 12, cy: 12, r: 8.5 },
      { k: "circle", cx: 12, cy: 12, r: 5 },
      { k: "circle", cx: 12, cy: 12, r: 1.6 },
    ],
  },
  {
    id: "bolt",
    label: "Fast",
    keywords: ["fast", "quick", "speed", "instant", "performance", "power", "energy", "trigger", "automatic"],
    shapes: [{ k: "path", d: "M13.5 2.5 5 13.5h5.5L9.5 21.5 19 10.5h-5.8z" }],
  },
  {
    id: "home",
    label: "Home",
    keywords: ["home", "landing", "main", "start page", "dashboard", "overview"],
    shapes: [
      { k: "path", d: "m3.5 11 8.5-7 8.5 7" },
      { k: "path", d: "M5.8 9.2V20h12.4V9.2" },
      { k: "path", d: "M10 20v-5.5h4V20" },
    ],
  },
];

const BY_ID = new Map(ICONS.map((icon) => [icon.id, icon]));

export function getIcon(id: string | null | undefined): Icon | null {
  return id ? (BY_ID.get(id) ?? null) : null;
}

/**
 * Keyword lookup, longest match first so "trial" never beats "free trial" and a
 * generic word never beats a specific one. Whole words only - "process" must
 * not match inside "processor".
 */
const INDEX: { keyword: string; icon: Icon }[] = ICONS.flatMap((icon) =>
  icon.keywords.map((keyword) => ({ keyword: keyword.toLowerCase(), icon })),
).sort((a, b) => b.keyword.length - a.keyword.length);

export function matchIcon(text: string): Icon | null {
  const haystack = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
  if (haystack.trim().length === 0) return null;
  for (const entry of INDEX) {
    if (haystack.includes(` ${entry.keyword} `)) return entry.icon;
  }
  return null;
}

/** What the auto-matcher would pick for a node, before any user override. */
export function autoIconFor(label: string, detail: string | null): string | null {
  return (matchIcon(label) ?? (detail ? matchIcon(detail) : null))?.id ?? null;
}
