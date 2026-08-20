import { normalizeSpec, type DiagramSpec } from "./spec";

/**
 * Hand-written specs, one per layout, used by /fixtures to eyeball the
 * renderer without spending a model call. Because rendering is deterministic,
 * these double as the visual regression set.
 */
export const FIXTURES: { name: string; spec: DiagramSpec }[] = [
  {
    name: "flowchart - branching with edge labels",
    spec: normalizeSpec({
      type: "flowchart",
      title: "Support escalation",
      nodes: [
        { id: "ticket", label: "Ticket arrives", detail: "Support queue", group: null },
        { id: "triage", label: "Frontline triage", detail: null, group: null },
        { id: "resolve", label: "Resolve and close", detail: null, group: null },
        { id: "specialist", label: "Specialist review", detail: null, group: null },
        { id: "fix", label: "Ship a fix", detail: null, group: null },
        { id: "bug", label: "File a bug", detail: "Weekly triage", group: null },
        { id: "notify", label: "Notify reporter", detail: null, group: null },
      ],
      edges: [
        { from: "ticket", to: "triage", label: null },
        { from: "triage", to: "resolve", label: "known issue" },
        { from: "triage", to: "specialist", label: "unknown" },
        { from: "specialist", to: "fix", label: null },
        { from: "specialist", to: "bug", label: null },
        { from: "fix", to: "notify", label: null },
        { from: "bug", to: "notify", label: "on close" },
      ],
      groups: [],
    }),
  },
  {
    name: "flowchart - grouped stages",
    spec: normalizeSpec({
      type: "flowchart",
      title: "Text to diagram",
      nodes: [
        { id: "text", label: "Raw text", detail: null, group: "input" },
        { id: "llm", label: "Structure extraction", detail: "One model call", group: "model" },
        { id: "spec", label: "JSON spec", detail: null, group: "model" },
        { id: "layout", label: "Layout engine", detail: "Pure TypeScript", group: "render" },
        { id: "svg", label: "SVG renderer", detail: null, group: "render" },
        { id: "canvas", label: "Editor canvas", detail: null, group: "render" },
      ],
      edges: [
        { from: "text", to: "llm", label: null },
        { from: "llm", to: "spec", label: null },
        { from: "spec", to: "layout", label: null },
        { from: "layout", to: "svg", label: null },
        { from: "svg", to: "canvas", label: null },
      ],
      groups: [
        { id: "input", label: "Input" },
        { id: "model", label: "Model" },
        { id: "render", label: "Deterministic" },
      ],
    }),
  },
  {
    name: "cycle",
    spec: normalizeSpec({
      type: "cycle",
      title: "Continuous discovery",
      nodes: [
        { id: "interview", label: "Interview customers", detail: "Five a week", group: null },
        { id: "problems", label: "Prioritise problems", detail: null, group: null },
        { id: "sketch", label: "Sketch a solution", detail: null, group: null },
        { id: "prototype", label: "Test the prototype", detail: null, group: null },
        { id: "learn", label: "Fold in what we learn", detail: null, group: null },
      ],
      edges: [],
      groups: [],
    }),
  },
  {
    name: "hierarchy",
    spec: normalizeSpec({
      type: "hierarchy",
      title: "Platform team",
      nodes: [
        { id: "head", label: "Head of platform", detail: null, group: null },
        { id: "infra", label: "Infrastructure", detail: null, group: null },
        { id: "data", label: "Data", detail: null, group: null },
        { id: "dx", label: "Developer experience", detail: null, group: null },
        { id: "net", label: "Networking", detail: null, group: null },
        { id: "compute", label: "Compute", detail: null, group: null },
        { id: "pipelines", label: "Pipelines", detail: null, group: null },
      ],
      edges: [
        { from: "head", to: "infra", label: null },
        { from: "head", to: "data", label: null },
        { from: "head", to: "dx", label: null },
        { from: "infra", to: "net", label: null },
        { from: "infra", to: "compute", label: null },
        { from: "data", to: "pipelines", label: null },
      ],
      groups: [],
    }),
  },
  {
    name: "comparison",
    spec: normalizeSpec({
      type: "comparison",
      title: "Build vs buy",
      nodes: [
        { id: "b1", label: "Full control of the data model", detail: null, group: "build" },
        { id: "b2", label: "No per-seat cost at scale", detail: null, group: "build" },
        { id: "b3", label: "Two engineer-quarters", detail: "To a first version", group: "build" },
        { id: "y1", label: "Live in three weeks", detail: null, group: "buy" },
        { id: "y2", label: "Vendor owns PCI scope", detail: null, group: "buy" },
        { id: "y3", label: "Cost scales with revenue", detail: null, group: "buy" },
      ],
      edges: [],
      groups: [
        { id: "build", label: "Build in-house" },
        { id: "buy", label: "Buy off the shelf" },
      ],
    }),
  },
  {
    name: "list - the graceless-text fallback",
    spec: normalizeSpec({
      type: "list",
      title: "Notes from the old office",
      nodes: [
        { id: "n1", label: "The light came in sideways all afternoon", detail: null, group: null },
        { id: "n2", label: "Nobody agreed where the desks should go", detail: null, group: null },
        { id: "n3", label: "Somehow that never mattered", detail: null, group: null },
      ],
      edges: [],
      groups: [],
    }),
  },
  {
    name: "timeline - no layout yet, degrades to list",
    spec: normalizeSpec({
      type: "timeline",
      title: "Roadmap",
      nodes: [
        { id: "v0", label: "v0 ships the demo", detail: "One day", group: null },
        { id: "v1", label: "v1 adds the editor", detail: "Two to three days", group: null },
        { id: "v2", label: "v2 suggests variants", detail: null, group: null },
      ],
      edges: [],
      groups: [],
    }),
  },
];
