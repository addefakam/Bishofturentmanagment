import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, requirePolice } from "@/lib/tenant";
import { ensureSuspectTables } from "@/lib/suspect-check";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthContext(req);
    requirePolice(auth);
    await ensureSuspectTables();

    const { id } = await params;
    const person = await db.suspectedPerson.findUnique({
      where: { id },
      include: {
        matches: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        _count: { select: { matches: true } },
      },
    });

    if (!person) {
      return NextResponse.json({ error: "Suspected person not found" }, { status: 404 });
    }

    return NextResponse.json(person);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch suspected person";
    const status = message.includes("Police") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthContext(req);
    requirePolice(auth);

    const { id } = await params;
    const body = await req.json();
    const { name, phone, idNumber, idType, nationality, address, description, severity, is_active } = body;

    const person = await db.suspectedPerson.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(phone !== undefined ? { phone: phone } : {}),
        ...(idNumber !== undefined ? { idNumber: idNumber } : {}),
        ...(idType !== undefined ? { idType: idType } : {}),
        ...(nationality !== undefined ? { nationality: nationality } : {}),
        ...(address !== undefined ? { address: address } : {}),
        ...(description !== undefined ? { description: description } : {}),
        ...(severity !== undefined ? { severity: severity } : {}),
        ...(is_active !== undefined ? { is_active: is_active } : {}),
      },
      include: {
        _count: { select: { matches: true } },
      },
    });

    return NextResponse.json(person);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update suspected person";
    const status = message.includes("Police") ? 403 : message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthContext(req);
    requirePolice(auth);

    const { id } = await params;
    // Delete matches first, then the person
    await db.suspectMatch.deleteMany({ where: { suspectedPersonId: id } });
    await db.suspectedPerson.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete suspected person";
    const status = message.includes("Police") ? 403 : message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}