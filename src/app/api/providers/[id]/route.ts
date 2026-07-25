import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, requirePolice } from "@/lib/tenant";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(req);
    requirePolice(auth);

    const { id } = await params;
    const body = await req.json();

    const { status, rejectionReason, latitude, longitude } = body;

    if (!status || !["PENDING", "APPROVED", "REJECTED", "SUSPENDED"].includes(status)) {
      return NextResponse.json(
        { error: "Valid status is required (PENDING, APPROVED, REJECTED, SUSPENDED)" },
        { status: 400 }
      );
    }

    const existing = await db.provider.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      status,
      rejectionReason: rejectionReason || "",
    };

    if (typeof latitude === "number" && typeof longitude === "number") {
      updateData.latitude = latitude;
      updateData.longitude = longitude;
    }

    if (status === "APPROVED") {
      updateData.approvedBy = auth.role;
      updateData.approvedAt = new Date();
    }

    const provider = await db.provider.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(provider);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update provider";
    const status =
      message.includes("not found") ? 404 :
      message.includes("Police") ? 403 :
      message.includes("required") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}