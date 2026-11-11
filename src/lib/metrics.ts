import { prisma } from "./prisma";

export function startOfDayIST(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const [year, month, day] = parts.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, -5, -30));
}

export async function soldByProduct(storeId: string) {
  const items = await prisma.orderItem.findMany({
    where: { order: { storeId, status: { not: "cancelled" } } },
    select: { productId: true, qty: true },
  });
  const sold: Record<string, number> = {};
  for (const item of items) sold[item.productId] = (sold[item.productId] ?? 0) + item.qty;
  return sold;
}

export async function rememberReceipt(orderId: string) {
  const { cookies } = await import("next/headers");
  const { signSession } = await import("./auth");
  const jar = await cookies();
  jar.set("taana_receipt", signSession({ uid: orderId, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function receiptAllows(orderId: string) {
  const { cookies } = await import("next/headers");
  const { verifySession } = await import("./auth");
  const token = (await cookies()).get("taana_receipt")?.value;
  if (!token) return false;
  const payload = verifySession(token);
  return payload?.uid === orderId;
}
