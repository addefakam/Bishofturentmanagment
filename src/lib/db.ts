import { PrismaClient } from "@prisma/client";

let _db: PrismaClient | null = null;

function createPrismaClient(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "[db] DATABASE_URL is not set. " +
        "Add it in Vercel Dashboard > Settings > Environment Variables."
    );
  }

  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === "production"
        ? ["warn", "error"]
        : ["warn", "error"],
  });

  // Global safeguard: policeRank is non-nullable in schema — never allow null
  client.$use(async (params, next) => {
    if (
      (params.model === "User") &&
      (params.action === "create" || params.action === "update" || params.action === "upsert") &&
      params.args?.data &&
      typeof params.args.data === "object"
    ) {
      const data = params.args.data as Record<string, unknown>;
      if ("policeRank" in data && (data.policeRank === null || data.policeRank === undefined)) {
        data.policeRank = "";
      }
    }
    return next(params);
  });

  return client;
}

/**
 * Singleton PrismaClient instance.
 * Call `ensureDatabase()` BEFORE using this in any API route.
 */
export function getDb(): PrismaClient {
  if (!_db) {
    _db = createPrismaClient();
  }
  return _db;
}

/**
 * Convenience re-export — but remember to call ensureDatabase() first!
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getDb();
    const value = (client as Record<string, unknown>)[prop as string];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
