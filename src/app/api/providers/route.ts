import { NextRequest, NextResponse } from "next/server";
import { ensureDatabase } from "@/lib/init-db";
import { db } from "@/lib/db";
import { getAuthContext, AuthError } from "@/lib/tenant";
import { hashPassword } from "@/lib/auth-utils";

export async function GET(req: NextRequest) {
  try {
    await ensureDatabase();

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
        if (error instanceof AuthError) {
          return NextResponse.json({ error: error.message }, { status: error.statusCode });
        }
    const message = error instanceof Error ? error.message : "Failed to fetch providers";
    const status = message.includes("denied") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDatabase();

    const contentType = req.headers.get("content-type") || "";

    // ── JSON body: SUPERUSER creating a guesthouse (auto-approved) ──
    if (contentType.includes("application/json")) {
      const auth = await getAuthContext(req);
      if (auth.role !== "SUPERUSER") {
        return NextResponse.json({ error: "Only superuser can create guesthouses directly" }, { status: 403 });
      }

      const body = await req.json();
      const { name, ownerName, phone, email, address, type, licenseNo, licenseFile, username, password } = body;

      if (!name?.trim() || !ownerName?.trim() || !phone?.trim()) {
        return NextResponse.json(
          { error: "Guesthouse name, owner name, and phone are required" },
          { status: 400 }
        );
      }
      if (!username?.trim() || !password?.trim()) {
        return NextResponse.json(
          { error: "Operator username and password are required" },
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

      // ── Auto-geocode address to get lat/lng ──
      let geoLat: number | undefined;
      let geoLng: number | undefined;
      const addr = address?.trim() || "";
      if (addr) {
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr + ", Ethiopia")}&limit=1`,
            { headers: { "User-Agent": "GHMS-Registration/1.0" }, signal: AbortSignal.timeout(5000) }
          );
          const geoData = await geoRes.json();
          if (geoData?.length > 0) {
            geoLat = parseFloat(geoData[0].lat);
            geoLng = parseFloat(geoData[0].lon);
          }
        } catch { /* geocoding failed — store without coordinates */ }
      }

      const provider = await db.$transaction(async (tx) => {
        const p = await tx.provider.create({
          data: {
            name: name.trim(),
            ownerName: ownerName.trim(),
            phone: phone.trim(),
            email: email?.trim() || "",
            address: addr,
            ...(geoLat !== undefined && geoLng !== undefined ? { latitude: geoLat, longitude: geoLng } : {}),
            type: type || "GUEST_HOUSE",
            licenseNo: licenseNo?.trim() || "",
            licenseFile: typeof licenseFile === "string" ? licenseFile : "",
            status: "APPROVED",
            approvedBy: auth.userId || auth.username || "superuser",
            approvedAt: new Date(),
          },
        });

        const hashedPassword = await hashPassword(password.trim());

        await tx.user.create({
          data: {
            username: username.trim(),
            password: hashedPassword,
            role: "OPERATOR",
            name: ownerName.trim(),
            email: email?.trim() || null,
            phone: phone.trim(),
            providerId: p.id,
            isActive: true,
          },
        });

        return p;
      });

      return NextResponse.json(provider, { status: 201 });
    }

    // ── FormData body: Public registration (PENDING approval) ──
    const formData = await req.formData();

    const name = formData.get("name") as string;
    const ownerName = formData.get("ownerName") as string;
    const phone = formData.get("phone") as string;
    const email = (formData.get("email") as string) || "";
    const address = (formData.get("address") as string) || "";
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
      const bytes = await licenseFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64 = buffer.toString("base64");
      const mimeType = licenseFile.type || "application/octet-stream";
      licenseFileData = `data:${mimeType};base64,${base64}`;
    }

    // ── Auto-geocode address to get lat/lng ──
    let latitude: number | null = null;
    let longitude: number | null = null;
    if (address.trim()) {
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ", Ethiopia")}&limit=1`,
          { headers: { "User-Agent": "GHMS-Registration/1.0" }, signal: AbortSignal.timeout(5000) }
        );
        const geoData = await geoRes.json();
        if (geoData && geoData.length > 0) {
          latitude = parseFloat(geoData[0].lat);
          longitude = parseFloat(geoData[0].lon);
        }
      } catch {
        // Geocoding failed — store without coordinates
      }
    }

    const provider = await db.$transaction(async (tx) => {
      const p = await tx.provider.create({
        data: {
          name,
          ownerName,
          phone,
          email,
          address,
          ...(latitude !== null && longitude !== null ? { latitude, longitude } : {}),
          type,
          licenseNo,
          licenseFile: licenseFileData,
          status: "PENDING",
        },
      });

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
        if (error instanceof AuthError) {
          return NextResponse.json({ error: error.message }, { status: error.statusCode });
        }
    const message = error instanceof Error ? error.message : "Failed to register provider";
    const status = message.includes("required") || message.includes("taken") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
