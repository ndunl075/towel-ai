import "server-only";

import { z } from "zod";

import { DiagramSpecSchema, normalizeSpec, type DiagramSpec } from "../spec";

/**
 * Extraction against a local Ollama server.
 *
 * This is the local-first path the architecture note asks for: no key, no
 * network, no per-diagram cost. Ollama takes a JSON schema in `format` and
 * constrains decoding to it, which is the same guarantee the hosted path gets
 * from the SDK's structured output - so the spec that comes back is already the
 * right shape and the rest of the pipeline cannot tell the difference.
 */

const DEFAULT_HOST = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "llama3.1";

export function ollamaHost(): string {
  return (process.env.OLLAMA_HOST || DEFAULT_HOST).replace(/\/+$/, "");
}

export function ollamaModel(): string {
  return process.env.OLLAMA_MODEL || DEFAULT_MODEL;
}

function timeoutMs(): number {
  const raw = Number(process.env.NAPKIN_OLLAMA_TIMEOUT);
  return Number.isFinite(raw) && raw > 0 ? raw : 120_000;
}

/**
 * Reasoning models spend a long time thinking before they answer, and this is
 * an interactive path where a diagram in seconds beats a better diagram in
 * minutes. Off unless asked for; harmless on models that never think.
 */
function wantsThinking(): boolean {
  return /^(1|true|yes)$/i.test(process.env.NAPKIN_OLLAMA_THINK ?? "");
}

/** Cached because "auto" provider selection asks on every extraction. */
let reachable: { at: number; ok: boolean } | null = null;
const REACHABLE_TTL = 30_000;

export async function ollamaReachable(): Promise<boolean> {
  const now = Date.now();
  if (reachable && now - reachable.at < REACHABLE_TTL) return reachable.ok;
  let ok = false;
  try {
    const res = await fetch(`${ollamaHost()}/api/version`, {
      signal: AbortSignal.timeout(1500),
      cache: "no-store",
    });
    ok = res.ok;
  } catch {
    ok = false;
  }
  reachable = { at: now, ok };
  return ok;
}

export interface OllamaAttempt {
  spec: DiagramSpec | null;
  error: string | null;
  /**
   * Whether asking again could plausibly help. A malformed answer can be fixed
   * by re-asking with the error fed back; a server that is not there cannot,
   * and burning the second attempt on it only delays the heuristic fallback.
   */
  retry: boolean;
}

export async function ollamaExtract(system: string, user: string): Promise<OllamaAttempt> {
  const schema = z.toJSONSchema(DiagramSpecSchema);
  const body: Record<string, unknown> = {
    model: ollamaModel(),
    stream: false,
    format: schema,
    // Structure extraction has one right answer; sampling only adds variance.
    options: { temperature: 0 },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  if (!wantsThinking()) body.think = false;

  let response: Response;
  try {
    response = await fetch(`${ollamaHost()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs()),
      cache: "no-store",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Nothing to re-ask: the server is unreachable or the request timed out.
    return { spec: null, error: `Could not reach Ollama at ${ollamaHost()} (${message})`, retry: false };
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    // Older servers and non-reasoning models reject `think` outright rather
    // than ignoring it. Losing the whole extraction over an optional field
    // would be silly, so drop it and go again.
    if (!wantsThinking() && /think/i.test(detail)) {
      delete body.think;
      return retry(body);
    }
    return {
      spec: null,
      error: `Ollama returned ${response.status}${detail ? `: ${detail}` : ""}`,
      retry: response.status >= 500,
    };
  }

  return readSpec(await response.json().catch(() => null));
}

async function retry(body: Record<string, unknown>): Promise<OllamaAttempt> {
  try {
    const res = await fetch(`${ollamaHost()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs()),
      cache: "no-store",
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      return { spec: null, error: `Ollama returned ${res.status}${detail ? `: ${detail}` : ""}`, retry: res.status >= 500 };
    }
    return readSpec(await res.json().catch(() => null));
  } catch (error) {
    return {
      spec: null,
      error: error instanceof Error ? error.message : String(error),
      retry: false,
    };
  }
}

function readSpec(payload: unknown): OllamaAttempt {
  const content = (payload as { message?: { content?: unknown } } | null)?.message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    return { spec: null, error: "Ollama returned an empty message", retry: true };
  }

  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    return { spec: null, error: "Ollama did not return JSON", retry: true };
  }

  const parsed = DiagramSpecSchema.safeParse(json);
  if (!parsed.success) {
    return {
      spec: null,
      error: `Response did not match the schema: ${parsed.error.issues[0]?.message ?? "unknown"}`,
      retry: true,
    };
  }

  return { spec: normalizeSpec(parsed.data), error: null, retry: false };
}
