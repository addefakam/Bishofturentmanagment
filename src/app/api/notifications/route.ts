import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, getProviderFilter, checkWritePermission } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);

    // Police users see ALL notifications (they have cross-provider visibility)
    let notifications;
    if (auth.role === "POLICE") {
      notifications = await db.notification.findMany({
        orderBy: { createdAt: "desc" },
      });
    } else {
      const { providerId } = getProviderFilter(auth);
      notifications = await db.notification.findMany({
        where: { providerId },
        orderBy: { createdAt: "desc" },
      });
    }

    return NextResponse.json(notifications);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch notifications";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    const { providerId } = getProviderFilter(auth);
    // SUPERUSER can submit concerns; others blocked (notifications are system-generated)
    checkWritePermission(auth, { allowSuperuser: true });

    const body = await req.json();
    const { title, message, type, link, userId } = body;

    if (!title || !message) {
      return NextResponse.json(
        { error: "title and message are required" },
        { status: 400 }
      );
    }

    const notification = await db.notification.create({
      data: {
        title,
        message,
        type: type || "INFO",
        link: link || null,
        providerId,
        userId: userId || null,
      },
    });

    return NextResponse.json(notification, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create notification";
    const status = message.includes("required") ? 400 : message.includes("cannot") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}