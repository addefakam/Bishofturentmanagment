import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

let dbInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Auto-initialize database tables/columns on first API request after deployment.
 * This ensures ALTER TABLE migrations (like latitude/longitude, policeRank)
 * are always applied without needing to manually call /api/setup-db.
 */
function ensureDbSchema(): Promise<void> {
  if (dbInitialized) return Promise.resolve();
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
      const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

      // Build connection URL for direct HTTP query
      let dbUrl: string | null = null;
      if (tursoUrl) {
        // libsql:// format → use Turso HTTP API
        dbUrl = tursoUrl
          .replace("libsql://", "https://")
          .replace("file:", "file:");
      }

      // Use fetch to Turso HTTP API directly for raw SQL
      if (dbUrl && dbUrl.startsWith("https://")) {
        const baseUrl = dbUrl.split("?")[0];
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

        // Check if Provider.latitude column exists
        const checkResp = await fetch(`${baseUrl}/v2/pipeline`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            requests: [
              { type: "execute", stmt: { sql: "PRAGMA table_info(\"Provider\")" } },
            ],
          }),
        });

        if (checkResp.ok) {
          const checkResult = await checkResp.json();
          const results = checkResult?.results?.[0]?.response?.result;
          const rows = results?.rows || [];
          const colNames = rows.map((r: Array<{ value: string }>) => r[1]?.value);

          if (!colNames.includes("latitude")) {
            console.log("[middleware] Adding latitude column to Provider...");
            await fetch(`${baseUrl}/v2/pipeline`, {
              method: "POST",
              headers,
              body: JSON.stringify({
                requests: [
                  { type: "execute", stmt: { sql: "ALTER TABLE \"Provider\" ADD COLUMN \"latitude\" REAL DEFAULT 9.02" } },
                  { type: "execute", stmt: { sql: "ALTER TABLE \"Provider\" ADD COLUMN \"longitude\" REAL DEFAULT 38.75" } },
                ],
              }),
            });
          }
        }

        // Check if User.policeRank column exists
        const checkUserResp = await fetch(`${baseUrl}/v2/pipeline`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            requests: [
              { type: "execute", stmt: { sql: "PRAGMA table_info(\"User\")" } },
            ],
          }),
        });

        if (checkUserResp.ok) {
          const checkUserResult = await checkUserResp.json();
          const userRows = checkUserResult?.results?.[0]?.response?.result?.rows || [];
          const userColNames = userRows.map((r: Array<{ value: string }>) => r[1]?.value);

          if (!userColNames.includes("policeRank")) {
            console.log("[middleware] Adding policeRank column to User...");
            await fetch(`${baseUrl}/v2/pipeline`, {
              method: "POST",
              headers,
              body: JSON.stringify({
                requests: [
                  { type: "execute", stmt: { sql: "ALTER TABLE \"User\" ADD COLUMN \"policeRank\" TEXT DEFAULT ''" } },
                ],
              }),
            });
          }
        }
      }

      dbInitialized = true;
      console.log("[middleware] Database schema verified");
    } catch (error) {
      console.error("[middleware] Auto-migration failed (non-blocking):", error);
      dbInitialized = true; // Don't retry on every request
    }
  })();

  return initPromise;
}

export function middleware(request: NextRequest) {
  // Only intercept API routes (skip static files, _next, etc.)
  if (request.nextUrl.pathname.startsWith("/api/")) {
    // Fire-and-forget the schema check — don't block the request
    ensureDbSchema().catch(() => {});
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
