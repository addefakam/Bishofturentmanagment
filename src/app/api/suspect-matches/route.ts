import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, requirePolice } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { ensureSuspectTables } from "@/lib/suspect-check";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    requirePolice(auth);
    await ensureSuspectTables();

    const { searchParams } = req.nextUrl;
    const unreadOnly = searchParams.get("unread") === "true";

    const where: Record<string, unknown> = {};
    if (unreadOnly) {
      where.isRead = false;
    }

    const matches = await db.suspectMatch.findMany({
      where,
      include: {
        suspectedPerson: {
          select: {
            id: true,
            name: true,
            phone: true,
            idNumber: true,
            severity: true,
            description: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Count unread
    const unreadCount = await db.suspectMatch.count({
      where: { isRead: false },
    });

    logAudit(req, { action: "VIEW_MATCHES", details: `Fetched ${matches.length} matches` });
    return NextResponse.json({ matches, unreadCount });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch suspect matches";
    const status = message.includes("Police") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    requirePolice(auth);
    await ensureSuspectTables();

    const body = await req.json();
    const { ids, markAllRead } = body;

    if (markAllRead) {
      await db.suspectMatch.updateMany({
        where: { isRead: false },
        data: { isRead: true },
      });
      logAudit(req, { action: "MARK_ALL_READ", details: "All suspect matches marked as read" });
      return NextResponse.json({ success: true, message: "All matches marked as read" });
    }

    if (ids && Array.isArray(ids) && ids.length > 0) {
      await db.suspectMatch.updateMany({
        where: { id: { in: ids } },
        data: { isRead: true },
      });
      logAudit(req, { action: "MARK_READ", details: `Marked ${ids.length} matches as read` });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Provide ids array or markAllRead" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update suspect matches";
    const status = message.includes("Police") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}