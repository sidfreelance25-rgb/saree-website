import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { after, before, describe, it } from "node:test";
import { PrismaClient } from "@prisma/client";
import { signWebhook } from "../src/lib/auth";
import { CheckoutError, placeOrder } from "../src/lib/checkout";
import { adjustStock } from "../src/lib/inventory";
import { transitionOrder } from "../src/lib/orders";
import { handlePaymentWebhook } from "../src/lib/payments";

const dbFile = "/tmp/taana-test.db";
process.env.DATABASE_URL = `file:${dbFile}`;
process.env.SESSION_SECRET = "test-session-secret-value";
process.env.PAYMENT_WEBHOOK_SECRET = "test-payment-webhook-secret";

let db: PrismaClient;
let sequence = 0;

before(() => {
  rmSync(dbFile, { force: true });
  execSync("npx prisma db push --skip-generate", {
    stdio: "inherit",
    env: process.env,
  });
  db = new PrismaClient({ datasources: { db: { url: `file:${dbFile}` } } });
});

after(async () => {
  if (db) await db.$disconnect();
});

async function shop(stock = 2) {
  sequence += 1;
  const id = `shop-${sequence}`;
  const store = await db.store.create({
    data: {
      name: id,
      slug: id,
      description: "Test house",
      phone: "9999999999",
      email: `${id}@test.local`,
      addressLine: "1 Loom Street",
      city: "Varanasi",
      state: "UP",
      pin: "221001",
      legalName: id,
      logoText: id,
      seoTitle: id,
      seoDescription: id,
      orderPrefix: `T${sequence}`,
      pinPrefixes: "110,221",
      blockedPins: "999999",
      visibleAttributes: "fabric",
      shippingFlatPaise: 9900,
      freeShippingOverPaise: 500000,
      taxInclusive: true,
      gstRateBps: 500,
    },
  });
  const product = await db.product.create({
    data: {
      storeId: store.id,
      name: "Test Katan",
      slug: `katan-${sequence}`,
      sku: `SKU-${sequence}`,
      pricePaise: 200000,
      status: "active",
      fabric: "Silk",
    },
  });
  const variant = await db.productVariant.create({
    data: {
      storeId: store.id,
      productId: product.id,
      sku: `SKU-${sequence}-1`,
      name: "Maroon",
      color: "Maroon",
      stock,
    },
  });
  const cart = await db.cart.create({
    data: {
      storeId: store.id,
      items: { create: [{ productId: product.id, variantId: variant.id, qty: 1 }] },
    },
  });
  return { store, product, variant, cart };
}

function orderInput(storeId: string, cartId: string, key: string, method: "cod" | "demo_upi" = "cod") {
  return {
    storeId,
    cartId,
    idempotencyKey: key,
    email: "buyer@example.com",
    phone: "9810011122",
    customerName: "Buyer",
    address: {
      name: "Buyer",
      phone: "9810011122",
      line1: "12 Nizamuddin",
      line2: "",
      city: "Delhi",
      state: "Delhi",
      pin: "110013",
    },
    paymentMethod: method,
  };
}

describe("checkout and tenant isolation", () => {
  it("decrements stock once when the same idempotency key is replayed", async () => {
    const { store, variant, cart } = await shop(3);
    const input = orderInput(store.id, cart.id, "same-key");
    const first = await placeOrder(db, input);
    const second = await placeOrder(db, input);
    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(first.order.id, second.order.id);
    const fresh = await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    assert.equal(fresh.stock, 2);
    assert.equal(first.order.totalPaise, 200000 + 9900);
  });

  it("refuses to oversell", async () => {
    const { store, variant, cart } = await shop(1);
    await db.cartItem.updateMany({ where: { cartId: cart.id }, data: { qty: 2 } });
    await assert.rejects(() => placeOrder(db, orderInput(store.id, cart.id, "oversell")), (error: unknown) => {
      assert.ok(error instanceof CheckoutError);
      assert.equal(error.code, "STOCK");
      return true;
    });
    const fresh = await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    assert.equal(fresh.stock, 1);
  });

  it("rejects an unserviceable PIN without taking stock", async () => {
    const { store, variant, cart } = await shop(2);
    await assert.rejects(
      () =>
        placeOrder(db, {
          ...orderInput(store.id, cart.id, "bad-pin"),
          address: { ...orderInput(store.id, cart.id, "bad-pin").address, pin: "560001" },
        }),
      (error: unknown) => error instanceof CheckoutError && error.code === "PIN",
    );
    const fresh = await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    assert.equal(fresh.stock, 2);
  });

  it("marks a signed webhook paid once and restores stock when payment fails", async () => {
    const { store, variant, cart } = await shop(2);
    const placed = await placeOrder(db, orderInput(store.id, cart.id, "upi-1", "demo_upi"));
    assert.equal(placed.order.paymentStatus, "pending");
    const success = JSON.stringify({
      eventId: "evt-success-1",
      type: "payment.succeeded",
      orderId: placed.order.id,
      gatewayRef: "demo_1",
    });
    const ok = await handlePaymentWebhook(db, success, signWebhook(success));
    assert.equal(ok.ok, true);
    const again = await handlePaymentWebhook(db, success, signWebhook(success));
    assert.equal(again.ok, true);
    assert.equal("duplicate" in again && again.duplicate, true);
    const paid = await db.order.findUniqueOrThrow({ where: { id: placed.order.id } });
    assert.equal(paid.paymentStatus, "paid");

    const bad = await handlePaymentWebhook(db, success, "deadbeef");
    assert.equal(bad.ok, false);
    assert.equal(bad.status, 401);

    const otherCart = await db.cart.create({
      data: {
        storeId: store.id,
        items: { create: [{ productId: placed.order.items[0].productId, variantId: variant.id, qty: 1 }] },
      },
    });
    const failedOrder = await placeOrder(db, orderInput(store.id, otherCart.id, "upi-fail", "demo_upi"));
    const failure = JSON.stringify({
      eventId: "evt-fail-1",
      type: "payment.failed",
      orderId: failedOrder.order.id,
    });
    const failed = await handlePaymentWebhook(db, failure, signWebhook(failure));
    assert.equal(failed.ok, true);
    const cancelled = await db.order.findUniqueOrThrow({ where: { id: failedOrder.order.id } });
    assert.equal(cancelled.status, "cancelled");
    const stock = await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    assert.equal(stock.stock, 1);
  });

  it("does not let one store adjust another store's stock", async () => {
    const a = await shop(4);
    const b = await shop(4);
    await assert.rejects(() =>
      adjustStock(db, {
        storeId: b.store.id,
        variantId: a.variant.id,
        qtyDelta: -1,
        reason: "count",
        note: "cross",
        actorName: "Owner B",
        role: "owner",
      }),
    );
    const stock = await db.productVariant.findUniqueOrThrow({ where: { id: a.variant.id } });
    assert.equal(stock.stock, 4);
    await adjustStock(db, {
      storeId: a.store.id,
      variantId: a.variant.id,
      qtyDelta: -1,
      reason: "count",
      note: "own",
      actorName: "Owner A",
      role: "owner",
    });
    const changed = await db.productVariant.findUniqueOrThrow({ where: { id: a.variant.id } });
    assert.equal(changed.stock, 3);
  });

  it("blocks an order manager from confirming when the role cannot write orders... catalogue cannot", async () => {
    const { store, cart } = await shop(2);
    const placed = await placeOrder(db, orderInput(store.id, cart.id, "role-order"));
    await assert.rejects(() =>
      transitionOrder(db, {
        storeId: store.id,
        orderId: placed.order.id,
        to: "confirmed",
        actorName: "Catalogue",
        role: "catalogue",
      }),
    );
    const order = await db.order.findUniqueOrThrow({ where: { id: placed.order.id } });
    assert.equal(order.status, "new");
  });

  it("keeps theme colours on the store that owns them", async () => {
    const a = await shop();
    const b = await shop();
    await db.storeTheme.create({
      data: {
        storeId: a.store.id,
        preset: "banaras",
        primary: "#111111",
        secondary: "#222222",
        accent: "#333333",
        background: "#ffffff",
        ink: "#000000",
        card: "#ffffff",
        headingFont: "Fraunces",
        bodyFont: "Outfit",
      },
    });
    await db.storeTheme.create({
      data: {
        storeId: b.store.id,
        preset: "kanchi",
        primary: "#abcdef",
        secondary: "#000000",
        accent: "#111111",
        background: "#ffffff",
        ink: "#000000",
        card: "#ffffff",
        headingFont: "Fraunces",
        bodyFont: "Outfit",
      },
    });
    await db.storeTheme.update({ where: { storeId: a.store.id }, data: { primary: "#654321" } });
    const other = await db.storeTheme.findUniqueOrThrow({ where: { storeId: b.store.id } });
    assert.equal(other.primary, "#abcdef");
  });
});
