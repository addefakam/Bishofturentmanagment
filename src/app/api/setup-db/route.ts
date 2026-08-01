import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";

export const maxDuration = 60; // Allow up to 60s for schema push

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { secret } = body as { secret?: string };

    // Simple protection: require a setup secret from env
    const setupSecret = process.env.SETUP_SECRET || "ghms-setup-2024";
    if (secret !== setupSecret) {
      return NextResponse.json(
        { error: "Invalid setup secret" },
        { status: 403 }
      );
    }

    // Check DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: "DATABASE_URL environment variable is not set on Vercel" },
        { status: 500 }
      );
    }

    // Run prisma db push to create/update all tables
    const projectRoot = path.resolve(process.cwd(), "..");
    console.log("[setup-db] Running prisma db push...");
    console.log("[setup-db] CWD:", process.cwd());
    console.log("[setup-db] DATABASE_URL prefix:", process.env.DATABASE_URL.substring(0, 30) + "...");

    const output = execSync(
      `npx prisma db push --accept-data-loss 2>&1`,
      {
        cwd: projectRoot,
        env: { ...process.env },
        timeout: 55000,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    console.log("[setup-db] prisma db push output:", output);

    // Generate Prisma client
    console.log("[setup-db] Generating Prisma client...");
    const genOutput = execSync(`npx prisma generate 2>&1`, {
      cwd: projectRoot,
      env: { ...process.env },
      timeout: 55000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    console.log("[setup-db] prisma generate output:", genOutput);

    return NextResponse.json({
      success: true,
      message: "Database schema pushed and Prisma client generated successfully.",
      pushOutput: output,
      generateOutput: genOutput,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[setup-db] Error:", message);
    // execSync includes stdout in the error message
    return NextResponse.json(
      {
        success: false,
        error: message,
        hint: "Make sure DATABASE_URL is set correctly in Vercel environment variables.",
      },
      { status: 500 }
    );
  }
}
