import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { DiagramSpecSchema, normalizeSpec, type DiagramSpec } from "../spec";

/** Extraction against the hosted API, with schema-constrained decoding. */

const DEFAULT_MODEL = "claude-opus-5";

export function anthropicModel(): string {
  return process.env.NAPKIN_MODEL || DEFAULT_MODEL;
}

function effort(): "low" | "medium" | "high" {
  const raw = process.env.NAPKIN_EFFORT;
  return raw === "low" || raw === "high" ? raw : "medium";
}

export function hasCredentials(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export interface AnthropicAttempt {
  spec: DiagramSpec | null;
  error: string | null;
  /** Whether asking again could plausibly help. */
  retry: boolean;
  /** The model declined the text outright; retrying will not change that. */
  refused: boolean;
}

export async function anthropicExtract(system: string, user: string): Promise<AnthropicAttempt> {
  const client = new Anthropic();
  try {
    const response = await client.messages.parse({
      model: anthropicModel(),
      max_tokens: 8000,
      system,
      output_config: {
        format: zodOutputFormat(DiagramSpecSchema),
        effort: effort(),
      },
      messages: [{ role: "user", content: user }],
    });

    if (response.stop_reason === "refusal") {
      return { spec: null, error: "The model declined this text", retry: false, refused: true };
    }

    const parsed = response.parsed_output;
    if (!parsed) {
      return {
        spec: null,
        error: "The previous response did not match the schema.",
        retry: true,
        refused: false,
      };
    }

    return { spec: normalizeSpec(parsed), error: null, retry: false, refused: false };
  } catch (error) {
    return {
      spec: null,
      error: error instanceof Error ? error.message : String(error),
      retry: isRetryable(error),
      refused: false,
    };
  }
}

function isRetryable(error: unknown): boolean {
  if (error instanceof Anthropic.APIError) {
    const status = error.status ?? 0;
    return status === 429 || status >= 500;
  }
  return error instanceof Anthropic.APIConnectionError;
}
