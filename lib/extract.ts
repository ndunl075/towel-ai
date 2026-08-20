import "server-only";

import { heuristicExtract } from "./heuristic";
import { anthropicExtract, anthropicModel, hasCredentials } from "./providers/anthropic";
import { ollamaExtract, ollamaModel, ollamaReachable } from "./providers/ollama";
import { DIAGRAM_TYPES, type DiagramSpec, type DiagramType } from "./spec";

export type ProviderId = "anthropic" | "ollama";
export type ExtractSource = "model" | "heuristic";

export interface ExtractResult {
  spec: DiagramSpec;
  source: ExtractSource;
  /** Populated when we fell back, so the UI can be honest about it. */
  note: string | null;
  /** Which provider produced the spec, or null when the heuristic did. */
  provider: ProviderId | null;
}

const SYSTEM = `You turn prose into the structure of a diagram. You never draw
anything and you never describe visuals - a deterministic renderer does that.
Your only job is to classify the text and pull out its parts.

Pick the type that matches the structure actually present in the text:
- flowchart: a process, pipeline, or decision flow with a direction
- cycle: steps that return to the beginning
- hierarchy: containment or reporting relationships, org charts, taxonomies
- timeline: events anchored to points in time
- comparison: two or more named options weighed against each other
- funnel: stages that narrow, each a subset of the last
- venn: sets that overlap
- list: anything else, including pure narrative with no structure

Rules:
- Node labels are 1-6 words, title case off, no trailing punctuation. Put any
  extra explanation in "detail" (one short clause), or leave detail null.
- Ids are short lowercase slugs, unique, and every edge endpoint must be an
  existing node id.
- Edges carry a label only when the text names the relationship ("if approved",
  "on failure"). Otherwise null.
- groups are the columns of a comparison, the branches of a hierarchy, or the
  named sections of a flowchart. Leave empty when the text has no grouping.
  Every node.group must match a declared group id.
- For cycle, list the nodes in the order they occur and connect them in that
  order, including the edge back to the first node.
- For timeline, list events in chronological order and put the time itself in
  "detail" ("Q3 2024", "day one"). Edges are not needed.
- For funnel, list stages widest first, each a subset of the one above.
- For venn, declare two or three groups as the sets. A node that belongs to one
  set carries that group id; a node shared by every set has group null. Do not
  invent a group for the overlap.
- 3-9 nodes is the readable range. Merge or drop detail rather than exceeding
  12 nodes.
- title is the subject of the diagram in under 8 words, or null if the text
  does not name one.
- Do not invent steps the text does not contain. If the text has no structure,
  return type "list" with each idea as one node.`;

/**
 * Which backend to use.
 *
 * "auto" prefers the hosted API when a key is configured and otherwise falls to
 * a local Ollama server, which is the local-first angle: no key, no network, no
 * per-diagram cost. Naming a provider explicitly skips the guessing, and is
 * what you want when both are available.
 */
export async function selectProvider(): Promise<ProviderId | null> {
  const requested = (process.env.NAPKIN_PROVIDER ?? "auto").toLowerCase();

  if (requested === "anthropic") return hasCredentials() ? "anthropic" : null;
  if (requested === "ollama") return "ollama";

  if (hasCredentials()) return "anthropic";
  return (await ollamaReachable()) ? "ollama" : null;
}

export function providerLabel(provider: ProviderId): string {
  return provider === "anthropic"
    ? `the model (${anthropicModel()})`
    : `Ollama (${ollamaModel()})`;
}

/**
 * Stage 1 of the pipeline: one model call, constrained to the spec schema. One
 * retry on an unusable response, then the heuristic extractor. The provider is
 * interchangeable because both of them return a spec that already matched the
 * schema - nothing downstream can tell which one ran.
 */
export async function extractSpec(text: string, typeHint?: DiagramType): Promise<ExtractResult> {
  const provider = await selectProvider();

  if (!provider) {
    return {
      spec: applyHint(heuristicExtract(text), typeHint),
      source: "heuristic",
      note: noProviderNote(),
      provider: null,
    };
  }

  let lastError = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const user = userPrompt(text, typeHint, lastError);
    const result =
      provider === "anthropic"
        ? await anthropicExtract(SYSTEM, user)
        : await ollamaExtract(SYSTEM, user);

    if ("refused" in result && result.refused) {
      return {
        spec: applyHint(heuristicExtract(text), typeHint),
        source: "heuristic",
        note: "The model declined this text - rendered with the heuristic extractor.",
        provider: null,
      };
    }

    if (result.spec && result.spec.nodes.length > 0) {
      return { spec: applyHint(result.spec, typeHint), source: "model", note: null, provider };
    }

    if (result.spec) {
      // Schema-valid but empty. Worth one re-ask with the complaint attached.
      lastError = "The previous response contained no nodes.";
      continue;
    }

    lastError = result.error ?? "unknown error";
    if (!result.retry) break;
  }

  return {
    spec: applyHint(heuristicExtract(text), typeHint),
    source: "heuristic",
    note: `${providerLabel(provider)} could not produce a usable spec (${lastError || "unknown error"}) - fell back to the heuristic extractor.`,
    provider: null,
  };
}

function noProviderNote(): string {
  const requested = (process.env.NAPKIN_PROVIDER ?? "auto").toLowerCase();
  if (requested === "anthropic") {
    return "NAPKIN_PROVIDER=anthropic but no ANTHROPIC_API_KEY is set - used the built-in heuristic extractor.";
  }
  return "No ANTHROPIC_API_KEY set and no Ollama server found - used the built-in heuristic extractor.";
}

function userPrompt(text: string, typeHint: DiagramType | undefined, priorError: string): string {
  const parts: string[] = [];
  if (priorError) {
    parts.push(`${priorError} Return a valid diagram spec this time.`);
  }
  if (typeHint) {
    parts.push(
      `The user has pinned the diagram type to "${typeHint}". Use that type and shape the nodes and edges to suit it, even if another type would be a closer fit.`,
    );
  }
  parts.push("Text:\n\n" + text);
  return parts.join("\n\n");
}

/**
 * A pinned type is the user's escape hatch for misclassification, so it wins
 * over whatever the model returned.
 */
function applyHint(spec: DiagramSpec, typeHint?: DiagramType): DiagramSpec {
  if (!typeHint || !DIAGRAM_TYPES.includes(typeHint)) return spec;
  return { ...spec, type: typeHint };
}

export { hasCredentials };
