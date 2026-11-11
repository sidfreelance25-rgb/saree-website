import type { PrismaClient } from "@prisma/client";
import { verifyWebhookSignature } from "./auth";
import { isUniqueError } from "./prisma";

type Db = PrismaClient;

export type PaymentEvent = {
  eventId: string;
  type: "payment.succeeded" | "payment.failed";
  orderId: string;
  gatewayRef?: string;
};

export async function handlePaymentWebhook(db: Db, raw: string, signature: string | null) {
  if (!verifyWebhookSignature(raw, signature)) {
    return { ok: false as const, status: 401, error: "Invalid signature" };
  }
  let event: PaymentEvent;
  try {
    event = JSON.parse(raw) as PaymentEvent;
  } catch {
    return { ok: false as const, status: 400, error: "Invalid JSON" };
  }
  if (!event.eventId || !event.orderId || (event.type !== "payment.succeeded" && event.type !== "payment.failed")) {
    return { ok: false as const, status: 400, error: "Missing payment fields" };
  }

  const seen = await db.webhookEvent.findUnique({
    where: { provider_eventId: { provider: "demo", eventId: event.eventId } },
  });
  if (seen) return { ok: true as const, duplicate: true, status: seen.status };

  try {
    await db.$transaction(async (tx) => {
      await tx.webhookEvent.create({
        data: {
          provider: "demo",
          eventId: event.eventId,
          status: "processed",
          payload: raw,
        },
      });
      const order = await tx.order.findUnique({
        where: { id: event.orderId },
        include: { items: true },
      });
      if (!order) throw new Error("Order not found");

      if (event.type === "payment.succeeded") {
        if (order.paymentStatus === "paid") return;
        await tx.order.update({
          where: { id: order.id },
          data: { paymentStatus: "paid" },
        });
        await tx.payment.updateMany({
          where: { orderId: order.id },
          data: { status: "paid", gatewayRef: event.gatewayRef ?? "" },
        });
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            status: order.status,
            actorName: "Demo payments",
            note: "Payment received",
          },
        });
        await tx.auditLog.create({
          data: {
            storeId: order.storeId,
            actorName: "Demo payments",
            action: "payment_received",
            entity: "order",
            entityId: order.id,
            detail: event.gatewayRef ?? event.eventId,
          },
        });
        return;
      }

      if (order.paymentStatus === "paid" || order.paymentStatus === "failed") return;
      await tx.order.update({
        where: { id: order.id },
        data: { paymentStatus: "failed", status: "cancelled" },
      });
      for (const item of order.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.qty } },
        });
        await tx.inventoryMovement.create({
          data: {
            storeId: order.storeId,
            productId: item.productId,
            variantId: item.variantId,
            qtyDelta: item.qty,
            reason: "release",
            note: "payment failed",
            actorName: "Demo payments",
          },
        });
      }
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          status: "cancelled",
          actorName: "Demo payments",
          note: "Payment failed. Reserved stock was released.",
        },
      });
    });
    return { ok: true as const, duplicate: false, status: "processed" };
  } catch (error) {
    if (isUniqueError(error)) return { ok: true as const, duplicate: true, status: "processed" };
    const message = error instanceof Error ? error.message : "Webhook failed";
    await db.webhookEvent.create({
      data: {
        provider: "demo",
        eventId: `${event.eventId}:error:${Date.now()}`,
        status: "failed",
        payload: raw,
        error: message,
      },
    }).catch(() => undefined);
    return { ok: false as const, status: 500, error: message };
  }
}
