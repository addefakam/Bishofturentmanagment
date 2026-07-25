import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, checkWritePermission } from "@/lib/tenant";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthContext(req);
    checkWritePermission(auth, {
      blockSuperuser: true,
      staffPermissionKey: "expenses",
    });

    const { id } = await params;

    const existing = await db.expenseCategory.findFirst({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Expense category not found" },
        { status: 404 }
      );
    }

    await db.expenseCategory.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Delete expense category error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const status =
      message.includes("permission") || message.includes("cannot")
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}