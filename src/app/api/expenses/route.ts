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
    if (auth.role !== "SUPERUSER" && auth.role !== "OPERATOR" && auth.role !== "POLICE") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    const filter = getProviderFilter(auth);

    const where: Record<string, unknown> = filter.isPolice
      ? {}
      : { providerId: filter.providerId };

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    if (category) {
      where.category = category;
    }

    const expenses = await db.expense.findMany({
      where,
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ expenses });
  } catch (error) {
    console.error("List expenses error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    checkWritePermission(auth, { requireSuperuserOrOperator: true });

    const body = await req.json();
    const {
      date,
      category,
      description,
      amount,
      vendor,
      paymentMethod,
      receiptNo,
      taxAmount,
    } = body;

    if (!date || !category || !description || amount == null || !paymentMethod) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: date, category, description, amount, paymentMethod",
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

    const expense = await db.expense.create({
      data: {
        date,
        category,
        description,
        amount: Number(amount),
        vendor: vendor || "",
        paymentMethod,
        receiptNo: receiptNo || "",
        taxAmount: taxAmount != null ? Number(taxAmount) : 0,
        providerId: auth.providerId,
      },
    });

    return NextResponse.json({ expense }, { status: 201 });
  } catch (error: unknown) {
    console.error("Create expense error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const status =
      message.includes("permission") || message.includes("cannot")
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}