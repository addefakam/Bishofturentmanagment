import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, requirePolice } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    requirePolice(auth);

    const guests = await db.guest.findMany({
      include: { provider: { select: { id: true, name: true } } },
    });

    // Find linked guests by phone or ID number
    const phoneMap = new Map<string, typeof guests[0][]>();
    const idMap = new Map<string, typeof guests[0][]>();

    for (const g of guests) {
      if (g.phone) {
        const key = g.phone.toLowerCase().trim();
        if (!phoneMap.has(key)) phoneMap.set(key, []);
        phoneMap.get(key)!.push(g);
      }
      if (g.idNumber) {
        const key = g.idNumber.toLowerCase().trim();
        if (!idMap.has(key)) idMap.set(key, []);
        idMap.get(key)!.push(g);
      }
    }

    const linkedGroups: { linkType: string; linkValue: string; guests: { id: string; name: string; phone: string; idNumber: string; providerName: string; nationality: string }[] }[] = [];
    const seen = new Set<string>();

    const process = (type: string, map: Map<string, typeof guests[0][]>) => {
      for (const [value, group] of map) {
        if (group.length < 2) continue;
        const key = `${type}:${value}`;
        if (seen.has(key)) continue;
        seen.add(key);
        linkedGroups.push({
          linkType: type === "phone" ? "Same Phone" : "Same ID Number",
          linkValue: value,
          guests: group.map((g) => ({
            id: g.id,
            name: g.name,
            phone: g.phone,
            idNumber: g.idNumber,
            providerName: g.provider?.name || "Unknown",
            nationality: g.nationality,
          })),
        });
      }
    };

    process("phone", phoneMap);
    process("idNumber", idMap);

    return NextResponse.json({ linkedGroups, total: linkedGroups.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch guest links";
    const status = message.includes("Police") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
