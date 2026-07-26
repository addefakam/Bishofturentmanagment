import { NextResponse } from "next/server";

// TEMPORARY diagnostic endpoint — DELETE AFTER DEBUGGING.
// Reveals ONLY whether env vars are set and their lengths, never the values.
export async function GET() {
  const jwtSecret = process.env.JWT_SECRET;
  const nodeEnv = process.env.NODE_ENV;
  const vercelEnv = process.env.VERCEL_ENV;
  const tursoDb = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  return NextResponse.json({
    nodeEnv,
    vercelEnv,
    jwtSecret: {
      isSet: typeof jwtSecret === "string" && jwtSecret.length > 0,
      length: jwtSecret?.length ?? 0,
      firstChar: jwtSecret?.[0] ?? null,
      lastChar: jwtSecret?.[jwtSecret.length - 1] ?? null,
      hasNewline: jwtSecret?.includes("\n") ?? false,
      hasCarriageReturn: jwtSecret?.includes("\r") ?? false,
      hasSpace: jwtSecret?.includes(" ") ?? false,
      passesMinLength: typeof jwtSecret === "string" && jwtSecret.length >= 32,
    },
    turso: {
      dbUrlSet: typeof tursoDb === "string" && tursoDb.length > 0,
      tokenSet: typeof tursoToken === "string" && tursoToken.length > 0,
    },
    allEnvKeys: Object.keys(process.env)
      .filter((k) => !k.startsWith("npm_") && !k.startsWith("VERCEL_") && !k.startsWith("GH_"))
      .sort(),
  });
}
