import { NextResponse } from "next/server";
import { forceMigrate } from "@/lib/init-db";

export const maxDuration = 60;

// POST /api/force-migrate — Force-run all idempotent migrations on the live DB
// This endpoint bypasses all caching and runs migrations directly.
export async function POST() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 500 });
  }

  try {
    await forceMigrate();
    return NextResponse.json({ success: true, message: "All migrations applied successfully." });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

