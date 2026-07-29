import { NextRequest, NextResponse } from "next/server";

/**
 * In-memory rate limiter for API routes.
 * Uses a sliding window counter per IP address.
 *
 * Limits:
 *  - General API: 60 requests / 60 seconds
 *  - Auth endpoints: 10 requests / 60 seconds
 *  - Heavy endpoints (export/report): 5 requests / 60 seconds
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up old entries every 60 seconds to prevent memory leaks
if (typeof globalThis !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    }
  }, 60_000).unref();
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export function rateLimit(
  request: NextRequest,
  limit: number = 60,
  windowSeconds: number = 60
): { success: boolean; remaining: number; resetAt: number } {
  const ip = getClientIp(request);
  const key = `${ip}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  let entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    // New window
    entry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
    return { success: true, remaining: limit - 1, resetAt: entry.resetAt };
  }

  entry.count++;

  if (entry.count > limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { success: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

export function withRateLimit(
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>,
  options?: { limit?: number; windowSeconds?: number }
) {
  return async (req: NextRequest, ...args: any[]) => {
    const limit = options?.limit ?? 60;
    const windowSeconds = options?.windowSeconds ?? 60;
    const result = rateLimit(req, limit, windowSeconds);

    const response = await handler(req, ...args);

    // Add rate limit headers
    response.headers.set("X-RateLimit-Limit", String(limit));
    response.headers.set("X-RateLimit-Remaining", String(result.remaining));
    response.headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));

    if (!result.success) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
          },
        }
      );
    }

    return response;
  };
}

/**
 * Middleware-style rate limit check for Next.js middleware.ts usage.
 * Returns null if allowed, or a 429 Response if rate limited.
 */
export function checkRateLimit(
  request: NextRequest,
  limit: number = 60,
  windowSeconds: number = 60
): NextResponse | null {
  const result = rateLimit(request, limit, windowSeconds);

  if (!result.success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
        },
      }
    );
  }

  return null;
}
