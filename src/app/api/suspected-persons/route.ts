import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, requirePolice } from "@/lib/tenant";
import { ensureSuspectTables } from "@/lib/suspect-check";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    requirePolice(auth);
    await ensureSuspectTables();

    const { searchParams } = req.nextUrl;
    const q = searchParams.get("q") || "";
    const severity = searchParams.get("severity") || "";
    const activeOnly = searchParams.get("active") !== "false";

    const where: Record<string, unknown> = {};
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { phone: { contains: q } },
        { idNumber: { contains: q } },
        { description: { contains: q } },
      ];
    }
    if (severity) {
      where.severity = severity;
    }
    if (activeOnly) {
      where.is_active = true;
    }

    const persons = await db.suspectedPerson.findMany({
      where,
      include: {
        _count: { select: { matches: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(persons);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch suspected persons";
    const status = message.includes("Police") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    requirePolice(auth);
    await ensureSuspectTables();

    const body = await req.json();
    const { name, phone, idNumber, idType, nationality, address, description, severity } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const person = await db.suspectedPerson.create({
      data: {
        name: name.trim(),
        phone: phone || "",
        idNumber: idNumber || "",
        idType: idType || "",
        nationality: nationality || "",
        address: address || "",
        description: description || "",
        severity: severity || "MEDIUM",
        registeredBy: auth.role,
      },
      include: {
        _count: { select: { matches: true } },
      },
    });

    return NextResponse.json(person, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create suspected person";
    const status = message.includes("Police") ? 403 : message.includes("required") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}