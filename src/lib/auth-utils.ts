import { createHash } from "crypto";
import { SignJWT, jwtVerify } from "jose";

// ── Password hashing ──
const SALT_ROUNDS = 12;

export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

export async function verifyPassword(
  plainText: string,
  hashed: string
): Promise<boolean> {
  // Backward compatibility: if password is NOT hashed (plain text), compare directly
  if (!hashed.startsWith("$2")) {
    return plainText === hashed;
  }
  return bcrypt.compare(plainText, hashed);
}

// ── JWT token management ──
function getJWTSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) {
    return new TextEncoder().encode(secret);
  }
  // Fallback: derive a deterministic secret from DATABASE_URL so tokens work
  // across serverless invocations without requiring a separate env var.
  const dbUrl = process.env.DATABASE_URL || "ghms-fallback-secret-key";
  const derived = createHash("sha256").update(`ghms-jwt:${dbUrl}`).digest("hex");
  console.warn("[auth] JWT_SECRET not set — using derived secret. Set JWT_SECRET (32+ chars) in Vercel env vars for production.");
  return new TextEncoder().encode(derived);
}

export interface JWTPayload {
  userId: string;
  username: string;
  role: string;
  providerId: string | null;
  permissions: string[];
  policeRank: string;
  name: string;
  providerName?: string;
}

// Token expiry: 24 hours
const TOKEN_EXPIRY = "24h";

export async function createToken(payload: JWTPayload): Promise<string> {
  const secret = getJWTSecret();
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .setSubject(payload.userId)
    .sign(secret);
}

export async function verifyToken(
  token: string
): Promise<JWTPayload | null> {
  try {
    const secret = getJWTSecret();
    const { payload } = await jwtVerify(token, secret);
    return {
      userId: payload.sub || "",
      username: (payload.username as string) || "",
      role: (payload.role as string) || "",
      providerId: (payload.providerId as string) || null,
      permissions: (payload.permissions as string[]) || [],
      policeRank: (payload.policeRank as string) || "",
      name: (payload.name as string) || "",
      providerName: (payload.providerName as string) || undefined,
    };
  } catch {
    return null;
  }
}
