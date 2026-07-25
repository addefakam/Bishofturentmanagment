import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, blockPoliceWrites } from "@/lib/tenant";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthContext(req);
    blockPoliceWrites(auth);

    const { id } = await params;

    const existing = await db.review.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    await db.review.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete review";
    const status =
      message.includes("not found") ? 404 :
      message.includes("permission") || message.includes("cannot") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}