import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const memberships = await prisma.staffMembership.findMany({ where: { userId: session.uid } });
  let storeId = memberships[0]?.storeId;
  let role = memberships[0]?.role ?? "";
  if (session.supportStoreId && session.supportExp && session.supportExp > Date.now()) {
    const user = await prisma.user.findUnique({ where: { id: session.uid } });
    if (user?.isPlatformAdmin) {
      storeId = session.supportStoreId;
      role = "owner";
    }
  }
  if (!storeId || !(can(role, "products.write") || can(role, "instagram.write"))) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  const video = file.type === "video/mp4" || file.type === "video/webm";
  const image = file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp";
  if (!video && !image) {
    return NextResponse.json({ error: "Use a JPEG, PNG, WebP, or MP4" }, { status: 400 });
  }
  if (file.size > (video ? 20_000_000 : 2_500_000)) {
    return NextResponse.json({ error: video ? "Video must be under 20 MB" : "Photo is still too large" }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const extension = file.type === "video/mp4" ? "mp4" : file.type === "video/webm" ? "webm" : "jpg";
  const filename = `${randomBytes(8).toString("hex")}.${extension}`;
  const dir = join(process.cwd(), "public", "uploads", storeId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), bytes);
  const url = `/uploads/${storeId}/${filename}`;
  await prisma.mediaAsset.create({
    data: { storeId, url, filename, mime: file.type, bytes: file.size },
  });
  return NextResponse.json({ url });
}
