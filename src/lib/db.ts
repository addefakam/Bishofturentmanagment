import { PrismaClient } from "@prisma/client";

type PrismaClientInstance = PrismaClient & { $disconnect: () => Promise<void> };

let _db: PrismaClientInstance | null = null;

function createPrismaClient(): PrismaClientInstance {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "[db] DATABASE_URL is not set. " +
        "Add it in Vercel Dashboard > Settings > Environment Variables."
    );
  }

  return new PrismaClient({
    log:
      process.env.NODE_ENV === "production"
        ? ["warn", "error"]
        : ["warn", "error"],
  }) as PrismaClientInstance;
}

function getDb(): PrismaClientInstance {
  if (!_db) {
    _db = createPrismaClient();
  }
  return _db;
}

/**
 * Lazy Proxy for the Prisma client.
 */
export const db = new Proxy({} as PrismaClientInstance, {
  get(_target, prop, receiver) {
    const client = getDb();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === "function") {
      return (...args: unknown[]) => {
        return (value as (...a: unknown[]) => Promise<unknown>).apply(client, args);
      };
    }
    return value;
  },
});
