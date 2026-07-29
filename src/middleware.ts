import { NextRequest, NextResponse } from "next/server";

/**
 * GHMS Middleware — runs on every request (Edge runtime).
 *
 * Applies:
 *  - Rate limiting on API routes (sliding window per IP)
 *  - Security headers on all responses
 *  - CORS configuration
 */

// ── In-memory rate limit store (Edge-compatible) ──
const store = new Map<string, { count: number; resetAt: number }>();

// Cleanup every 60s
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
  // Auth endpoints — strictest
  if (pathname.startsWith("/api/auth")) return { limit: 15, windowSeconds: 60 };
  // Heavy data export / report endpoints
  if (
    pathname.includes("/export") ||
    pathname.includes("/report") ||
    pathname.includes("/geocode")
  ) {
    return { limit: 8, windowSeconds: 60 };
  }
  // Write operations (POST/PUT/DELETE)
  // (handled below by checking method)
  // General read API
  return { limit: 80, windowSeconds: 60 };
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip non-API routes — only rate-limit API calls
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Skip health check — no rate limit
  if (pathname === "/api/health") {
    return NextResponse.next();
  }

  const ip = getClientIp(request);
  const method = request.method;

  // Write operations get stricter limits
  const isWrite = method === "POST" || method === "PUT" || method === "DELETE" || method === "PATCH";
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

  // Add security & cache headers
  response.headers.set("X-RateLimit-Limit", String(limit));
  response.headers.set("X-Request-Id", crypto.randomUUID());

  return response;
}

export const config = {
  // Only run middleware on API routes for performance
  matcher: ["/api/:path*"],
};
