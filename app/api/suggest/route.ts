import { NextResponse } from "next/server";

import { extractVariants } from "@/lib/extract";
import { clientKey, sharedLimiter } from "@/lib/ratelimit";
import { DIAGRAM_TYPES, type DiagramType } from "@/lib/spec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHARS = 8000;
/**
 * One user action, several model calls. The cap is what keeps "show me
 * alternatives" from being an unbounded multiplier on someone's quota.
 */
const MAX_VARIANTS = 3;

/**
 * Shared with every other route that spends the deployer's quota, so the cap
 * bounds total spend rather than spend per endpoint.
 */
const limiter = sharedLimiter();

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const { text, types } = (body ?? {}) as { text?: unknown; types?: unknown };

  if (typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "Paste some text first" }, { status: 400 });
  }
  if (text.length > MAX_CHARS) {
    return NextResponse.json(
      { error: `Text is ${text.length} characters; the limit is ${MAX_CHARS}` },
      { status: 413 },
    );
  }

  const wanted = (Array.isArray(types) ? types : [])
    .filter((t): t is DiagramType => typeof t === "string" && DIAGRAM_TYPES.includes(t as DiagramType))
    .slice(0, MAX_VARIANTS);

  if (wanted.length === 0) {
    return NextResponse.json({ error: "Name at least one diagram type" }, { status: 400 });
  }

  // Charged for every call it is about to make, not once for the request.
  const rate = limiter.check(clientKey(request), wanted.length);
  if (!rate.ok) {
    return NextResponse.json(
      {
        error: `Not enough request budget for ${wanted.length} alternatives - try again in ${rate.retryAfter}s`,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfter),
          "RateLimit-Limit": String(rate.limit),
          "RateLimit-Remaining": String(rate.remaining),
        },
      },
    );
  }

  try {
    const variants = await extractVariants(text, wanted);
    return NextResponse.json(
      { variants },
      {
        headers: {
          "RateLimit-Limit": String(rate.limit),
          "RateLimit-Remaining": String(rate.remaining),
        },
      },
    );
  } catch (error) {
    console.error("suggest route failed", error);
    return NextResponse.json({ error: "Could not build alternatives" }, { status: 500 });
  }
}
