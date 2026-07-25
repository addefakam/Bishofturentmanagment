import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

type PrismaClientInstance = PrismaClient & { $disconnect: () => Promise<void> };

let _db: PrismaClientInstance | null = null;
let schemaEnsured = false;

function createPrismaClient(): PrismaClientInstance {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (tursoUrl && tursoUrl.length > 0) {
    console.log("[db] Connecting to Turso cloud database");
    const adapter = new PrismaLibSQL({ url: tursoUrl, authToken: authToken || undefined });
    return new PrismaClient({ adapter }) as PrismaClientInstance;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[db] TURSO_DATABASE_URL is not set. " +
      "Add it in Vercel Dashboard > Settings > Environment Variables."
    );
  }

  console.log("[db] TURSO_DATABASE_URL not set — using local SQLite");
  return new PrismaClient() as PrismaClientInstance;
}

/**
 * Auto-migrate: ensure Provider.latitude/longitude and User.policeRank columns exist.
 * Uses Prisma's $queryRawUnsafe to check and alter — runs once per cold start.
 */
async function ensureSchema(db: PrismaClientInstance) {
  if (schemaEnsured) return;
  try {
    // Check Provider columns
    const providerCols: { name: string }[] = await db.$queryRawUnsafe(`PRAGMA table_info("Provider")`);
    const pColNames = providerCols.map(c => c.name);

    if (!pColNames.includes("latitude")) {
      await db.$executeRawUnsafe(`ALTER TABLE "Provider" ADD COLUMN "latitude" REAL DEFAULT 9.02`);
      console.log("[db] Added latitude column to Provider");
    }
    if (!pColNames.includes("longitude")) {
      await db.$executeRawUnsafe(`ALTER TABLE "Provider" ADD COLUMN "longitude" REAL DEFAULT 38.75`);
      console.log("[db] Added longitude column to Provider");
    }

    // Check User columns
    const userCols: { name: string }[] = await db.$queryRawUnsafe(`PRAGMA table_info("User")`);
    const uColNames = userCols.map(c => c.name);

    if (!uColNames.includes("policeRank")) {
      await db.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "policeRank" TEXT DEFAULT ''`);
      console.log("[db] Added policeRank column to User");
    }

    schemaEnsured = true;
    console.log("[db] Schema auto-migration complete");
  } catch (error) {
    console.error("[db] Schema auto-migration failed (non-blocking):", error);
    schemaEnsured = true; // Don't retry on every request
  }
}

function getDb(): PrismaClientInstance {
  if (!_db) {
    _db = createPrismaClient();
    // Fire-and-forget schema check
    ensureSchema(_db).catch(() => {});
  }
  return _db;
}

// Lazy Proxy — PrismaClient is created on first use (request time), not at module load time
export const db = new Proxy({} as PrismaClientInstance, {
  get(_target, prop, receiver) {
    const client = getDb();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
