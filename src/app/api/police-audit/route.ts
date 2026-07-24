import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, requirePolice } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    requirePolice(auth);
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");
    const skip = (page - 1) * pageSize;

    const where = action ? { action } : {};
    const [logs, total] = await Promise.all([
      db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: pageSize }),
      db.auditLog.count({ where }),
    ]);

    return NextResponse.json({ logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch audit logs";
    const status = message.includes("Police") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
