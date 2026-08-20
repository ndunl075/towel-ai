import { describe, expect, it } from "vitest";

import { clientKey, createRateLimiter } from "@/lib/ratelimit";

const limiter = (limit: number, windowMs = 60_000, maxKeys = 100) =>
  createRateLimiter({ limit, windowMs, maxKeys });

describe("createRateLimiter", () => {
  it("allows up to the limit and refuses the next", () => {
    const rl = limiter(3);
    expect([1, 2, 3].map((i) => rl.check("a", 1, i).ok)).toEqual([true, true, true]);
    expect(rl.check("a", 1, 4).ok).toBe(false);
  });

  it("counts down what is left", () => {
    const rl = limiter(3);
    expect([1, 2, 3].map((i) => rl.check("a", 1, i).remaining)).toEqual([2, 1, 0]);
  });

  it("reports when to come back", () => {
    const rl = limiter(1);
    rl.check("a", 1, 0);
    expect(rl.check("a", 1, 0).retryAfter).toBe(60);
  });

  it("lets the caller back in once the window passes", () => {
    const rl = limiter(1);
    rl.check("a", 1, 0);
    expect(rl.check("a", 1, 59_999).ok).toBe(false);
    expect(rl.check("a", 1, 60_001).ok).toBe(true);
  });

  it("keeps clients independent", () => {
    const rl = limiter(1);
    rl.check("a", 1, 0);
    expect(rl.check("b", 1, 0).ok).toBe(true);
  });

  it("treats limit 0 as disabled", () => {
    const rl = limiter(0);
    expect(Array.from({ length: 200 }, (_, i) => rl.check("a", 1, i).ok).every(Boolean)).toBe(true);
  });

  it("keeps refusing a client that is over", () => {
    const rl = limiter(1);
    rl.check("a", 1, 0);
    expect([1, 2, 3].map((i) => rl.check("a", 1, i).ok)).toEqual([false, false, false]);
  });

  /**
   * One click that fans out into several model calls has to be charged for all
   * of them, or the cap means nothing on the route that multiplies.
   */
  describe("cost", () => {
    it("charges the full cost", () => {
      const rl = limiter(10);
      expect(rl.check("a", 3, 0).remaining).toBe(7);
      expect(rl.check("a", 3, 0).remaining).toBe(4);
    });

    it("is all-or-nothing when the budget will not cover it", () => {
      const rl = limiter(4);
      expect(rl.check("a", 3, 0).ok).toBe(true);
      expect(rl.check("a", 3, 0).ok).toBe(false);
      // Refusing must not have consumed anything: the single call still fits.
      expect(rl.check("a", 1, 0).ok).toBe(true);
      expect(rl.check("a", 1, 0).ok).toBe(false);
    });

    it("defaults to one", () => {
      const rl = limiter(2);
      expect([rl.check("a").ok, rl.check("a").ok, rl.check("a").ok]).toEqual([true, true, false]);
    });
  });

  /** Without a bound, a stream of unique client addresses grows until the process dies. */
  describe("memory", () => {
    it("never holds more keys than its cap", () => {
      const rl = limiter(5, 60_000, 50);
      for (let i = 0; i < 5000; i++) rl.check(`ip${i}`, 1, 1000);
      expect(rl.size).toBeLessThanOrEqual(50);
    });

    it("sweeps idle keys rather than evicting live ones", () => {
      const rl = limiter(5, 1000, 10);
      for (let i = 0; i < 10; i++) rl.check(`old${i}`, 1, 0);
      rl.check("fresh", 1, 5000);
      expect(rl.size).toBeLessThanOrEqual(10);
      // "fresh" is still tracked, so its second call counts against the same bucket.
      expect(rl.check("fresh", 1, 5001).remaining).toBe(3);
    });
  });
});

describe("clientKey", () => {
  const key = (headers: Record<string, string>) =>
    clientKey(new Request("http://example.test", { headers }));

  it("takes the left-most forwarded address", () => {
    expect(key({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" })).toBe("1.1.1.1");
  });

  it("falls back to x-real-ip", () => {
    expect(key({ "x-real-ip": "3.3.3.3" })).toBe("3.3.3.3");
  });

  it("falls through a blank forwarded header", () => {
    expect(key({ "x-forwarded-for": "   ", "x-real-ip": "4.4.4.4" })).toBe("4.4.4.4");
  });

  /** Behind no proxy everyone shares one bucket, which is the safe way to be wrong. */
  it("returns a single shared key when there is no proxy header", () => {
    expect(key({})).toBe("unknown");
  });
});
