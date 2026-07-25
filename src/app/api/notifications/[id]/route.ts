import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, getProviderFilter } from "@/lib/tenant";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthContext(req);
    const { providerId } = getProviderFilter(auth);

    const { id } = await params;
    const body = await req.json();

    if (body.isRead === true) {
      const notification = await db.notification.updateMany({
        where: { id, providerId },
        data: { isRead: true },
      });

      if (notification.count === 0) {
        return NextResponse.json({ error: "Notification not found" }, { status: 404 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update notification";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}