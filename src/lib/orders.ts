import type { PrismaClient } from "@prisma/client";
import { can } from "./permissions";

type Db = PrismaClient;

const NEXT: Record<string, string[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["processing", "packed", "cancelled"],
  processing: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["delivered", "return_requested"],
  delivered: ["return_requested"],
  return_requested: ["returned", "delivered"],
  returned: [],
  cancelled: [],
};

export function canTransition(from: string, to: string) {
  return (NEXT[from] ?? []).includes(to);
}

export async function transitionOrder(
  db: Db,
  args: {
    storeId: string;
    orderId: string;
    to: string;
    actorId?: string | null;
    actorName: string;
    role: string;
    note?: string;
    courier?: string;
    tracking?: string;
    trackingUrl?: string;
  },
) {
  if (!can(args.role, "orders.write")) {
    throw new Error("You do not have permission to update orders.");
  }
  const order = await db.order.findFirst({
    where: { id: args.orderId, storeId: args.storeId },
    include: { items: true, shipment: true },
  });
  if (!order) throw new Error("Order not found.");
  if (!canTransition(order.status, args.to)) {
    throw new Error(`This order cannot move from ${order.status} to ${args.to}.`);
  }
  if (args.to === "shipped") {
    if (!args.courier?.trim() || !args.tracking?.trim()) {
      throw new Error("Add a courier and a tracking number before shipping.");
    }
  }
  if (args.to === "cancelled" && !args.note?.trim()) {
    throw new Error("Add a reason for the cancellation.");
  }

  await db.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { status: args.to },
    });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        status: args.to,
        actorId: args.actorId ?? null,
        actorName: args.actorName,
        note: args.note?.trim() || statusNote(args.to),
      },
    });
    if (args.to === "shipped") {
      await tx.shipment.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          storeId: args.storeId,
          courier: args.courier!.trim(),
          tracking: args.tracking!.trim(),
          trackingUrl: args.trackingUrl?.trim() ?? "",
        },
        update: {
          courier: args.courier!.trim(),
          tracking: args.tracking!.trim(),
          trackingUrl: args.trackingUrl?.trim() ?? "",
        },
      });
    }
    if (args.to === "cancelled" || args.to === "returned") {
      if (order.paymentStatus !== "failed") {
        for (const item of order.items) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.qty } },
          });
          await tx.inventoryMovement.create({
            data: {
              storeId: args.storeId,
              productId: item.productId,
              variantId: item.variantId,
              qtyDelta: item.qty,
              reason: args.to === "returned" ? "return" : "cancel",
              note: args.note?.trim() ?? "",
              actorName: args.actorName,
            },
          });
        }
      }
      if (order.paymentStatus === "paid") {
        await tx.refund.create({
          data: {
            orderId: order.id,
            storeId: args.storeId,
            amountPaise: order.totalPaise,
            status: "recorded",
            reason: args.note?.trim() || args.to,
          },
        });
        await tx.order.update({
          where: { id: order.id },
          data: { paymentStatus: "refund_recorded" },
        });
      }
    }
    await tx.auditLog.create({
      data: {
        storeId: args.storeId,
        actorId: args.actorId ?? null,
        actorName: args.actorName,
        action: "order_status",
        entity: "order",
        entityId: order.id,
        detail: `${order.status} -> ${args.to}`,
      },
    });
  });
}

function statusNote(status: string) {
  switch (status) {
    case "confirmed":
      return "Order confirmed";
    case "processing":
      return "Order is being prepared";
    case "packed":
      return "Order packed";
    case "shipped":
      return "Handed to the courier";
    case "delivered":
      return "Marked delivered";
    case "cancelled":
      return "Order cancelled";
    case "returned":
      return "Return completed";
    default:
      return status;
  }
}

export async function addOrderNote(
  db: Db,
  args: { storeId: string; orderId: string; note: string; actorName: string; actorId?: string; role: string; internal: boolean },
) {
  if (!can(args.role, "orders.write")) throw new Error("You do not have permission to update orders.");
  const order = await db.order.findFirst({ where: { id: args.orderId, storeId: args.storeId } });
  if (!order) throw new Error("Order not found.");
  await db.order.update({
    where: { id: order.id },
    data: args.internal ? { internalNote: args.note } : { customerNote: args.note },
  });
  await db.auditLog.create({
    data: {
      storeId: args.storeId,
      actorId: args.actorId,
      actorName: args.actorName,
      action: args.internal ? "internal_note" : "customer_note",
      entity: "order",
      entityId: order.id,
      detail: args.note.slice(0, 240),
    },
  });
}
