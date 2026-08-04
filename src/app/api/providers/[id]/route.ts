import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, requirePolice, AuthError } from "@/lib/tenant";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(req);

    // Both POLICE and SUPERUSER can update providers, but with different constraints
    if (auth.role !== "POLICE" && auth.role !== "SUPERUSER") {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

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

    // SUPERUSER can suspend and reactivate guesthouses.
    const isReactivation = status === "APPROVED" && existing.status === "SUSPENDED";
    if (auth.role === "SUPERUSER" && status !== "SUSPENDED" && !isReactivation) {
      return NextResponse.json(
        { error: "This action is not available for your account. Only suspension and reactivation are allowed from here." },
        { status: 403 }
      );
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
      // If reactivating from suspended, clear suspension fields
      if (existing.status === "SUSPENDED") {
        updateData.suspensionReason = "";
        updateData.suspendedAt = null;
        updateData.suspendedBy = "";
      }
    }

    const provider = await db.provider.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(provider);
  } catch (error: unknown) {
        if (error instanceof AuthError) {
          return NextResponse.json({ error: error.message }, { status: error.statusCode });
        }
    const message = error instanceof Error ? error.message : "Failed to update provider";
    const status =
      message.includes("not found") ? 404 :
      message.includes("denied") ? 403 :
      message.includes("required") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
