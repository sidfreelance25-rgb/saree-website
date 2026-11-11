import Link from "next/link";
import { cookies } from "next/headers";
import { CheckoutForm } from "@/components/widgets";
import { quoteCoupon } from "@/lib/checkout";
import { unitPrice } from "@/lib/catalog";
import { formatINR } from "@/lib/format";
import { priceCart } from "@/lib/pricing";
import { loadStore } from "@/lib/load";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string }>;
  searchParams: Promise<{ coupon?: string }>;
}) {
  const { store: slug } = await params;
  const query = await searchParams;
  const store = await loadStore(slug);
  const session = await readSession();
  const user = session ? await prisma.user.findUnique({ where: { id: session.uid } }) : null;
  const cartId = (await cookies()).get(`cart_${store.id}`)?.value;
  const cart = cartId ? await prisma.cart.findFirst({ where: { id: cartId, storeId: store.id }, include: { items: true } }) : null;
  const lines = [];
  for (const item of cart?.items ?? []) {
    const variant = await prisma.productVariant.findFirst({
      where: { id: item.variantId, storeId: store.id },
      include: { product: true },
    });
    if (!variant || variant.product.status !== "active") continue;
    lines.push({ name: variant.product.name, qty: item.qty, price: unitPrice(variant.product, variant) });
  }
  let couponError = "";
  let applied = null as null | { type: "percent" | "fixed" | "free_shipping"; value: number; freeShipping: boolean };
  if (query.coupon) {
    const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
    const result = await quoteCoupon(prisma, store.id, query.coupon, subtotal);
    if ("error" in result && result.error) couponError = result.error;
    else if ("coupon" in result && result.coupon) {
      const coupon = result.coupon;
      if (coupon.type === "percent" || coupon.type === "fixed" || coupon.type === "free_shipping") {
        applied = { type: coupon.type, value: coupon.value, freeShipping: coupon.freeShipping };
      }
    }
  }
  const quote = priceCart({
    lines: lines.map((line) => ({ unitPaise: line.price, qty: line.qty })),
    coupon: applied,
    shippingFlatPaise: store.shippingFlatPaise,
    freeShippingOverPaise: store.freeShippingOverPaise,
    taxInclusive: store.taxInclusive,
    gstRateBps: store.gstRateBps,
  });
  if (lines.length === 0) {
    return <div className="wrap"><h1>Checkout</h1><p>Your cart is empty. <Link href={`/s/${slug}`}>Return to the shop</Link></p></div>;
  }
  return (
    <div className="wrap" style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: "2.4rem" }}>Checkout</h1>
      <div className="note">
        {lines.map((line) => <p key={line.name}>{line.name} × {line.qty}</p>)}
      </div>
      <form className="row" action={`/s/${slug}/checkout`}>
        <label className="field" style={{ flex: 1 }}><span>Coupon</span><input name="coupon" defaultValue={query.coupon ?? ""} placeholder="WELCOME10" /></label>
        <button className="btn ghost" type="submit">Apply</button>
      </form>
      {couponError && <p className="error">{couponError}</p>}
      <div className="summary">
        <div><span>Merchandise</span><span>{formatINR(quote.subtotalPaise)}</span></div>
        <div><span>Discount</span><span>{formatINR(quote.discountPaise)}</span></div>
        <div><span>Shipping</span><span>{formatINR(quote.shippingPaise)}</span></div>
        <div><span>{store.taxInclusive ? "GST included in merchandise" : "GST"}</span><span>{formatINR(quote.taxPaise)}</span></div>
        <div><strong>To pay</strong><strong>{formatINR(quote.totalPaise)}</strong></div>
      </div>
      <p className="muted">Billing address matches this delivery address. Returns follow the {store.returnWindowDays}-day window on the policy page.</p>
      <CheckoutForm
        slug={slug}
        coupon={applied ? (query.coupon ?? "").toUpperCase() : ""}
        defaults={{ name: user?.name ?? "", email: user?.email ?? "", phone: user?.phone ?? "" }}
      />
    </div>
  );
}
