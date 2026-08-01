import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext } from "@/lib/tenant";

export async function POST(req: NextRequest) {
  try {
    // SUPERUSER only
    const auth = await getAuthContext(req);
    if (auth.role !== "SUPERUSER") {
      return NextResponse.json({ error: "Superuser access required" }, { status: 403 });
    }

    // Migrate stale data: any SUPERUSER with a providerId should be OPERATOR
    const migrated = await db.user.updateMany({
      where: { role: 'SUPERUSER', providerId: { not: null } },
      data: { role: 'OPERATOR' },
    });

    // Ensure default PoliceAlertConfig exists
    await db.policeAlertConfig.upsert({
      where: { id: 'default-alert-config' },
      update: {},
      create: { id: 'default-alert-config' },
    });

    const message = migrated.count > 0
      ? `DB ready. Migrated ${migrated.count} SUPERUSER users to OPERATOR.`
      : 'DB ready. No stale data to migrate.';

    return NextResponse.json({
      success: true,
      tablesCreated: true,
      migratedCount: migrated.count,
      message,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[setup-db]", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
