import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

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

    // ── Create default SUPERUSER if none exists ──
    const prisma = new PrismaClient();
    const superUsername = "admin";
    const superPassword = "Admin@2024";

    const existing = await prisma.user.findUnique({
      where: { username: superUsername },
    });

    let credentials: { username: string; password: string } | null = null;

    if (!existing) {
      const hashedPassword = await bcrypt.hash(superPassword, 12);
      await prisma.user.create({
        data: {
          username: superUsername,
          password: hashedPassword,
          name: "System Administrator",
          role: "SUPERUSER",
          permissions: "[]",
          policeRank: "",
        },
      });
      credentials = { username: superUsername, password: superPassword };
      console.log("[setup-db] Default SUPERUSER created.");
    } else {
      console.log("[setup-db] SUPERUSER already exists, skipping creation.");
    }

    // Ensure default PoliceAlertConfig exists
    await prisma.policeAlertConfig.upsert({
      where: { id: "default-alert-config" },
      update: {},
      create: { id: "default-alert-config" },
    });

    await prisma.$disconnect();

    return NextResponse.json({
      success: true,
      message: credentials
        ? "Database ready + SUPERUSER created."
        : "Database ready. SUPERUSER already exists.",
      superuser: credentials, // { username, password } — only returned on first run
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[setup-db] Error:", message);
    return NextResponse.json(
      {
        success: false,
        error: message,
        hint: "Make sure DATABASE_URL and JWT_SECRET are set in Vercel environment variables.",
      },
      { status: 500 }
    );
  }
}
