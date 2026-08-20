import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { heuristicExtract } from "./heuristic";
import {
  DIAGRAM_TYPES,
  DiagramSpecSchema,
  normalizeSpec,
  type DiagramSpec,
  type DiagramType,
} from "./spec";

const MODEL = process.env.NAPKIN_MODEL ?? "claude-opus-5";
const EFFORT = (process.env.NAPKIN_EFFORT ?? "medium") as "low" | "medium" | "high";

export type ExtractSource = "model" | "heuristic";

export interface ExtractResult {
  spec: DiagramSpec;
  source: ExtractSource;
  /** Populated when we fell back, so the UI can be honest about it. */
  note: string | null;
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
- 3-9 nodes is the readable range. Merge or drop detail rather than exceeding
  12 nodes.
- title is the subject of the diagram in under 8 words, or null if the text
  does not name one.
- Do not invent steps the text does not contain. If the text has no structure,
  return type "list" with each idea as one node.`;

/**
 * Stage 1 of the pipeline: exactly one model call, constrained to the spec
 * schema. One retry on an unusable response, then the heuristic extractor.
 */
export async function extractSpec(
  text: string,
  typeHint?: DiagramType,
): Promise<ExtractResult> {
  if (!hasCredentials()) {
    return {
      spec: applyHint(heuristicExtract(text), typeHint),
      source: "heuristic",
      note: "No ANTHROPIC_API_KEY set - used the built-in heuristic extractor.",
    };
  }

  const client = new Anthropic();
  let lastError = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.messages.parse({
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM,
        output_config: {
          format: zodOutputFormat(DiagramSpecSchema),
          effort: EFFORT,
        },
        messages: [{ role: "user", content: userPrompt(text, typeHint, lastError) }],
      });

      if (response.stop_reason === "refusal") {
        return {
          spec: applyHint(heuristicExtract(text), typeHint),
          source: "heuristic",
          note: "The model declined this text - rendered with the heuristic extractor.",
        };
      }

      const parsed = response.parsed_output;
      if (!parsed) {
        lastError = "The previous response did not match the schema.";
        continue;
      }

      const spec = normalizeSpec(parsed);
      if (spec.nodes.length === 0) {
        lastError = "The previous response contained no nodes.";
        continue;
      }

      return { spec: applyHint(spec, typeHint), source: "model", note: null };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (!isRetryable(error)) break;
    }
  }

  return {
    spec: applyHint(heuristicExtract(text), typeHint),
    source: "heuristic",
    note: `Extraction failed (${lastError || "unknown error"}) - fell back to the heuristic extractor.`,
  };
}

function userPrompt(text: string, typeHint: DiagramType | undefined, priorError: string): string {
  const parts: string[] = [];
  if (priorError) {
    parts.push(`${priorError} Return a valid diagram_spec this time.`);
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

function isRetryable(error: unknown): boolean {
  if (error instanceof Anthropic.APIError) {
    const status = error.status ?? 0;
    return status === 429 || status >= 500;
  }
  return error instanceof Anthropic.APIConnectionError;
}

export function hasCredentials(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}
