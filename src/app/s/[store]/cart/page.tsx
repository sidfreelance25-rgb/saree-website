import Link from "next/link";
import { cookies } from "next/headers";
import { setQty } from "@/server/actions";
import { unitPrice } from "@/lib/catalog";
import { formatINR } from "@/lib/format";
import { priceCart } from "@/lib/pricing";
import { loadStore } from "@/lib/load";
import { prisma } from "@/lib/prisma";

export default async function CartPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { store: slug } = await params;
  const query = await searchParams;
  const store = await loadStore(slug);
  const cartId = (await cookies()).get(`cart_${store.id}`)?.value;
  const cart = cartId
    ? await prisma.cart.findFirst({
        where: { id: cartId, storeId: store.id },
        include: { items: true },
      })
    : null;
  const lines = [];
  for (const item of cart?.items ?? []) {
    const variant = await prisma.productVariant.findFirst({
      where: { id: item.variantId, storeId: store.id },
      include: { product: { include: { images: { take: 1 } } } },
    });
    if (!variant) continue;
    lines.push({ item, variant, price: unitPrice(variant.product, variant) });
  }
  const quote = priceCart({
    lines: lines.map((line) => ({ unitPaise: line.price, qty: line.item.qty })),
    shippingFlatPaise: store.shippingFlatPaise,
    freeShippingOverPaise: store.freeShippingOverPaise,
    taxInclusive: store.taxInclusive,
    gstRateBps: store.gstRateBps,
  });
  return (
    <div className="wrap">
      <h1 style={{ fontSize: "2.6rem" }}>Cart</h1>
      {query.error === "stock" && <p className="error">One of these sarees does not have that many pieces left.</p>}
      {lines.length === 0 ? (
        <div className="note">
          <p>The cart is empty.</p>
          <p><Link href={`/s/${slug}`}>Browse the house</Link></p>
        </div>
      ) : (
        <>
          {lines.map((line) => (
            <div className="line" key={line.item.id}>
              {line.variant.product.images[0] && <img src={line.variant.product.images[0].url} alt="" />}
              <div>
                <Link href={`/s/${slug}/product/${line.variant.product.slug}`}><strong>{line.variant.product.name}</strong></Link>
                <p className="muted">{line.variant.name}</p>
                <p>{formatINR(line.price)}</p>
                <div className="qty">
                  <form action={setQty}><input type="hidden" name="slug" value={slug} /><input type="hidden" name="variantId" value={line.variant.id} /><input type="hidden" name="qty" value={line.item.qty - 1} /><button className="btn ghost" type="submit">−</button></form>
                  <span aria-label="Quantity">{line.item.qty}</span>
                  <form action={setQty}><input type="hidden" name="slug" value={slug} /><input type="hidden" name="variantId" value={line.variant.id} /><input type="hidden" name="qty" value={line.item.qty + 1} /><button className="btn ghost" type="submit">+</button></form>
                </div>
              </div>
              <strong>{formatINR(line.price * line.item.qty)}</strong>
            </div>
          ))}
          <div className="summary">
            <div><span>Merchandise</span><span>{formatINR(quote.subtotalPaise)}</span></div>
            <div><span>Shipping</span><span>{quote.shippingPaise === 0 ? "Free" : formatINR(quote.shippingPaise)}</span></div>
            <div><span>{store.taxInclusive ? "GST included" : "GST"}</span><span>{formatINR(quote.taxPaise)}</span></div>
            <div><strong>Total</strong><strong>{formatINR(quote.totalPaise)}</strong></div>
          </div>
          <p className="muted">Gross total is what you pay. GST {store.taxInclusive ? "is already inside the merchandise price" : "is added on top"}.</p>
          <Link className="btn block" href={`/s/${slug}/checkout`}>Checkout</Link>
        </>
      )}
    </div>
  );
}
