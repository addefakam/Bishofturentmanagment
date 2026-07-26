import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const jwtSecret = process.env.JWT_SECRET;
  const tursoDb = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  const payload = {
    deployedAt: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    jwtSecret: {
      isSet: typeof jwtSecret === "string" && jwtSecret.length > 0,
      length: jwtSecret?.length ?? 0,
      passesMinLength: typeof jwtSecret === "string" && jwtSecret.length >= 32,
    },
    turso: {
      dbUrlSet: typeof tursoDb === "string" && tursoDb.length > 0,
      dbUrlLength: tursoDb?.length ?? 0,
      tokenSet: typeof tursoToken === "string" && tursoToken.length > 0,
      tokenLength: tursoToken?.length ?? 0,
    },
    allEnvKeys: Object.keys(process.env)
      .filter((k) => !k.startsWith("npm_") && !k.startsWith("VERCEL_") && !k.startsWith("GH_") && !k.startsWith("AWS_") && !k.startsWith("TURBO_") && !k.startsWith("NOW_") && !k.startsWith("NX_") && !k.startsWith("LD_"))
      .sort(),
  };

  const res = NextResponse.json(payload);
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return res;
}
