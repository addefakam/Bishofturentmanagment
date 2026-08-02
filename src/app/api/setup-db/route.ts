import { NextRequest, NextResponse } from "next/server";
import { ensureDatabase, forceMigrate } from "@/lib/init-db";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    // Check if caller wants a forced migration (re-run migrations even if init was done)
    const body = await req.json().catch(() => ({}));
    if (body?.force) {
      await forceMigrate();
      return NextResponse.json({ success: true, message: "Forced migration completed." });
    }
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

      // Also check if Guest table has the region column
      let guestColumns: string[] = [];
      try {
        const cols = await prisma.$queryRawUnsafe<
          Array<{ column_name: string }>
        >(`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'Guest'
          ORDER BY ordinal_position
        `);
        guestColumns = cols.map((c) => c.column_name);
      } catch {
        // Guest table might not exist
      }

      return NextResponse.json({
        success: true,
        tables: tables.map((t) => t.table_name),
        count: tables.length,
        guestColumns,
      });
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
