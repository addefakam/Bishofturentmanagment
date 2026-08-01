import { PrismaClient } from "@prisma/client";
import { ENUMS_SQL } from "./schema-ddl";
import { TABLES_P1 } from "./schema-tables";
import { TABLES_P2 } from "./schema-tables-p2";
import { TABLES_P3 } from "./schema-tables-p3";
import { TABLES_P4 } from "./schema-tables-p4";
import { FKS_SQL, INDEXES_SQL } from "./schema-fk-index";
import bcrypt from "bcryptjs";

type DbClient = PrismaClient;

let _client: DbClient | null = null;
let _ready: Promise<void> | null = null;

function getClient(): DbClient {
  if (!_client) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    _client = new PrismaClient({
      log: process.env.NODE_ENV === "production" ? ["warn", "error"] : ["warn", "error"],
    });
  }
  return _client;
}

async function ensureTables(client: DbClient): Promise<void> {
  // Check if User table exists
  const rows = await client.$queryRawUnsafe<Array<{ e: boolean }>>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='"User"') as e`
  );
  if (rows[0]?.e) return;

  console.log("[db] Creating tables...");
  await client.$executeRawUnsafe(ENUMS_SQL);
  await client.$executeRawUnsafe(TABLES_P1);
  await client.$executeRawUnsafe(TABLES_P2);
  await client.$executeRawUnsafe(TABLES_P3);
  await client.$executeRawUnsafe(TABLES_P4);
  await client.$executeRawUnsafe(FKS_SQL);
  await client.$executeRawUnsafe(INDEXES_SQL);
  console.log("[db] Tables created.");

  // Seed SUPERUSER
  try {
    const existing = await client.user.findUnique({ where: { username: "admin" } });
    if (!existing) {
      const hashed = await bcrypt.hash("Admin@2024", 12);
      await client.user.create({
        data: { username: "admin", password: hashed, name: "System Administrator", role: "SUPERUSER", permissions: "[]", policeRank: "" },
      });
      console.log("[db] SUPERUSER created.");
    }
  } catch (e) { console.error("[db] Seed error:", e); }

  // Seed PoliceAlertConfig
  try {
    await client.policeAlertConfig.upsert({ where: { id: "default-alert-config" }, update: {}, create: { id: "default-alert-config" } });
  } catch (e) { /* ignore */ }
}

function getReady(): Promise<void> {
  if (!_ready) {
    _ready = ensureTables(getClient());
  }
  return _ready;
}

// Create a deeply-nested proxy that wraps ALL function calls with init
function wrapWithInit(obj: unknown): unknown {
  if (obj === null || obj === undefined || typeof obj === "function" || typeof obj !== "object") {
    return obj;
  }
  return new Proxy(obj, {
    get(target, prop) {
      const val = Reflect.get(target, prop);
      if (typeof val === "function") {
        return (...args: unknown[]) => getReady().then(() => val.apply(target, args));
      }
      if (val !== null && val !== undefined && typeof val === "object") {
        return wrapWithInit(val);
      }
      return val;
    },
  });
}

export const db = wrapWithInit(getClient()) as DbClient;
