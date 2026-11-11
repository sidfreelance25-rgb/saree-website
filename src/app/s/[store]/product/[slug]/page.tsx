import type { Metadata } from "next";
import Link from "next/link";
import { ColourStudio, RememberProduct } from "@/components/widgets";
import { submitReview, toggleWishlist } from "@/server/actions";
import { displayPrice, totalStock } from "@/lib/catalog";
import { loadCatalog, loadStore } from "@/lib/load";
import { deliveryCopy, pinServiceable } from "@/lib/pin";
import { ATTRIBUTE_FIELDS } from "@/lib/presets";
import { readSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({ params }: { params: Promise<{ store: string; slug: string }> }): Promise<Metadata> {
  const { store: storeSlug, slug } = await params;
  const store = await loadStore(storeSlug);
  const product = await prisma.product.findUnique({ where: { storeId_slug: { storeId: store.id, slug } } });
  if (!product) return {};
  return {
    title: product.seoTitle || product.name,
    description: product.seoDescription || product.description,
    alternates: { canonical: `/s/${storeSlug}/product/${slug}` },
  };
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string; slug: string }>;
  searchParams: Promise<{ pin?: string; error?: string; variant?: string }>;
}) {
  const { store: storeSlug, slug } = await params;
  const query = await searchParams;
  const store = await loadStore(storeSlug);
  const product = await prisma.product.findFirst({
    where: { storeId: store.id, slug, status: "active" },
    include: {
      images: { orderBy: { sort: "asc" } },
      variants: { orderBy: { sort: "asc" } },
      reviews: { where: { status: "published" }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!product) return <div className="wrap"><h1>This saree is not on the floor.</h1></div>;
  const visible = new Set(store.visibleAttributes.split(","));
  const price = displayPrice(product);
  const selected = product.variants.find((variant) => variant.id === query.variant) ?? product.variants[0];
  const shared = product.images.filter((image) => !image.variantId);
  const colours = product.variants.map((variant) => {
    const own = product.images.filter((image) => image.variantId === variant.id);
    return {
      id: variant.id,
      name: variant.name || variant.color || "Colour",
      stock: variant.stock,
      pricePaise: variant.pricePaise,
      images: (own.length ? own : shared).map((image) => ({ url: image.url, alt: image.alt || `${product.name} ${variant.name}` })),
    };
  });
  const start = Math.max(0, colours.findIndex((colour) => colour.id === selected?.id));
  const pin = query.pin ?? "";
  const serviceable = pin ? pinServiceable(store, pin) : true;
  const session = await readSession();
  const user = session ? await prisma.user.findUnique({ where: { id: session.uid } }) : null;
  const catalog = await loadCatalog(store.id);
  const related = catalog.filter((item) => item.id !== product.id && (item.sareeType === product.sareeType || item.occasion === product.occasion)).slice(0, 4);
  const rows: [string, string][] = [];
  const values: Record<string, string> = {
    sareeType: product.sareeType,
    fabric: product.fabric,
    weave: product.weave,
    work: product.work,
    color: product.color,
    pattern: product.pattern,
    occasion: product.occasion,
    length: product.lengthCm ? `${product.lengthCm} cm` : "",
    blouse: product.blouseIncluded ? product.blouseDetail || "Included" : "Not included",
    origin: product.origin,
    care: product.care,
    dispatch: product.dispatch === "made_to_order" ? `Made to order, about ${product.leadDays} days` : "Ready to ship",
  };
  for (const [key, label] of ATTRIBUTE_FIELDS) {
    if (visible.has(key) && values[key]) rows.push([label, values[key]]);
  }
  const share = `https://wa.me/?text=${encodeURIComponent(`${product.name} at ${store.name}`)}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    description: product.description,
    image: product.images.map((image) => image.url),
    brand: { "@type": "Brand", name: store.name },
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: (price / 100).toFixed(2),
      availability: totalStock(product) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="wrap product">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <RememberProduct store={storeSlug} id={product.id} />
      <p className="crumbs" style={{ gridColumn: "1 / -1" }}><Link href={`/s/${storeSlug}`}>Home</Link> / <Link href={`/s/${storeSlug}/search?sareeType=${encodeURIComponent(product.sareeType)}`}>{product.sareeType}</Link> / {product.name}</p>
      <ColourStudio
        key={colours[start]?.id ?? "colour"}
        store={storeSlug}
        productId={product.id}
        basePrice={product.pricePaise}
        compareAt={product.compareAtPaise}
        kicker={`${product.sareeType} · ${product.sku}`}
        name={product.name}
        colours={start > 0 ? [...colours.slice(start), ...colours.slice(0, start)] : colours}
      >
        {product.dispatch === "made_to_order" && <p className="note">Made to order. The loom needs about {product.leadDays} days before this ships.</p>}
        <p>{product.description}</p>
        <div className="row">
          {user ? (
            <form action={toggleWishlist}>
              <input type="hidden" name="slug" value={storeSlug} />
              <input type="hidden" name="productId" value={product.id} />
              <input type="hidden" name="productSlug" value={slug} />
              <button className="btn ghost" type="submit">Wishlist</button>
            </form>
          ) : <Link className="btn ghost" href={`/login?next=/s/${storeSlug}/product/${slug}`}>Wishlist</Link>}
          <a className="btn ghost" href={share}>Share on WhatsApp</a>
        </div>
        <form className="row" action={`/s/${storeSlug}/product/${slug}`} method="get">
          {query.variant && <input type="hidden" name="variant" value={query.variant} />}
          <label className="field" style={{ flex: 1 }}><span>Check a PIN code</span><input name="pin" defaultValue={pin} inputMode="numeric" pattern="[0-9]{6}" /></label>
          <button className="btn ghost" type="submit">Check</button>
        </form>
        {pin && <p>{deliveryCopy(product, serviceable)}</p>}
        <table className="specs">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}><th>{label}</th><td>{value}</td></tr>
            ))}
          </tbody>
        </table>
        <details className="fold"><summary>Shipping</summary><p>Flat shipping is shown in the cart and becomes free above the store threshold. The seller confirms the order before it is packed.</p></details>
        <details className="fold"><summary>Returns</summary><p>Unworn sarees can be requested within {store.returnWindowDays} days of delivery. Made-to-order pieces follow the note on this page.</p></details>
        <h2 style={{ fontSize: "1.6rem" }}>Reviews</h2>
        {product.reviews.length === 0 && <p className="muted">No reviews yet.</p>}
        {product.reviews.map((review) => (
          <blockquote key={review.id} className="note">
            <strong>{review.rating}/5 · {review.author}</strong>
            <p>{review.body}</p>
          </blockquote>
        ))}
        {query.error === "review" && <p className="error">Reviews are open after you order this saree, with a rating and a few words.</p>}
        {user && (
          <form action={submitReview} className="stack">
            <input type="hidden" name="slug" value={storeSlug} />
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="productSlug" value={slug} />
            <label className="field"><span>Your rating</span>
              <select name="rating" defaultValue="5">
                <option>5</option><option>4</option><option>3</option><option>2</option><option>1</option>
              </select>
            </label>
            <label className="field"><span>Review</span><textarea name="body" rows={3} required /></label>
            <button className="btn" type="submit">Publish review</button>
          </form>
        )}
        {related.length > 0 && (
          <div>
            <h2 style={{ fontSize: "1.6rem" }}>Also from this house</h2>
            <div className="rail">
              {related.map((item) => (
                <Link key={item.id} className="chip" href={`/s/${storeSlug}/product/${item.slug}`}>{item.name}</Link>
              ))}
            </div>
          </div>
        )}
      </ColourStudio>
    </div>
  );
}
