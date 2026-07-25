import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, checkWritePermission } from "@/lib/tenant";

export async function GET(_req: NextRequest) {
  try {
    const categories = await db.expenseCategory.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("List expense categories error:", error);
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
      staffPermissionKey: "expenses",
    });

    const body = await req.json();
    const { name, nameAm, color, icon } = body;

    if (!name || !color || !icon) {
      return NextResponse.json(
        { error: "Missing required fields: name, color, icon" },
        { status: 400 }
      );
    }

    const category = await db.expenseCategory.create({
      data: {
        name,
        nameAm: nameAm || "",
        color,
        icon,
      },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error: unknown) {
    console.error("Create expense category error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const status =
      message.includes("permission") || message.includes("cannot")
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}