import { NextResponse } from "next/server";

import { extractSpec } from "@/lib/extract";
import { clientKey, configFromEnv, createRateLimiter } from "@/lib/ratelimit";
import { DIAGRAM_TYPES, type DiagramType } from "@/lib/spec";

export const runtime = "nodejs";
/** Extraction is a live model call; nothing here is cacheable. */
export const dynamic = "force-dynamic";

const MAX_CHARS = 8000;

/**
 * Module scope, so the counters live as long as the server process does. This
 * is the only route that can spend the deployer's Anthropic quota, and the
 * repo is public - see lib/ratelimit.ts for what this does and does not cover.
 */
const limiter = createRateLimiter(configFromEnv());

export async function POST(request: Request) {
  // Checked before parsing the body: a rejected caller should cost us nothing.
  const rate = limiter.check(clientKey(request));
  if (!rate.ok) {
    return NextResponse.json(
      { error: `Too many requests - try again in ${rate.retryAfter}s` },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfter),
          "RateLimit-Limit": String(rate.limit),
          "RateLimit-Remaining": "0",
        },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const { text, typeHint } = (body ?? {}) as { text?: unknown; typeHint?: unknown };

  if (typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "Paste some text first" }, { status: 400 });
  }
  if (text.length > MAX_CHARS) {
    return NextResponse.json(
      { error: `Text is ${text.length} characters; the limit is ${MAX_CHARS}` },
      { status: 413 },
    );
  }

  const hint =
    typeof typeHint === "string" && DIAGRAM_TYPES.includes(typeHint as DiagramType)
      ? (typeHint as DiagramType)
      : undefined;

  try {
    const result = await extractSpec(text, hint);
    return NextResponse.json(result, {
      headers: {
        "RateLimit-Limit": String(rate.limit),
        "RateLimit-Remaining": String(rate.remaining),
      },
    });
  } catch (error) {
    console.error("extract route failed", error);
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }
}
