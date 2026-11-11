import type { PrismaClient } from "@prisma/client";
import { can } from "./permissions";

type Db = PrismaClient;

export async function adjustStock(
  db: Db,
  args: {
    storeId: string;
    variantId: string;
    qtyDelta: number;
    reason: string;
    note: string;
    actorName: string;
    actorId?: string | null;
    role: string;
  },
) {
  if (!can(args.role, "inventory.write")) {
    throw new Error("You do not have permission to adjust stock.");
  }
  if (!Number.isInteger(args.qtyDelta) || args.qtyDelta === 0) {
    throw new Error("Enter a non-zero whole number.");
  }
  const variant = await db.productVariant.findUnique({ where: { id: args.variantId } });
  if (!variant || variant.storeId !== args.storeId) {
    throw new Error("Variant not found.");
  }
  if (variant.stock + args.qtyDelta < 0) {
    throw new Error("Stock cannot go below zero.");
  }
  await db.$transaction([
    db.productVariant.update({
      where: { id: variant.id },
      data: { stock: { increment: args.qtyDelta } },
    }),
    db.inventoryMovement.create({
      data: {
        storeId: args.storeId,
        productId: variant.productId,
        variantId: variant.id,
        qtyDelta: args.qtyDelta,
        reason: args.reason,
        note: args.note,
        actorName: args.actorName,
      },
    }),
    db.auditLog.create({
      data: {
        storeId: args.storeId,
        actorId: args.actorId ?? null,
        actorName: args.actorName,
        action: "stock_adjust",
        entity: "variant",
        entityId: variant.id,
        detail: `${args.qtyDelta} ${args.reason} ${args.note}`.trim(),
      },
    }),
  ]);
}
