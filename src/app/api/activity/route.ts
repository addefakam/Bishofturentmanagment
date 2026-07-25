import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, getProviderFilter } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    const { isPolice, providerId } = getProviderFilter(auth);

    const { searchParams } = req.nextUrl;
    const providerFilter = searchParams.get("providerId");

    const where: Record<string, unknown> = {};
    if (isPolice) {
      if (providerFilter) where.providerId = providerFilter;
    } else {
      where.providerId = providerId;
    }

    const logs = await db.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(logs);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch activity logs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}