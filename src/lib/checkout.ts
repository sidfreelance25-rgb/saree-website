import type { Prisma, PrismaClient } from "@prisma/client";
import { isUniqueError } from "./prisma";
import { priceCart, type CouponQuote } from "./pricing";
import { pinServiceable } from "./pin";

type Db = PrismaClient;

export class CheckoutError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export type AddressInput = {
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pin: string;
};

export type PlaceOrderInput = {
  storeId: string;
  cartId: string;
  idempotencyKey: string;
  email: string;
  phone: string;
  customerName: string;
  address: AddressInput;
  paymentMethod: "cod" | "demo_upi";
  couponCode?: string;
  customerNote?: string;
  marketingConsent?: boolean;
  userId?: string | null;
};

const orderInclude = {
  items: true,
  payments: true,
  events: true,
} satisfies Prisma.OrderInclude;

export async function placeOrder(db: Db, input: PlaceOrderInput) {
  const existing = await db.order.findUnique({
    where: {
      storeId_idempotencyKey: { storeId: input.storeId, idempotencyKey: input.idempotencyKey },
    },
    include: orderInclude,
  });
  if (existing) return { order: existing, created: false as const };

  if (input.marketingConsent) {
    await db.cart.updateMany({
      where: { id: input.cartId, storeId: input.storeId },
      data: { email: input.email },
    });
  }

  let created = true;
  try {
    const order = await db.$transaction(async (tx) => {
      const again = await tx.order.findUnique({
        where: {
          storeId_idempotencyKey: { storeId: input.storeId, idempotencyKey: input.idempotencyKey },
        },
        include: orderInclude,
      });
      if (again) {
        created = false;
        return again;
      }

      const store = await tx.store.findUnique({ where: { id: input.storeId } });
      if (!store || store.status !== "active") {
        throw new CheckoutError("STORE", "This store is not accepting orders.");
      }
      if (!pinServiceable(store, input.address.pin)) {
        throw new CheckoutError("PIN", "We do not ship to this PIN code yet.");
      }

      const cart = await tx.cart.findFirst({
        where: { id: input.cartId, storeId: input.storeId },
        include: { items: true },
      });
      if (!cart || cart.items.length === 0) {
        throw new CheckoutError("CART", "Your cart is empty.");
      }

      const lines: {
        productId: string;
        variantId: string;
        name: string;
        sku: string;
        variantName: string;
        qty: number;
        unitPricePaise: number;
        imageUrl: string;
      }[] = [];

      for (const item of cart.items) {
        const variant = await tx.productVariant.findFirst({
          where: { id: item.variantId, storeId: input.storeId, productId: item.productId },
          include: {
            product: { include: { images: { orderBy: { sort: "asc" }, take: 1 } } },
          },
        });
        if (!variant || variant.product.status !== "active" || variant.product.storeId !== input.storeId) {
          throw new CheckoutError("STOCK", "A saree in your cart is no longer available.");
        }
        if (item.qty < 1 || item.qty > 10) {
          throw new CheckoutError("QTY", "Quantity must be between 1 and 10.");
        }
        const taken = await tx.productVariant.updateMany({
          where: { id: variant.id, storeId: input.storeId, stock: { gte: item.qty } },
          data: { stock: { decrement: item.qty } },
        });
        if (taken.count !== 1) {
          throw new CheckoutError(
            "STOCK",
            `${variant.product.name} has ${variant.stock} piece${variant.stock === 1 ? "" : "s"} left.`,
          );
        }
        await tx.inventoryMovement.create({
          data: {
            storeId: input.storeId,
            productId: variant.productId,
            variantId: variant.id,
            qtyDelta: -item.qty,
            reason: input.paymentMethod === "cod" ? "sale" : "reserve",
            note: "checkout",
            actorName: "Customer",
          },
        });
        lines.push({
          productId: variant.productId,
          variantId: variant.id,
          name: variant.product.name,
          sku: variant.sku,
          variantName: variant.name,
          qty: item.qty,
          unitPricePaise: variant.pricePaise ?? variant.product.pricePaise,
          imageUrl: variant.imageUrl || variant.product.images[0]?.url || "",
        });
      }

      const coupon = await loadCoupon(tx, store.id, input.couponCode, input.email);
      const subtotalPaise = lines.reduce((sum, line) => sum + line.unitPricePaise * line.qty, 0);
      if (coupon && subtotalPaise < coupon.minOrderPaise) {
        throw new CheckoutError("COUPON", `This coupon needs a minimum merchandise total higher than this cart.`);
      }
      if (coupon) await consumeCoupon(tx, coupon);
      const quote = priceCart({
        lines: lines.map((line) => ({ unitPaise: line.unitPricePaise, qty: line.qty })),
        coupon: coupon ? toQuote(coupon) : null,
        shippingFlatPaise: store.shippingFlatPaise,
        freeShippingOverPaise: store.freeShippingOverPaise,
        taxInclusive: store.taxInclusive,
        gstRateBps: store.gstRateBps,
      });

      const sequenced = await tx.store.update({
        where: { id: store.id },
        data: { nextOrderSeq: { increment: 1 } },
      });
      const number = `${store.orderPrefix}-${sequenced.nextOrderSeq - 1}`;

      const customer = await tx.customer.upsert({
        where: { storeId_email: { storeId: store.id, email: input.email.toLowerCase() } },
        create: {
          storeId: store.id,
          userId: input.userId ?? null,
          name: input.customerName,
          email: input.email.toLowerCase(),
          phone: input.phone,
          consentEmail: Boolean(input.marketingConsent),
        },
        update: {
          name: input.customerName,
          phone: input.phone,
          userId: input.userId ?? undefined,
          consentEmail: input.marketingConsent ? true : undefined,
        },
      });

      const order = await tx.order.create({
        data: {
          storeId: store.id,
          customerId: customer.id,
          number,
          status: "new",
          paymentStatus: input.paymentMethod === "cod" ? "cod_pending" : "pending",
          paymentMethod: input.paymentMethod,
          email: input.email.toLowerCase(),
          phone: input.phone,
          customerName: input.customerName,
          addressJson: JSON.stringify(input.address),
          subtotalPaise: quote.subtotalPaise,
          discountPaise: quote.discountPaise,
          shippingPaise: quote.shippingPaise,
          taxPaise: quote.taxPaise,
          totalPaise: quote.totalPaise,
          couponCode: coupon?.code ?? null,
          idempotencyKey: input.idempotencyKey,
          customerNote: input.customerNote ?? "",
          items: { create: lines },
          events: {
            create: {
              status: "new",
              actorName: input.customerName,
              note: "Order placed",
            },
          },
          payments: {
            create: {
              storeId: store.id,
              provider: input.paymentMethod === "cod" ? "cod" : "demo",
              status: input.paymentMethod === "cod" ? "pending" : "requires_action",
              amountPaise: quote.totalPaise,
            },
          },
        },
        include: orderInclude,
      });

      if (coupon) {
        await tx.couponRedemption.create({
          data: {
            couponId: coupon.id,
            storeId: store.id,
            orderId: order.id,
            email: input.email.toLowerCase(),
          },
        });
      }

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.auditLog.create({
        data: {
          storeId: store.id,
          actorName: input.customerName,
          action: "order_placed",
          entity: "order",
          entityId: order.id,
          detail: `${order.number} ${quote.totalPaise} paise via ${input.paymentMethod}`,
        },
      });
      return order;
    });
    return { order, created };
  } catch (error) {
    if (isUniqueError(error)) {
      const raced = await db.order.findUnique({
        where: {
          storeId_idempotencyKey: { storeId: input.storeId, idempotencyKey: input.idempotencyKey },
        },
        include: orderInclude,
      });
      if (raced) return { order: raced, created: false as const };
    }
    throw error;
  }
}

async function loadCoupon(
  tx: Prisma.TransactionClient,
  storeId: string,
  code: string | undefined,
  email: string,
) {
  const trimmed = code?.trim();
  if (!trimmed) return null;
  const coupon = await tx.coupon.findUnique({
    where: { storeId_code: { storeId, code: trimmed.toUpperCase() } },
  });
  if (!coupon || !coupon.active) throw new CheckoutError("COUPON", "That coupon is not active.");
  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) throw new CheckoutError("COUPON", "That coupon is not active yet.");
  if (coupon.endsAt && coupon.endsAt < now) throw new CheckoutError("COUPON", "That coupon has expired.");
  if (coupon.firstOrderOnly) {
    const prior = await tx.order.count({
      where: { storeId, email: email.toLowerCase(), status: { not: "cancelled" } },
    });
    if (prior > 0) throw new CheckoutError("COUPON", "That coupon is only for a first order.");
  }
  const usedByCustomer = await tx.couponRedemption.count({
    where: { couponId: coupon.id, email: email.toLowerCase() },
  });
  if (usedByCustomer >= coupon.perCustomerLimit) {
    throw new CheckoutError("COUPON", "You have already used this coupon.");
  }
  return coupon;
}

async function consumeCoupon(
  tx: Prisma.TransactionClient,
  coupon: { id: string; usageLimit: number | null },
) {
  if (coupon.usageLimit != null) {
    const taken = await tx.coupon.updateMany({
      where: { id: coupon.id, usedCount: { lt: coupon.usageLimit } },
      data: { usedCount: { increment: 1 } },
    });
    if (taken.count !== 1) throw new CheckoutError("COUPON", "That coupon has reached its usage limit.");
  } else {
    await tx.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } });
  }
}

function toQuote(coupon: {
  type: string;
  value: number;
  freeShipping: boolean;
  minOrderPaise: number;
}): CouponQuote {
  if (coupon.type !== "percent" && coupon.type !== "fixed" && coupon.type !== "free_shipping") {
    throw new CheckoutError("COUPON", "That coupon cannot be applied.");
  }
  return { type: coupon.type, value: coupon.value, freeShipping: coupon.freeShipping };
}

export async function quoteCoupon(
  db: Db,
  storeId: string,
  code: string,
  subtotalPaise: number,
) {
  const coupon = await db.coupon.findUnique({
    where: { storeId_code: { storeId, code: code.trim().toUpperCase() } },
  });
  if (!coupon || !coupon.active) return { error: "That coupon is not active." };
  if (subtotalPaise < coupon.minOrderPaise) {
    return { error: `Add more to reach the minimum for ${coupon.code}.` };
  }
  return { coupon };
}
