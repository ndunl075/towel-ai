/**
 * A small fixed-memory rate limiter for the one route that spends money.
 *
 * This exists because the app is bring-your-own-key and the repo is public.
 * Run locally, the limit never fires. Deployed publicly with a key set,
 * `/api/extract` is otherwise an open proxy onto the deployer's Anthropic
 * quota, and the character cap in the route bounds the size of a request
 * without bounding how many arrive.
 *
 * What this is not: a defence against a determined attacker. State is per
 * process, so serverless instances each keep their own counters and a cold
 * start forgets everything, and the client key comes from a proxy header that
 * only the hop in front of you can be trusted to set. It stops casual abuse
 * and runaway clients. Anything facing real traffic wants a shared store and a
 * limiter at the edge.
 */

export interface RateLimitConfig {
  /** Requests allowed per window. 0 disables the limiter entirely. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /**
   * Cap on distinct keys held at once. Bounds memory: without it, a stream of
   * unique keys grows the map forever.
   */
  maxKeys: number;
}

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the oldest hit leaves the window. 0 when `ok`. */
  retryAfter: number;
}

export interface RateLimiter {
  check(key: string, now?: number): RateLimitResult;
  /** Test seam. */
  reset(): void;
  readonly size: number;
}

const ALLOWED: RateLimitResult = { ok: true, limit: 0, remaining: Infinity, retryAfter: 0 };

export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  const { limit, windowMs, maxKeys } = config;
  /** key -> timestamps of hits still inside the window, oldest first. */
  const hits = new Map<string, number[]>();

  function sweep(now: number): void {
    for (const [key, times] of hits) {
      // Every entry is older than the window, so the key is idle.
      if (times.length === 0 || times[times.length - 1] <= now - windowMs) hits.delete(key);
    }
  }

  return {
    check(key: string, now = Date.now()): RateLimitResult {
      if (limit <= 0) return ALLOWED;

      const cutoff = now - windowMs;
      const previous = hits.get(key);
      const recent = previous ? previous.filter((t) => t > cutoff) : [];

      if (recent.length >= limit) {
        // Map insertion order is oldest-key-first, and a blocked key is still
        // live, so re-set it to keep it from being the next one evicted.
        hits.set(key, recent);
        const retryAfter = Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000));
        return { ok: false, limit, remaining: 0, retryAfter };
      }

      recent.push(now);
      hits.set(key, recent);

      if (hits.size > maxKeys) {
        sweep(now);
        // Still over budget: drop the least recently seen keys. This weakens
        // the limit under a flood of spoofed keys, which is inherent to
        // limiting by client address at all.
        while (hits.size > maxKeys) {
          const oldest = hits.keys().next();
          if (oldest.done) break;
          hits.delete(oldest.value);
        }
      }

      return { ok: true, limit, remaining: limit - recent.length, retryAfter: 0 };
    },
    reset(): void {
      hits.clear();
    },
    get size(): number {
      return hits.size;
    },
  };
}

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

export function configFromEnv(): RateLimitConfig {
  return {
    limit: readInt("NAPKIN_RATE_LIMIT", 20),
    windowMs: readInt("NAPKIN_RATE_WINDOW", 60) * 1000,
    maxKeys: 5000,
  };
}

/**
 * The client's address as reported by the proxy in front of us. Only the
 * left-most entry a trusted proxy appended means anything; behind no proxy at
 * all this is absent and every caller shares one bucket, which is the safe
 * direction to be wrong in.
 */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
