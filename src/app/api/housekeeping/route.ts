import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getAuthContext,
  getProviderFilter,
  checkWritePermission,
} from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    const filter = getProviderFilter(auth);

    const where: Record<string, unknown> = filter.isPolice
      ? {}
      : { providerId: filter.providerId };

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    if (status) {
      where.status = status;
    }

    const tasks = await db.housekeepingTask.findMany({
      where,
      orderBy: { scheduledDate: "asc" },
      include: { room: { select: { id: true, number: true, name: true } } },
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("List housekeeping tasks error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    checkWritePermission(auth, {
      blockSuperuser: true,
      staffPermissionKey: "housekeeping",
    });

    const body = await req.json();
    const { roomId, type, assignedTo, scheduledDate, notes } = body;

    if (!roomId || !type || !scheduledDate) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: roomId, type, scheduledDate",
        },
        { status: 400 }
      );
    }

    if (!auth.providerId) {
      return NextResponse.json(
        { error: "No provider assigned to this user" },
        { status: 403 }
      );
    }

    const task = await db.housekeepingTask.create({
      data: {
        roomId,
        type,
        assignedTo: assignedTo || null,
        scheduledDate,
        notes: notes || "",
        providerId: auth.providerId,
      },
      include: { room: { select: { id: true, number: true, name: true } } },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error: unknown) {
    console.error("Create housekeeping task error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const status =
      message.includes("permission") || message.includes("cannot")
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}