import { NextResponse } from "next/server";
import pg from "pg";

const { Client } = pg;

export const maxDuration = 60;

// POST /api/force-migrate — Force-add missing columns to User table
// This endpoint bypasses all caching and runs migrations directly.
export async function POST() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 500 });
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  const results: string[] = [];

  try {
    await client.connect();
    results.push("Connected to database");

    // Step 1: Check current User table columns
    const colRes = await client.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema='public' AND table_name='User' ORDER BY ordinal_position`
    );
    const existingCols = colRes.rows.map((r) => r.column_name);
    results.push(`Current User columns: [${existingCols.join(", ")}]`);

    // Step 2: Add each missing column one by one
    const requiredColumns = [
      { name: "email", sql: `ALTER TABLE "User" ADD COLUMN "email" TEXT DEFAULT ''` },
      { name: "phone", sql: `ALTER TABLE "User" ADD COLUMN "phone" TEXT DEFAULT ''` },
      { name: "permissions", sql: `ALTER TABLE "User" ADD COLUMN "permissions" TEXT NOT NULL DEFAULT '["reservations","guests"]'` },
      { name: "policeRank", sql: `ALTER TABLE "User" ADD COLUMN "policeRank" TEXT NOT NULL DEFAULT ''` },
      { name: "isActive", sql: `ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true` },
      { name: "lastLogin", sql: `ALTER TABLE "User" ADD COLUMN "lastLogin" TIMESTAMP(3)` },
    ];

    for (const col of requiredColumns) {
      if (!existingCols.includes(col.name)) {
        try {
          await client.query(col.sql);
          results.push(`ADDED column: ${col.name}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          results.push(`FAILED to add ${col.name}: ${msg}`);
        }
      } else {
        results.push(`OK (already exists): ${col.name}`);
      }
    }

    // Step 3: Verify final state
    const verifyRes = await client.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema='public' AND table_name='User' ORDER BY ordinal_position`
    );
    const finalCols = verifyRes.rows.map((r) => r.column_name);
    results.push(`Final User columns: [${finalCols.join(", ")}]`);

    return NextResponse.json({ success: true, results });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg, results }, { status: 500 });
  } finally {
    await client.end().catch(() => {});
  }
}
