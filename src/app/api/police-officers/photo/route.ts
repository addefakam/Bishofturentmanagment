import { NextRequest, NextResponse } from "next/server";

// Simple photo upload endpoint for officers — returns base64 data URL
// Max size: 2MB
const MAX_SIZE = 2 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("photo") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No photo provided" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Photo must be under 2MB" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Only JPG, PNG, WebP, and GIF images are allowed" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    return NextResponse.json({ photoUrl: dataUrl });
  } catch {
    return NextResponse.json({ error: "Failed to process photo" }, { status: 500 });
  }
}
