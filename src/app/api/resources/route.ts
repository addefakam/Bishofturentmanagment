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
    const q = searchParams.get("q");

    if (q) {
      where.OR = [
        { name: { contains: q } },
        { category: { contains: q } },
        { supplier: { contains: q } },
      ];
    }

    const resources = await db.resource.findMany({
      where,
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ resources });
  } catch (error) {
    console.error("List resources error:", error);
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
      name,
      category,
      quantity,
      unit,
      minLevel,
      costPerUnit,
      supplier,
    } = body;

    if (!name || !category || quantity == null || !unit) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: name, category, quantity, unit",
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

    const resource = await db.resource.create({
      data: {
        name,
        category,
        quantity: Number(quantity),
        unit,
        minLevel: minLevel != null ? Number(minLevel) : 0,
        costPerUnit: costPerUnit != null ? Number(costPerUnit) : 0,
        supplier: supplier || "",
        providerId: auth.providerId,
      },
    });

    return NextResponse.json({ resource }, { status: 201 });
  } catch (error: unknown) {
    console.error("Create resource error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const status =
      message.includes("permission") || message.includes("cannot")
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}