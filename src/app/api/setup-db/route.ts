import { NextRequest, NextResponse } from "next/server";
import { ensureDatabase } from "@/lib/init-db";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    await ensureDatabase();
    return NextResponse.json({ success: true, message: "Database is ready." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
