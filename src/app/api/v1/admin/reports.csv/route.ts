import { NextResponse } from "next/server";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) return new NextResponse("Sign in required", { status: 401 });
  const membership = await prisma.staffMembership.findFirst({ where: { userId: session.uid } });
  const storeId = session.supportStoreId ?? membership?.storeId;
  const role = session.supportStoreId ? "owner" : membership?.role ?? "";
  if (!storeId || !can(role, "reports.read")) return new NextResponse("Not allowed", { status: 403 });
  const url = new URL(request.url);
  const from = new Date(url.searchParams.get("from") ?? Date.now() - 30 * 86400000);
  const to = new Date(url.searchParams.get("to") ?? Date.now());
  const orders = await prisma.order.findMany({ where: { storeId, createdAt: { gte: from, lte: to } } });
  const lines = ["number,status,payment_status,total_paise,created_at"];
  for (const order of orders) {
    lines.push([order.number, order.status, order.paymentStatus, String(order.totalPaise), order.createdAt.toISOString()].join(","));
  }
  return new NextResponse(lines.join("\n"), { headers: { "content-type": "text/csv; charset=utf-8" } });
}
