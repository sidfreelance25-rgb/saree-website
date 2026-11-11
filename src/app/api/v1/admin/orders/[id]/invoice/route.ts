import { NextResponse } from "next/server";
import { formatINR } from "@/lib/format";
import { simplePdf } from "@/lib/pdf";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return new NextResponse("Sign in required", { status: 401 });
  const { id } = await context.params;
  const order = await prisma.order.findUnique({ where: { id }, include: { items: true, store: true } });
  if (!order) return new NextResponse("Not found", { status: 404 });
  const membership = await prisma.staffMembership.findFirst({ where: { userId: session.uid, storeId: order.storeId } });
  const allowed = (membership && can(membership.role, "orders.read")) || session.supportStoreId === order.storeId;
  if (!allowed) return new NextResponse("Not allowed", { status: 403 });
  const lines = [
    order.store.legalName,
    `Invoice ${order.number}`,
    `GSTIN ${order.store.gstin ?? "not set"}`,
    ...order.items.map((item) => `${item.name} x ${item.qty}  ${formatINR(item.unitPricePaise * item.qty)}`),
    `GST ${formatINR(order.taxPaise)}`,
    `Shipping ${formatINR(order.shippingPaise)}`,
    `Invoice total ${formatINR(order.totalPaise)}`,
    `Payment ${order.paymentStatus}`,
  ];
  const pdf = simplePdf(lines);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${order.number}.pdf"`,
    },
  });
}
