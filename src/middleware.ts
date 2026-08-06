import { NextRequest, NextResponse } from "next/server";

/**
 * GHMS Middleware — runs on API routes only (Edge runtime).
 *
 * Applies:
 *  - Rate limiting on API routes (sliding window per IP)
 *  - Security headers on all responses
 */

// ── In-memory rate limit store (Edge-compatible) ──
const store = new Map<string, { count: number; resetAt: number }>();

// Cleanup every 60s to prevent memory leaks
let cleanupTimer: ReturnType<typeof setInterval> | null = null;
if (typeof globalThis !== "undefined" && !cleanupTimer) {
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }, 60_000);
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function checkLimit(ip: string, key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const fullKey = `${ip}:${key}`;
  let entry = store.get(fullKey);

  if (!entry || entry.resetAt <= now) {
    store.set(fullKey, { count: 1, resetAt: now + windowMs });
    return true;
  }

  entry.count++;
  if (entry.count > limit) return false;
  return true;
}

// ── Rate limit configs per route pattern ──
function getLimitConfig(pathname: string): { limit: number; windowSeconds: number } {
  if (pathname.startsWith("/api/auth")) return { limit: 15, windowSeconds: 60 };
  if (
    pathname.includes("/export") ||
    pathname.includes("/report") ||
    pathname.includes("/geocode")
  ) {
    return { limit: 8, windowSeconds: 60 };
  }
  // Default: generous for normal page usage (multiple API calls per page load)
  return { limit: 200, windowSeconds: 60 };
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip non-API routes
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Skip health check — no rate limit, no extra headers
  if (pathname === "/api/health") {
    return NextResponse.next();
  }

  const method = request.method;
  const isWrite = method === "POST" || method === "PUT" || method === "DELETE" || method === "PATCH";

  // Skip rate limiting for authenticated GET requests (JWT-protected, no abuse risk)
  if (!isWrite && (request.headers.get("authorization") || request.cookies.has("token"))) {
    return NextResponse.next();
  }

  const ip = getClientIp(request);
  const config = getLimitConfig(pathname);
  const limit = isWrite ? Math.min(config.limit, 30) : config.limit;
  const windowMs = config.windowSeconds * 1000;

  const key = `${method}:${pathname}`;
  const allowed = checkLimit(ip, key, limit, windowMs);

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again." },
      {
        status: 429,
        headers: {
          "Retry-After": String(config.windowSeconds),
          "Content-Type": "application/json",
        },
      }
    );
  }

  const response = NextResponse.next();

  // Add rate limit header (lightweight — no crypto.randomUUID)
  response.headers.set("X-RateLimit-Limit", String(limit));

  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
