import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const info: Record<string, string> = {
    status: "ok",
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    env: process.env.NODE_ENV || "unknown",
    tursoUrlSet: tursoUrl ? "YES (" + tursoUrl.replace(/\/\/.*@/, "//***@") + ")" : "NO — TURSO_DATABASE_URL is not set in Vercel env vars!",
    tursoTokenSet: process.env.TURSO_AUTH_TOKEN ? "YES" : "NO — TURSO_AUTH_TOKEN is not set in Vercel env vars!",
    databaseUrl: process.env.DATABASE_URL
      ? process.env.DATABASE_URL.replace(/file:.*/, "file:***")
      : "NOT SET",
    platform: process.platform,
    arch: process.arch,
  };

  // Test DB connection using our shared db module
  try {
    await db.$connect();
    info.db = "connected";
    const result = await db.$queryRaw`SELECT count(*) as c FROM sqlite_master`;
    info.dbTables = String((result as Array<{ c: number }>)[0]?.c ?? "?");
    await db.$disconnect();
  } catch (dbErr: unknown) {
    info.db = "FAILED: " + (dbErr instanceof Error ? dbErr.message : String(dbErr));
  }

  return NextResponse.json(info);
}