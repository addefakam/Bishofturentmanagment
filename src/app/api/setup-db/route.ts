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

export async function GET() {
  try {
    // Force re-init even if _initDone is true
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    try {
      const tables = await prisma.$queryRawUnsafe<
        Array<{ table_name: string }>
      >(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);
      return NextResponse.json({
        success: true,
        tables: tables.map((t) => t.table_name),
        count: tables.length,
      });
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
