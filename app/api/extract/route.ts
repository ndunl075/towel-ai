import { NextResponse } from "next/server";

import { extractSpec } from "@/lib/extract";
import { DIAGRAM_TYPES, type DiagramType } from "@/lib/spec";

export const runtime = "nodejs";
/** Extraction is a live model call; nothing here is cacheable. */
export const dynamic = "force-dynamic";

const MAX_CHARS = 8000;

export async function POST(request: Request) {
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
    return NextResponse.json(result);
  } catch (error) {
    console.error("extract route failed", error);
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }
}
