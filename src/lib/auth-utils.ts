import bcrypt from "bcryptjs";
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
  // This allows seamless migration from plain text to hashed passwords
  if (!hashed.startsWith("$2")) {
    return plainText === hashed;
  }
  return bcrypt.compare(plainText, hashed);
}

// ── JWT token management ──
// JWT_SECRET MUST be set in environment variables. No fallback.
// Throws at call time if missing — server will not start signing/verifying
// tokens with a known-public secret.
function getJWTSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET environment variable is missing or too short (minimum 32 characters). " +
      "Generate one with: openssl rand -base64 48"
    );
  }
  return new TextEncoder().encode(secret);
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
