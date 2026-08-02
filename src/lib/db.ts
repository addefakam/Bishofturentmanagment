import { PrismaClient } from "@prisma/client";
import { ensureDatabase } from "./init-db";

let _db: PrismaClient | null = null;
let _ensurePromise: Promise<void> | null = null;

function createPrismaClient(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "[db] DATABASE_URL is not set. " +
        "Add it in Vercel Dashboard > Settings > Environment Variables."
    );
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["warn", "error"] : ["warn", "error"],
  });
}

function getClient(): PrismaClient {
  if (!_db) {
    _db = createPrismaClient();
  }
  return _db;
}

/**
 * Returns a promise that resolves when DB migrations are guaranteed done.
 * Safe to call many times — only runs once per cold start.
 */
function ensureOnce(): Promise<void> {
  if (!_ensurePromise) {
    _ensurePromise = ensureDatabase();
  }
  return _ensurePromise;
}

/**
 * Get a PrismaClient with migrations guaranteed to have run.
 * Use at the top of API route handlers:
 *   const db = await getSafeDb();
 */
export async function getSafeDb(): Promise<PrismaClient> {
  await ensureOnce();
  return getClient();
}

/**
 * Wraps a Prisma model so every method call first awaits ensureDatabase.
 * This makes `db.user.findMany(...)` work without explicit await.
 */
function createEnsuredProxy<T>(model: T): T {
  return new Proxy(model as object, {
    get(target, prop) {
      const value = (target as Record<string, unknown>)[prop as string];
      if (typeof value === "function") {
        // Return an async wrapper that first ensures DB, then calls the method
        return async (...args: unknown[]) => {
          await ensureOnce();
          return (value as Function).apply(target, args);
        };
      }
      return value;
    },
  }) as unknown as T;
}

/**
 * Convenience proxy — auto-ensures database before every query.
 * All 67+ API routes import this, so all routes are now covered.
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = (client as Record<string, unknown>)[prop as string];
    if (typeof value === "function") {
      // Prisma namespace methods like $queryRaw, $executeRaw, $transaction
      return async (...args: unknown[]) => {
        await ensureOnce();
        return (value as Function).apply(client, args);
      };
    }
    // Prisma model accessors like .user, .room, .guest — wrap with ensure proxy
    if (value && typeof value === "object") {
      return createEnsuredProxy(value);
    }
    return value;
  },
});
