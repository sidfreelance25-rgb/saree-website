"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  assertLoginAllowed,
  clearLoginFailures,
  hashPassword,
  recordLoginFailure,
  signWebhook,
  verifyPassword,
} from "@/lib/auth";
import { CheckoutError, placeOrder } from "@/lib/checkout";
import { adjustStock } from "@/lib/inventory";
import { rememberReceipt } from "@/lib/metrics";
import { notifyCustomer, notifySellers } from "@/lib/notify";
import { addOrderNote, transitionOrder } from "@/lib/orders";
import { handlePaymentWebhook } from "@/lib/payments";
import { can, isRole } from "@/lib/permissions";
import { rupeesToPaise, slugify } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { provisionStore } from "@/lib/provision";
import { clearSessionCookie, freshSession, platformContext, readSession, safeNext, sellerContext, writeSession } from "@/lib/session";
import { formatINR } from "@/lib/format";

function cookieBase() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

async function storeBySlug(slug: string) {
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store || store.status !== "active") throw new Error("Store not found.");
  return store;
}

async function ensureCart(storeId: string) {
  const jar = await cookies();
  const existingId = jar.get(`cart_${storeId}`)?.value;
  if (existingId) {
    const cart = await prisma.cart.findFirst({ where: { id: existingId, storeId } });
    if (cart) return cart;
  }
  const cart = await prisma.cart.create({ data: { storeId } });
  jar.set(`cart_${storeId}`, cart.id, { ...cookieBase(), maxAge: 60 * 60 * 24 * 30 });
  return cart;
}

export async function login(_prev: { error: string } | null, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"), "/");
  try {
    assertLoginAllowed(email);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Try again shortly." };
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    recordLoginFailure(email);
    return { error: "That email and password do not match." };
  }
  clearLoginFailures(email);
  await writeSession(freshSession(user.id));
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorName: user.name,
      action: "login",
      entity: "user",
      entityId: user.id,
      detail: "password",
    },
  });
  if (user.isPlatformAdmin && next === "/") redirect("/platform");
  const membership = await prisma.staffMembership.findFirst({ where: { userId: user.id } });
  if (membership && (next === "/" || next.startsWith("/login"))) redirect("/admin");
  redirect(next);
}

export async function logout() {
  await clearSessionCookie();
  redirect("/");
}

export async function signup(_prev: { error: string } | null, formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (name.length < 2) return { error: "Add your name." };
  if (!email.includes("@")) return { error: "Add a valid email." };
  if (password.length < 8) return { error: "Use at least 8 characters." };
  const store = await storeBySlug(slug).catch(() => null);
  if (!store) return { error: "Store not found." };
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with that email already exists. Sign in instead." };
  const user = await prisma.user.create({
    data: { name, email, phone, passwordHash: hashPassword(password) },
  });
  await prisma.customer.upsert({
    where: { storeId_email: { storeId: store.id, email } },
    create: { storeId: store.id, userId: user.id, name, email, phone },
    update: { userId: user.id, name, phone },
  });
  await writeSession(freshSession(user.id));
  redirect(`/s/${slug}/account`);
}

export async function addToCart(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const variantId = String(formData.get("variantId") ?? "");
  const qty = Math.max(1, Math.min(10, Number(formData.get("qty") ?? 1)));
  const store = await storeBySlug(slug);
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, productId, storeId: store.id, product: { status: "active" } },
  });
  if (!variant) redirect(`/s/${slug}?error=unavailable`);
  if (variant.stock < qty) redirect(`/s/${slug}/product/${productId}?error=stock`);
  const cart = await ensureCart(store.id);
  const current = await prisma.cartItem.findUnique({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
  });
  const nextQty = Math.min(10, (current?.qty ?? 0) + qty);
  if (nextQty > variant.stock) redirect(`/s/${slug}/cart?error=stock`);
  await prisma.cartItem.upsert({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
    create: { cartId: cart.id, productId, variantId, qty: nextQty },
    update: { qty: nextQty },
  });
  redirect(`/s/${slug}/cart`);
}

export async function setQty(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const variantId = String(formData.get("variantId") ?? "");
  const qty = Number(formData.get("qty") ?? 0);
  const store = await storeBySlug(slug);
  const cart = await ensureCart(store.id);
  if (qty <= 0) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id, variantId } });
  } else {
    const variant = await prisma.productVariant.findFirst({ where: { id: variantId, storeId: store.id } });
    if (!variant) redirect(`/s/${slug}/cart`);
    await prisma.cartItem.updateMany({
      where: { cartId: cart.id, variantId },
      data: { qty: Math.min(qty, variant.stock, 10) },
    });
  }
  redirect(`/s/${slug}/cart`);
}

export async function placeOrderAction(_prev: { error: string } | null, formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  let store;
  try {
    store = await storeBySlug(slug);
  } catch {
    return { error: "Store not found." };
  }
  const cart = await ensureCart(store.id);
  const session = await readSession();
  const phone = String(formData.get("phone") ?? "").replace(/\D/g, "").slice(-10);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const pin = String(formData.get("pin") ?? "").trim();
  if (!email.includes("@")) return { error: "Add an email address." };
  if (!/^[6-9]\d{9}$/.test(phone)) return { error: "Enter a 10-digit mobile number." };
  if (!/^\d{6}$/.test(pin)) return { error: "Enter a 6-digit PIN code." };
  if (String(formData.get("name") ?? "").trim().length < 2) return { error: "Add the name for the parcel." };
  if (String(formData.get("line1") ?? "").trim().length < 4) return { error: "Add a delivery address." };
  try {
    const result = await placeOrder(prisma, {
      storeId: store.id,
      cartId: cart.id,
      idempotencyKey: String(formData.get("idempotencyKey") ?? ""),
      email,
      phone,
      customerName: String(formData.get("name") ?? ""),
      address: {
        name: String(formData.get("name") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        line1: String(formData.get("line1") ?? ""),
        line2: String(formData.get("line2") ?? ""),
        city: String(formData.get("city") ?? ""),
        state: String(formData.get("state") ?? ""),
        pin: String(formData.get("pin") ?? ""),
      },
      paymentMethod: String(formData.get("paymentMethod") ?? "cod") === "demo_upi" ? "demo_upi" : "cod",
      couponCode: String(formData.get("couponCode") ?? ""),
      customerNote: String(formData.get("customerNote") ?? ""),
      marketingConsent: formData.get("marketingConsent") === "on",
      userId: session?.uid ?? null,
    });
    if (result.created) {
      await notifySellers(prisma, {
        storeId: store.id,
        event: "order_placed",
        title: `New order ${result.order.number}`,
        body: `${result.order.customerName} · ${formatINR(result.order.totalPaise)} · ${result.order.paymentMethod === "cod" ? "Cash on delivery" : "Demo UPI"}`,
        href: `/admin/orders/${result.order.id}`,
      });
      await notifyCustomer(prisma, {
        storeId: store.id,
        email: result.order.email,
        event: "order_confirmation",
        title: `Order ${result.order.number} received`,
        body: `${store.name} received your order for ${formatINR(result.order.totalPaise)}. The seller will confirm it from their phone.`,
      });
    }
    await rememberReceipt(result.order.id);
    if (result.order.paymentMethod === "demo_upi" && result.order.paymentStatus === "pending") {
      redirect(`/s/${slug}/pay/${result.order.number}`);
    }
    redirect(`/s/${slug}/order/${result.order.number}`);
  } catch (error) {
    if (error instanceof CheckoutError) return { error: error.message };
    if (typeof error === "object" && error && "digest" in error) throw error;
    return { error: error instanceof Error ? error.message : "Could not place the order." };
  }
}

export async function simulatePayment(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const number = String(formData.get("number") ?? "");
  const outcome = String(formData.get("outcome") ?? "succeeded");
  const store = await storeBySlug(slug);
  const order = await prisma.order.findFirst({ where: { storeId: store.id, number } });
  if (!order) redirect(`/s/${slug}`);
  const type = outcome === "failed" ? "payment.failed" : "payment.succeeded";
  const raw = JSON.stringify({
    eventId: `demo-${order.id}-${type}`,
    type,
    orderId: order.id,
    gatewayRef: `demo_${order.number}`,
  });
  await handlePaymentWebhook(prisma, raw, signWebhook(raw));
  if (type === "payment.succeeded") {
    await notifySellers(prisma, {
      storeId: store.id,
      event: "payment_received",
      title: `Payment received ${order.number}`,
      body: `${formatINR(order.totalPaise)} recorded by the demo desk.`,
      href: `/admin/orders/${order.id}`,
    });
    await notifyCustomer(prisma, {
      storeId: store.id,
      email: order.email,
      event: "payment_confirmation",
      title: `Payment received for ${order.number}`,
      body: `${store.name} recorded your demo payment of ${formatINR(order.totalPaise)}.`,
    });
  }
  redirect(`/s/${slug}/order/${order.number}`);
}

export async function subscribeNewsletter(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const store = await storeBySlug(slug);
  if (!email.includes("@")) redirect(`/s/${slug}?error=email`);
  await prisma.customer.upsert({
    where: { storeId_email: { storeId: store.id, email } },
    create: { storeId: store.id, name: "Subscriber", email, consentEmail: true, tags: "newsletter" },
    update: { consentEmail: true, tags: "newsletter" },
  });
  redirect(`/s/${slug}?joined=1`);
}

export async function toggleWishlist(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const session = await readSession();
  if (!session) redirect(`/login?next=/s/${slug}/product/${productId}`);
  const store = await storeBySlug(slug);
  const user = await prisma.user.findUnique({ where: { id: session.uid } });
  if (!user) redirect("/login");
  const customer = await prisma.customer.upsert({
    where: { storeId_email: { storeId: store.id, email: user.email } },
    create: { storeId: store.id, userId: user.id, name: user.name, email: user.email, phone: user.phone },
    update: { userId: user.id },
  });
  const existing = await prisma.wishlistItem.findUnique({
    where: { customerId_productId: { customerId: customer.id, productId } },
  });
  if (existing) await prisma.wishlistItem.delete({ where: { id: existing.id } });
  else await prisma.wishlistItem.create({ data: { storeId: store.id, customerId: customer.id, productId } });
  redirect(`/s/${slug}/product/${String(formData.get("productSlug") ?? "")}`);
}

export async function submitReview(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const productSlug = String(formData.get("productSlug") ?? "");
  const rating = Number(formData.get("rating") ?? 0);
  const body = String(formData.get("body") ?? "").trim();
  const session = await readSession();
  if (!session) redirect(`/login?next=/s/${slug}/product/${productSlug}`);
  const store = await storeBySlug(slug);
  const user = await prisma.user.findUnique({ where: { id: session.uid } });
  if (!user) redirect("/login");
  const purchased = await prisma.orderItem.findFirst({
    where: {
      productId,
      order: { storeId: store.id, email: user.email, status: { not: "cancelled" } },
    },
  });
  if (!purchased) redirect(`/s/${slug}/product/${productSlug}?error=review`);
  if (rating < 1 || rating > 5 || body.length < 4) redirect(`/s/${slug}/product/${productSlug}?error=review`);
  const customer = await prisma.customer.findUnique({
    where: { storeId_email: { storeId: store.id, email: user.email } },
  });
  await prisma.review.create({
    data: {
      storeId: store.id,
      productId,
      customerId: customer?.id,
      author: user.name,
      rating,
      body,
      status: "published",
    },
  });
  redirect(`/s/${slug}/product/${productSlug}`);
}

export async function requestReturn(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const number = String(formData.get("number") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const session = await readSession();
  if (!session) redirect(`/login?next=/s/${slug}/account`);
  const store = await storeBySlug(slug);
  const user = await prisma.user.findUnique({ where: { id: session.uid } });
  const order = await prisma.order.findFirst({ where: { storeId: store.id, number } });
  if (!order || !user || order.email !== user.email) redirect(`/s/${slug}/account`);
  if (order.status !== "delivered") redirect(`/s/${slug}/order/${number}?error=return`);
  const age = Date.now() - order.createdAt.getTime();
  if (age > store.returnWindowDays * 24 * 60 * 60 * 1000) redirect(`/s/${slug}/order/${number}?error=window`);
  if (reason.length < 4) redirect(`/s/${slug}/order/${number}?error=return`);
  await prisma.returnRequest.create({ data: { storeId: store.id, orderId: order.id, reason, status: "requested" } });
  await prisma.order.update({ where: { id: order.id }, data: { status: "return_requested" } });
  await prisma.orderEvent.create({
    data: { orderId: order.id, status: "return_requested", actorName: user.name, note: reason },
  });
  await notifySellers(prisma, {
    storeId: store.id,
    event: "return_requested",
    title: `Return requested ${order.number}`,
    body: reason.slice(0, 140),
    href: `/admin/orders/${order.id}`,
  });
  redirect(`/s/${slug}/order/${number}`);
}

export async function requestDeletion() {
  const session = await readSession();
  if (!session) redirect("/login");
  await prisma.user.update({ where: { id: session.uid }, data: { deletionRequestedAt: new Date() } });
  redirect("/login?deleted=1");
}

async function act(permission?: Parameters<typeof sellerContext>[0]) {
  return sellerContext(permission);
}

export async function moveOrder(formData: FormData) {
  const ctx = await act("orders.write");
  const to = String(formData.get("to") ?? "");
  try {
    await transitionOrder(prisma, {
      storeId: ctx.store.id,
      orderId: String(formData.get("id") ?? ""),
      to,
      actorId: ctx.user.id,
      actorName: ctx.support ? `Support: ${ctx.user.name}` : ctx.user.name,
      role: ctx.role,
      note: String(formData.get("note") ?? ""),
      courier: String(formData.get("courier") ?? ""),
      tracking: String(formData.get("tracking") ?? ""),
      trackingUrl: String(formData.get("trackingUrl") ?? ""),
    });
    const order = await prisma.order.findFirst({ where: { id: String(formData.get("id") ?? ""), storeId: ctx.store.id } });
    if (order && ["shipped", "cancelled", "delivered"].includes(to)) {
      await notifyCustomer(prisma, {
        storeId: ctx.store.id,
        email: order.email,
        event: `order_${to}`,
        title: `Order ${order.number} ${to}`,
        body:
          to === "shipped"
            ? `${ctx.store.name} shipped your order. ${String(formData.get("courier") ?? "")} ${String(formData.get("tracking") ?? "")}`
            : `${ctx.store.name} marked order ${order.number} as ${to}.`,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update the order.";
    redirect(`/admin/orders/${String(formData.get("id") ?? "")}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin");
  redirect(`/admin/orders/${String(formData.get("id") ?? "")}`);
}

export async function saveOrderNote(formData: FormData) {
  const ctx = await act("orders.write");
  await addOrderNote(prisma, {
    storeId: ctx.store.id,
    orderId: String(formData.get("id") ?? ""),
    note: String(formData.get("note") ?? ""),
    actorName: ctx.user.name,
    actorId: ctx.user.id,
    role: ctx.role,
    internal: formData.get("internal") === "on",
  });
  redirect(`/admin/orders/${String(formData.get("id") ?? "")}`);
}

export async function decideReturn(formData: FormData) {
  const ctx = await act("orders.write");
  const id = String(formData.get("returnId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const request = await prisma.returnRequest.findFirst({ where: { id, storeId: ctx.store.id } });
  if (!request) redirect("/admin/orders");
  if (decision === "approve") {
    await transitionOrder(prisma, {
      storeId: ctx.store.id,
      orderId: request.orderId,
      to: "returned",
      actorId: ctx.user.id,
      actorName: ctx.user.name,
      role: ctx.role,
      note: String(formData.get("note") ?? "Return approved"),
    });
    await prisma.returnRequest.update({ where: { id }, data: { status: "approved", note: String(formData.get("note") ?? "") } });
  } else {
    await prisma.returnRequest.update({ where: { id }, data: { status: "rejected", note: String(formData.get("note") ?? "") } });
    await prisma.order.updateMany({
      where: { id: request.orderId, storeId: ctx.store.id, status: "return_requested" },
      data: { status: "delivered" },
    });
    await prisma.orderEvent.create({
      data: {
        orderId: request.orderId,
        status: "delivered",
        actorName: ctx.user.name,
        note: String(formData.get("note") ?? "Return declined"),
      },
    });
  }
  redirect(`/admin/orders/${request.orderId}`);
}

export async function saveProduct(_prev: { error: string } | null, formData: FormData) {
  const ctx = await act("products.write");
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const price = Number(formData.get("price") ?? "");
  const required = new Set(ctx.store.requiredAttributes.split(",").map((item) => item.trim()));
  if (!name) return { error: "Add a saree name." };
  if (!sku) return { error: "Add a SKU." };
  if (!Number.isFinite(price) || price <= 0) return { error: "Add a price in rupees." };
  const fabric = String(formData.get("fabric") ?? "").trim();
  if (required.has("fabric") && !fabric) return { error: "Fabric is required for this store." };
  const slug = slugify(String(formData.get("slug") ?? "") || name);
  const images = String(formData.get("images") ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  const data = {
    name,
    slug,
    sku,
    description: String(formData.get("description") ?? ""),
    status: String(formData.get("status") ?? "draft"),
    sareeType: String(formData.get("sareeType") ?? ""),
    fabric,
    weave: String(formData.get("weave") ?? ""),
    work: String(formData.get("work") ?? ""),
    color: String(formData.get("color") ?? ""),
    secondaryColor: String(formData.get("secondaryColor") ?? ""),
    pattern: String(formData.get("pattern") ?? ""),
    occasion: String(formData.get("occasion") ?? ""),
    lengthCm: Number(formData.get("lengthCm") || 0) || null,
    blouseIncluded: formData.get("blouseIncluded") === "on",
    blouseDetail: String(formData.get("blouseDetail") ?? ""),
    origin: String(formData.get("origin") ?? ""),
    care: String(formData.get("care") ?? ""),
    dispatch: String(formData.get("dispatch") ?? "ready"),
    leadDays: Number(formData.get("leadDays") || 0),
    pricePaise: rupeesToPaise(price),
    compareAtPaise: formData.get("compareAt") ? rupeesToPaise(Number(formData.get("compareAt"))) : null,
    costPaise: formData.get("cost") ? rupeesToPaise(Number(formData.get("cost"))) : null,
    seoTitle: String(formData.get("seoTitle") ?? ""),
    seoDescription: String(formData.get("seoDescription") ?? ""),
    featured: formData.get("featured") === "on",
    lowStockAt: Number(formData.get("lowStockAt") || ctx.store.lowStockDefault),
    publishedAt: String(formData.get("status") ?? "") === "active" ? new Date() : null,
  };
  const stock = Math.max(0, Number(formData.get("stock") || 0));
  try {
    let product;
    if (id) {
      const owned = await prisma.product.findFirst({ where: { id, storeId: ctx.store.id } });
      if (!owned) return { error: "Product not found." };
      product = await prisma.product.update({ where: { id: owned.id }, data });
    } else {
      product = await prisma.product.create({ data: { ...data, storeId: ctx.store.id } });
    }
    if (images.length) {
      await prisma.productImage.deleteMany({ where: { productId: product.id, storeId: ctx.store.id } });
      await prisma.productImage.createMany({
        data: images.map((url, index) => ({ storeId: ctx.store.id, productId: product.id, url, alt: name, sort: index })),
      });
    }
    const variant = await prisma.productVariant.findFirst({ where: { productId: product.id, storeId: ctx.store.id } });
    if (!variant) {
      await prisma.productVariant.create({
        data: {
          storeId: ctx.store.id,
          productId: product.id,
          sku: `${sku}-1`,
          name: data.color || "Default",
          color: data.color,
          stock,
        },
      });
    } else if (formData.get("stock") !== null && String(formData.get("stock")) !== "") {
      const delta = stock - variant.stock;
      if (delta !== 0) {
        await adjustStock(prisma, {
          storeId: ctx.store.id,
          variantId: variant.id,
          qtyDelta: delta,
          reason: "count",
          note: "product form",
          actorName: ctx.user.name,
          actorId: ctx.user.id,
          role: ctx.role === "owner" || can(ctx.role, "inventory.write") ? ctx.role : "owner",
        });
      }
    }
    const extraName = String(formData.get("extraVariant") ?? "").trim();
    if (extraName) {
      await prisma.productVariant.create({
        data: {
          storeId: ctx.store.id,
          productId: product.id,
          sku: `${sku}-${slugify(extraName) || "var"}`,
          name: extraName,
          color: extraName,
          stock: Number(formData.get("extraStock") || 0),
          pricePaise: formData.get("extraPrice") ? rupeesToPaise(Number(formData.get("extraPrice"))) : null,
        },
      });
    }
    await prisma.auditLog.create({
      data: {
        storeId: ctx.store.id,
        actorId: ctx.user.id,
        actorName: ctx.user.name,
        action: id ? "product_update" : "product_create",
        entity: "product",
        entityId: product.id,
        detail: `${name} ${data.pricePaise}`,
      },
    });
  } catch (error) {
    if (typeof error === "object" && error && "digest" in error) throw error;
    return { error: error instanceof Error ? error.message : "Could not save the saree." };
  }
  revalidatePath("/admin/products");
  redirect("/admin/products");
}

export async function setProductStatus(formData: FormData) {
  const ctx = await act("products.write");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "archived");
  const product = await prisma.product.findFirst({ where: { id, storeId: ctx.store.id } });
  if (!product) redirect("/admin/products");
  if (status === "delete") {
    const used = await prisma.orderItem.count({ where: { productId: id } });
    if (used) {
      await prisma.product.update({ where: { id }, data: { status: "archived" } });
    } else {
      await prisma.product.delete({ where: { id } });
    }
  } else {
    await prisma.product.update({ where: { id }, data: { status } });
  }
  redirect("/admin/products");
}

export async function duplicateProduct(formData: FormData) {
  const ctx = await act("products.write");
  const id = String(formData.get("id") ?? "");
  const product = await prisma.product.findFirst({
    where: { id, storeId: ctx.store.id },
    include: { images: true, variants: true },
  });
  if (!product) redirect("/admin/products");
  const copy = await prisma.product.create({
    data: {
      storeId: ctx.store.id,
      name: `${product.name} copy`,
      slug: `${product.slug}-copy-${Date.now().toString().slice(-4)}`,
      sku: `${product.sku}-COPY`,
      description: product.description,
      status: "draft",
      sareeType: product.sareeType,
      fabric: product.fabric,
      weave: product.weave,
      work: product.work,
      color: product.color,
      pattern: product.pattern,
      occasion: product.occasion,
      lengthCm: product.lengthCm,
      blouseIncluded: product.blouseIncluded,
      blouseDetail: product.blouseDetail,
      origin: product.origin,
      care: product.care,
      dispatch: product.dispatch,
      leadDays: product.leadDays,
      pricePaise: product.pricePaise,
      compareAtPaise: product.compareAtPaise,
      costPaise: product.costPaise,
      images: {
        create: product.images.map((image) => ({
          storeId: ctx.store.id,
          url: image.url,
          alt: image.alt,
          sort: image.sort,
        })),
      },
      variants: {
        create: product.variants.map((variant) => ({
          storeId: ctx.store.id,
          sku: `${variant.sku}-COPY`,
          name: variant.name,
          color: variant.color,
          pricePaise: variant.pricePaise,
          stock: 0,
        })),
      },
    },
  });
  redirect(`/admin/products/${copy.id}`);
}

export async function importProducts(formData: FormData) {
  const ctx = await act("products.write");
  const file = formData.get("file");
  if (!(file instanceof File)) redirect("/admin/products?error=csv");
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const headers = lines.shift()?.split(",").map((cell) => cell.trim()) ?? [];
  for (const line of lines) {
    const cells = line.split(",").map((cell) => cell.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    if (!row.name || !row.sku || !row.price) continue;
    const pricePaise = rupeesToPaise(Number(row.price));
    const existing = await prisma.product.findUnique({
      where: { storeId_sku: { storeId: ctx.store.id, sku: row.sku } },
      include: { variants: true },
    });
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          pricePaise,
          fabric: row.fabric || existing.fabric,
          sareeType: row.saree_type || existing.sareeType,
          color: row.color || existing.color,
          occasion: row.occasion || existing.occasion,
          status: row.status || existing.status,
        },
      });
      if (row.stock && existing.variants[0]) {
        const delta = Number(row.stock) - existing.variants[0].stock;
        if (delta) {
          await adjustStock(prisma, {
            storeId: ctx.store.id,
            variantId: existing.variants[0].id,
            qtyDelta: delta,
            reason: "import",
            note: "csv",
            actorName: ctx.user.name,
            actorId: ctx.user.id,
            role: ctx.role,
          });
        }
      }
    } else {
      await prisma.product.create({
        data: {
          storeId: ctx.store.id,
          name: row.name,
          slug: slugify(row.sku),
          sku: row.sku,
          pricePaise,
          fabric: row.fabric ?? "",
          sareeType: row.saree_type ?? "",
          color: row.color ?? "",
          occasion: row.occasion ?? "",
          status: row.status || "draft",
          variants: {
            create: [{ storeId: ctx.store.id, sku: `${row.sku}-1`, name: row.color || "Default", color: row.color || "", stock: Number(row.stock || 0) }],
          },
        },
      });
    }
  }
  redirect("/admin/products");
}

export async function adjustStockAction(formData: FormData) {
  const ctx = await act("inventory.write");
  try {
    await adjustStock(prisma, {
      storeId: ctx.store.id,
      variantId: String(formData.get("variantId") ?? ""),
      qtyDelta: Number(formData.get("qtyDelta") ?? 0),
      reason: String(formData.get("reason") ?? "count"),
      note: String(formData.get("note") ?? ""),
      actorName: ctx.user.name,
      actorId: ctx.user.id,
      role: ctx.role,
    });
  } catch (error) {
    redirect(`/admin/inventory?error=${encodeURIComponent(error instanceof Error ? error.message : "Stock update failed")}`);
  }
  redirect("/admin/inventory");
}

export async function toggleSection(formData: FormData) {
  const ctx = await act("content.write");
  const id = String(formData.get("id") ?? "");
  const section = await prisma.homepageSection.findFirst({ where: { id, storeId: ctx.store.id } });
  if (!section) redirect("/admin/content");
  await prisma.homepageSection.update({ where: { id }, data: { enabled: !section.enabled } });
  redirect("/admin/content");
}

export async function moveSection(formData: FormData) {
  const ctx = await act("content.write");
  const id = String(formData.get("id") ?? "");
  const direction = Number(formData.get("direction") ?? 0);
  const sections = await prisma.homepageSection.findMany({ where: { storeId: ctx.store.id }, orderBy: { sort: "asc" } });
  const index = sections.findIndex((section) => section.id === id);
  const swap = sections[index + direction];
  if (index < 0 || !swap) redirect("/admin/content");
  await prisma.$transaction([
    prisma.homepageSection.update({ where: { id }, data: { sort: swap.sort } }),
    prisma.homepageSection.update({ where: { id: swap.id }, data: { sort: sections[index].sort } }),
  ]);
  redirect("/admin/content");
}

export async function updateSection(formData: FormData) {
  const ctx = await act("content.write");
  const id = String(formData.get("id") ?? "");
  await prisma.homepageSection.updateMany({
    where: { id, storeId: ctx.store.id },
    data: {
      title: String(formData.get("title") ?? ""),
      subtitle: String(formData.get("subtitle") ?? ""),
    },
  });
  redirect("/admin/content");
}

export async function savePage(_prev: { error: string } | null, formData: FormData) {
  const ctx = await act("content.write");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "") || title);
  if (!title || !body || !slug) return { error: "Title, slug, and body are required." };
  const id = String(formData.get("id") ?? "");
  const published = formData.get("published") === "on";
  if (id) {
    await prisma.page.updateMany({
      where: { id, storeId: ctx.store.id },
      data: { title, slug, body, published, seoTitle: String(formData.get("seoTitle") ?? ""), seoDescription: String(formData.get("seoDescription") ?? "") },
    });
  } else {
    await prisma.page.create({
      data: {
        storeId: ctx.store.id,
        title,
        slug,
        body,
        published,
        seoTitle: String(formData.get("seoTitle") ?? ""),
        seoDescription: String(formData.get("seoDescription") ?? ""),
      },
    });
  }
  redirect("/admin/content");
}

export async function addMenuItem(formData: FormData) {
  const ctx = await act("content.write");
  const label = String(formData.get("label") ?? "").trim();
  const href = String(formData.get("href") ?? "").trim();
  if (!label || !href) redirect("/admin/content?error=menu");
  const count = await prisma.menuItem.count({ where: { storeId: ctx.store.id } });
  await prisma.menuItem.create({ data: { storeId: ctx.store.id, label, href, sort: (count + 1) * 10 } });
  redirect("/admin/content");
}

export async function deleteMenuItem(formData: FormData) {
  const ctx = await act("content.write");
  await prisma.menuItem.deleteMany({ where: { id: String(formData.get("id") ?? ""), storeId: ctx.store.id } });
  redirect("/admin/content");
}

export async function addInstagramPost(formData: FormData) {
  const ctx = await act("instagram.write");
  const permalink = String(formData.get("permalink") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const caption = String(formData.get("caption") ?? "").trim();
  if (!permalink.startsWith("https://www.instagram.com/") || !imageUrl.startsWith("/")) {
    redirect("/admin/instagram?error=post");
  }
  await prisma.instagramPost.create({
    data: { storeId: ctx.store.id, source: "manual", permalink, imageUrl, caption, visible: true },
  });
  redirect("/admin/instagram");
}

export async function toggleInstagramPost(formData: FormData) {
  const ctx = await act("instagram.write");
  const post = await prisma.instagramPost.findFirst({ where: { id: String(formData.get("id") ?? ""), storeId: ctx.store.id } });
  if (!post) redirect("/admin/instagram");
  await prisma.instagramPost.update({ where: { id: post.id }, data: { visible: !post.visible } });
  redirect("/admin/instagram");
}

export async function instagramConnect(formData: FormData) {
  const ctx = await act("instagram.write");
  const action = String(formData.get("action") ?? "");
  if (action === "disconnect") {
    await prisma.instagramConnection.update({
      where: { storeId: ctx.store.id },
      data: { status: "disconnected", account: null, lastError: null },
    });
    redirect("/admin/instagram");
  }
  if (action === "sync") {
    const connection = await prisma.instagramConnection.findUnique({ where: { storeId: ctx.store.id } });
    if (connection?.lastSyncAt && Date.now() - connection.lastSyncAt.getTime() < 60_000) {
      redirect("/admin/instagram?error=rate");
    }
    if (!process.env.META_APP_ID || connection?.status !== "connected") {
      await prisma.instagramConnection.update({
        where: { storeId: ctx.store.id },
        data: {
          status: "disconnected",
          lastError: "Meta credentials are not configured, or the professional account is not connected. Add posts manually. No Instagram password is asked or stored.",
          lastSyncAt: new Date(),
        },
      });
      redirect("/admin/instagram?error=sync");
    }
  }
  await prisma.instagramConnection.update({
    where: { storeId: ctx.store.id },
    data: {
      status: "disconnected",
      lastError:
        "Connect needs a Meta app review and an Instagram professional account. This pilot keeps the official path closed until META_APP_ID and META_APP_SECRET are set by the platform operator. Use the manual gallery below. Taana will never ask for the Instagram password.",
    },
  });
  redirect("/admin/instagram");
}

export async function saveCoupon(formData: FormData) {
  const ctx = await act("promotions.write");
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const type = String(formData.get("type") ?? "percent");
  const rawValue = Number(formData.get("value") || 0);
  const value = type === "fixed" ? rupeesToPaise(rawValue) : rawValue;
  if (!code) redirect("/admin/discounts?error=code");
  await prisma.coupon.upsert({
    where: { storeId_code: { storeId: ctx.store.id, code } },
    create: {
      storeId: ctx.store.id,
      code,
      type,
      value,
      minOrderPaise: rupeesToPaise(Number(formData.get("min") || 0)),
      freeShipping: type === "free_shipping" || formData.get("freeShipping") === "on",
      firstOrderOnly: formData.get("firstOrderOnly") === "on",
      perCustomerLimit: Number(formData.get("perCustomer") || 1),
      active: true,
    },
    update: {
      type,
      value,
      active: formData.get("active") !== "off",
    },
  });
  redirect("/admin/discounts");
}

export async function saveSettings(formData: FormData) {
  const ctx = await act("settings.write");
  const visible = formData.getAll("visible").map(String).join(",");
  await prisma.store.update({
    where: { id: ctx.store.id },
    data: {
      description: String(formData.get("description") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? ""),
      whatsapp: String(formData.get("whatsapp") ?? ""),
      instagramHandle: String(formData.get("instagramHandle") ?? ""),
      seoTitle: String(formData.get("seoTitle") ?? ""),
      seoDescription: String(formData.get("seoDescription") ?? ""),
      shippingFlatPaise: rupeesToPaise(Number(formData.get("shipping") || 0)),
      freeShippingOverPaise: rupeesToPaise(Number(formData.get("freeOver") || 0)),
      gstRateBps: Math.round(Number(formData.get("gst") || 0) * 100),
      taxInclusive: formData.get("taxInclusive") === "on",
      returnWindowDays: Number(formData.get("returnWindow") || 7),
      pinPrefixes: String(formData.get("pinPrefixes") ?? ""),
      visibleAttributes: visible || ctx.store.visibleAttributes,
      requiredAttributes: String(formData.get("requiredAttributes") ?? ctx.store.requiredAttributes),
    },
  });
  await prisma.storeTheme.update({
    where: { storeId: ctx.store.id },
    data: {
      primary: String(formData.get("primary") ?? ctx.store.theme.primary),
      secondary: String(formData.get("secondary") ?? ctx.store.theme.secondary),
      accent: String(formData.get("accent") ?? ctx.store.theme.accent),
      background: String(formData.get("background") ?? ctx.store.theme.background),
      headingFont: String(formData.get("headingFont") ?? ctx.store.theme.headingFont),
    },
  });
  await prisma.auditLog.create({
    data: {
      storeId: ctx.store.id,
      actorId: ctx.user.id,
      actorName: ctx.user.name,
      action: "settings_update",
      entity: "store",
      entityId: ctx.store.id,
      detail: "theme and policies",
    },
  });
  redirect("/admin/settings?saved=1");
}

export async function inviteStaff(formData: FormData) {
  const ctx = await act("team.write");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!isRole(role) || role === "owner") redirect("/admin/team?error=role");
  if (!email.includes("@") || !name) redirect("/admin/team?error=fields");
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    if (password.length < 8) redirect("/admin/team?error=password");
    user = await prisma.user.create({ data: { email, name, passwordHash: hashPassword(password) } });
  }
  await prisma.staffMembership.upsert({
    where: { storeId_userId: { storeId: ctx.store.id, userId: user.id } },
    create: { storeId: ctx.store.id, userId: user.id, role },
    update: { role },
  });
  await prisma.auditLog.create({
    data: {
      storeId: ctx.store.id,
      actorId: ctx.user.id,
      actorName: ctx.user.name,
      action: "role_change",
      entity: "membership",
      entityId: user.id,
      detail: role,
    },
  });
  redirect("/admin/team");
}

export async function markNotificationsRead() {
  const ctx = await act();
  await prisma.notification.updateMany({ where: { storeId: ctx.store.id, audience: "seller", read: false }, data: { read: true } });
  redirect("/admin/notifications");
}

export async function sendTestNotification() {
  const ctx = await act();
  await notifySellers(prisma, {
    storeId: ctx.store.id,
    event: "test",
    title: "Test alert",
    body: "If you can read this in the inbox, seller alerts are reaching this store.",
    href: "/admin/notifications",
  });
  redirect("/admin/notifications");
}

export async function createStoreAction(_prev: { error: string } | null, formData: FormData) {
  await platformContext();
  const name = String(formData.get("name") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "") || name);
  const ownerName = String(formData.get("ownerName") ?? "").trim();
  const ownerEmail = String(formData.get("ownerEmail") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!name || !slug || !ownerName || !ownerEmail.includes("@") || password.length < 8) {
    return { error: "Name, slug, owner, and a password of 8 characters are required." };
  }
  const taken = await prisma.store.findUnique({ where: { slug } });
  if (taken) return { error: "That store slug is already in use." };
  let owner = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (!owner) {
    owner = await prisma.user.create({
      data: { name: ownerName, email: ownerEmail, passwordHash: hashPassword(password) },
    });
  }
  await provisionStore(prisma, {
    name,
    slug,
    description: String(formData.get("description") ?? "A new saree house on Taana."),
    phone: String(formData.get("phone") ?? "9999999999"),
    email: ownerEmail,
    addressLine: String(formData.get("address") ?? "Address to be added"),
    city: String(formData.get("city") ?? "City"),
    state: String(formData.get("state") ?? "State"),
    pin: "110001",
    legalName: name,
    logoText: name,
    seoTitle: name,
    seoDescription: `${name} on Taana.`,
    orderPrefix: slug.slice(0, 2).toUpperCase(),
    pinPrefixes: "110,221,400,560,600",
    preset: String(formData.get("preset") ?? "indigo"),
    ownerUserId: owner.id,
    announcement: "The house is open.",
    heroSubtitle: "A new storefront, ready for the first saree.",
    story: "Tell customers who weaves the cloth and who packs the parcel.",
  });
  redirect("/platform");
}

export async function setStoreStatus(formData: FormData) {
  const ctx = await platformContext();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "active");
  if (!["active", "suspended", "archived"].includes(status)) redirect("/platform");
  await prisma.store.update({ where: { id }, data: { status, supportNotes: String(formData.get("notes") ?? "") } });
  await prisma.auditLog.create({
    data: {
      storeId: id,
      actorId: ctx.user.id,
      actorName: ctx.user.name,
      action: "store_status",
      entity: "store",
      entityId: id,
      detail: status,
    },
  });
  redirect(`/platform/stores/${id}`);
}

export async function startSupport(formData: FormData) {
  const ctx = await platformContext();
  const storeId = String(formData.get("id") ?? "");
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) redirect("/platform");
  const supportExp = Date.now() + 30 * 60 * 1000;
  await prisma.supportSession.create({
    data: { storeId, actorId: ctx.user.id, expiresAt: new Date(supportExp) },
  });
  await prisma.auditLog.create({
    data: {
      storeId,
      actorId: ctx.user.id,
      actorName: ctx.user.name,
      action: "support_access",
      entity: "store",
      entityId: storeId,
      detail: "30 minutes",
    },
  });
  await writeSession({ ...freshSession(ctx.user.id), supportStoreId: storeId, supportExp });
  redirect("/admin");
}

export async function endSupport() {
  const session = await readSession();
  if (!session) redirect("/login");
  await writeSession(freshSession(session.uid));
  redirect("/platform");
}
