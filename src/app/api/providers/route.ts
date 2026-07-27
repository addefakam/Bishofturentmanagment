import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, requirePolice } from "@/lib/tenant";
import { hashPassword } from "@/lib/auth-utils";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    // Both POLICE and SUPERUSER can list providers (guesthouses)
    if (auth.role !== "POLICE" && auth.role !== "SUPERUSER") {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    const providers = await db.provider.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(providers);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch providers";
    const status = message.includes("denied") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    // PUBLIC endpoint - no auth required
    const formData = await req.formData();

    const name = formData.get("name") as string;
    const ownerName = formData.get("ownerName") as string;
    const phone = formData.get("phone") as string;
    const email = (formData.get("email") as string) || "";
    const address = (formData.get("address") as string) || "";
    const latitude = parseFloat(formData.get("latitude") as string) || 9.02;
    const longitude = parseFloat(formData.get("longitude") as string) || 38.75;
    const type = (formData.get("type") as string) || "GUEST_HOUSE";
    const licenseNo = (formData.get("licenseNo") as string) || "";
    const licenseFile = formData.get("licenseFile") as File | null;
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    if (!name || !ownerName || !phone || !username || !password) {
      return NextResponse.json(
        { error: "name, ownerName, phone, username, and password are required" },
        { status: 400 }
      );
    }

    const existingUser = await db.user.findUnique({
      where: { username: username.trim() },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "Username is already taken" },
        { status: 409 }
      );
    }

    let licenseFileData = "";
    if (licenseFile) {
      // Convert file to base64 data URI for serverless-compatible storage
      const bytes = await licenseFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64 = buffer.toString("base64");
      const mimeType = licenseFile.type || "application/octet-stream";
      licenseFileData = `data:${mimeType};base64,${base64}`;
    }

    const provider = await db.$transaction(async (tx) => {
      const p = await tx.provider.create({
        data: {
          name,
          ownerName,
          phone,
          email,
          address,
          latitude,
          longitude,
          type,
          licenseNo,
          licenseFile: licenseFileData,
          status: "PENDING",
        },
      });

      // Hash password before storing
      const hashedPassword = await hashPassword(password);

      await tx.user.create({
        data: {
          username: username.trim(),
          password: hashedPassword,
          role: "OPERATOR",
          name: ownerName,
          providerId: p.id,
        },
      });

      return p;
    });

    return NextResponse.json(provider, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to register provider";
    const status = message.includes("required") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}