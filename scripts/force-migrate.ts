import pg from "pg";

const { Client } = pg;

const DATABASE_URL = process.argv[2] || "";
if (!DATABASE_URL) {
  console.error("Usage: npx tsx scripts/force-migrate.ts <DATABASE_URL>");
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log("Connected to database");

  // Check current columns
  const colRes = await client.query(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_schema='public' AND table_name='User' ORDER BY ordinal_position`
  );
  const existingCols = colRes.rows.map((r: any) => r.column_name);
  console.log("Current User columns:", existingCols);

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
        console.log(`ADDED: ${col.name}`);
      } catch (err: any) {
        console.error(`FAILED ${col.name}:`, err.message);
      }
    } else {
      console.log(`OK (exists): ${col.name}`);
    }
  }

  // Verify
  const verifyRes = await client.query(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_schema='public' AND table_name='User' ORDER BY ordinal_position`
  );
  console.log("Final User columns:", verifyRes.rows.map((r: any) => r.column_name));

  await client.end();
  console.log("Done!");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
