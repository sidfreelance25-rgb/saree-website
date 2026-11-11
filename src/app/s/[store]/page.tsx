import Link from "next/link";
import { ProductCard } from "@/components/shell";
import { RecentlyViewed } from "@/components/widgets";
import { subscribeNewsletter } from "@/server/actions";
import { loadCatalog, loadStore } from "@/lib/load";
import { soldByProduct } from "@/lib/metrics";
import { readSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function StoreHome({
  params,
  searchParams,
}: {
  params: Promise<{ store: string }>;
  searchParams: Promise<{ preview?: string; joined?: string }>;
}) {
  const { store: slug } = await params;
  const query = await searchParams;
  const store = await loadStore(slug);
  const session = await readSession();
  const staff = session
    ? await prisma.staffMembership.findFirst({ where: { userId: session.uid, storeId: store.id } })
    : null;
  const preview = query.preview === "1" && (Boolean(staff) || session?.supportStoreId === store.id);
  const sections = await prisma.homepageSection.findMany({
    where: { storeId: store.id, ...(preview ? {} : { enabled: true }) },
    orderBy: { sort: "asc" },
  });
  const products = await loadCatalog(store.id);
  const collections = await prisma.collection.findMany({ where: { storeId: store.id }, orderBy: { sort: "asc" } });
  const posts = await prisma.instagramPost.findMany({
    where: { storeId: store.id, visible: true },
    orderBy: { postedAt: "desc" },
    take: 6,
  });
  const sold = await soldByProduct(store.id);
  const heroImage = products.find((product) => product.featured)?.images[0]?.url;

  return (
    <div>
      {preview && <p className="announce">Preview. Hidden sections are included. Customers do not see this view.</p>}
      {query.joined && <p className="note wrap">You will hear when the next lot is ready.</p>}
      {sections.filter((section) => section.type !== "announcement").map((section) => {
        const hidden = preview && !section.enabled;
        const extra = sectionExtras(section.payload);
        return (
          <section key={section.id} className="section" style={hidden ? { opacity: 0.55 } : undefined}>
            {section.type === "hero" && (
              <div className="hero">
                <div>
                  {hidden && <p className="kicker">Hidden</p>}
                  <p className="kicker">{store.city}</p>
                  <h1>{section.title}</h1>
                  <p className="lede" style={{ marginTop: "0.8rem" }}>{section.subtitle}</p>
                  {extra.body && <p>{extra.body}</p>}
                  <div className="hero-actions">
                    <Link className="btn" href={`/s/${slug}/collection/new-arrivals`}>Shop the edit</Link>
                    <Link className="btn ghost" href={`/s/${slug}/page/about`}>The house</Link>
                  </div>
                </div>
                <div className="hero-media">{(extra.imageUrl || heroImage) && <img src={extra.imageUrl || heroImage} alt="" />}</div>
              </div>
            )}
            {section.type === "collections" && (
              <>
                <div className="section-head"><h2>{section.title}</h2></div>
                <p className="muted">{section.subtitle}</p>
                <div className="rail" style={{ marginTop: "0.8rem" }}>
                  {collections.filter((collection) => collection.showInNav).map((collection) => (
                    <Link key={collection.id} className="chip" href={`/s/${slug}/collection/${collection.slug}`}>{collection.name}</Link>
                  ))}
                </div>
              </>
            )}
            {section.type === "shop_by_type" && (
              <>
                <div className="section-head"><h2>{section.title}</h2></div>
                <div className="rail">
                  {[...new Set(products.map((product) => product.sareeType).filter(Boolean))].map((type) => (
                    <Link key={type} className="chip" href={`/s/${slug}/search?sareeType=${encodeURIComponent(type)}`}>{type}</Link>
                  ))}
                </div>
              </>
            )}
            {section.type === "shop_by_occasion" && (
              <>
                <div className="section-head"><h2>{section.title}</h2></div>
                <div className="rail">
                  {[...new Set(products.map((product) => product.occasion).filter(Boolean))].map((occasion) => (
                    <Link key={occasion} className="chip" href={`/s/${slug}/search?occasion=${encodeURIComponent(occasion)}`}>{occasion}</Link>
                  ))}
                </div>
              </>
            )}
            {section.type === "shop_by_fabric" && (
              <>
                <div className="section-head"><h2>{section.title}</h2></div>
                <div className="rail">
                  {[...new Set(products.map((product) => product.fabric).filter(Boolean))].map((fabric) => (
                    <Link key={fabric} className="chip" href={`/s/${slug}/search?fabric=${encodeURIComponent(fabric)}`}>{fabric}</Link>
                  ))}
                </div>
              </>
            )}
            {["new_arrivals", "featured", "best_sellers"].includes(section.type) && (
              <>
                <div className="section-head">
                  <div>
                    <h2>{section.title}</h2>
                    {section.subtitle && <p className="muted">{section.subtitle}</p>}
                  </div>
                </div>
                <div className="grid">
                  {pick(products, section.type, sold).map((product) => (
                    <ProductCard key={product.id} store={slug} product={product} />
                  ))}
                </div>
              </>
            )}
            {section.type === "campaign" && (
              <div className="campaign">
                <p className="kicker">This season</p>
                <h2>{section.title}</h2>
                <p style={{ margin: "0.5rem 0 1rem" }}>{extra.body || section.subtitle}</p>
                {extra.imageUrl && <img src={extra.imageUrl} alt="" style={{ width: "100%", maxHeight: 360, objectFit: "cover", marginBottom: "0.8rem" }} />}
                <Link className="btn" href={`/s/${slug}/collection/wedding`}>Wedding edit</Link>
              </div>
            )}
            {section.type === "instagram" && (
              <>
                <div className="section-head">
                  <div>
                    <h2>{section.title}</h2>
                    <p className="muted">{section.subtitle}</p>
                  </div>
                  <Link href={`/s/${slug}/instagram`}>Gallery</Link>
                </div>
                {posts.length === 0 ? <p className="note">The seller has not chosen posts yet.</p> : (
                  <div className="insta">
                    {posts.map((post) => (
                      <a key={post.id} href={post.permalink} target="_blank" rel="noreferrer">
                        <img src={post.imageUrl} alt={post.caption} />
                      </a>
                    ))}
                  </div>
                )}
              </>
            )}
            {section.type === "testimonials" && (
              <div className="quotes">
                <h2>{section.title}</h2>
                {quotes(section.payload).map((quote) => (
                  <blockquote key={quote.name}>
                    {quote.quote}
                    <footer className="muted" style={{ marginTop: "0.4rem", fontFamily: "var(--font-sans)" }}>{quote.name}, {quote.city}</footer>
                  </blockquote>
                ))}
              </div>
            )}
            {section.type === "story" && (
              <div className="story">
                <h2>{section.title}</h2>
                <p style={{ marginTop: "0.6rem" }}>{story(section.payload) || section.subtitle}</p>
                <p style={{ marginTop: "0.8rem" }}><Link href={`/s/${slug}/page/about`}>Read about the house</Link></p>
              </div>
            )}
            {section.type === "newsletter" && (
              <form action={subscribeNewsletter} className="stack">
                <h2>{section.title}</h2>
                <p className="muted">{section.subtitle}</p>
                <input type="hidden" name="slug" value={slug} />
                <div className="newsletter">
                  <label className="sr" htmlFor={`mail-${section.id}`}>Email</label>
                  <input id={`mail-${section.id}`} name="email" type="email" required placeholder="Email address" />
                  <button className="btn" type="submit">Join</button>
                </div>
              </form>
            )}
          </section>
        );
      })}
      <RecentlyViewed store={slug} />
      <p className="muted wrap">Prices include GST where the store is configured as tax-inclusive. Shipping is calculated in the cart.</p>
    </div>
  );
}

function pick<T extends { id: string; featured: boolean; createdAt: Date; pricePaise: number; variants: { pricePaise: number | null; stock: number }[] }>(
  products: T[],
  type: string,
  sold: Record<string, number>,
) {
  if (type === "featured") return products.filter((product) => product.featured).slice(0, 4);
  if (type === "best_sellers") {
    return [...products].sort((a, b) => (sold[b.id] ?? 0) - (sold[a.id] ?? 0)).slice(0, 4);
  }
  return [...products].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 4);
}

function quotes(payload: string) {
  try {
    const data = JSON.parse(payload) as { quotes?: { quote: string; name: string; city: string }[] };
    return data.quotes ?? [];
  } catch {
    return [];
  }
}

function sectionExtras(payload: string) {
  try {
    const data = JSON.parse(payload) as { body?: string; imageUrl?: string };
    return { body: data.body ?? "", imageUrl: data.imageUrl ?? "" };
  } catch {
    return { body: "", imageUrl: "" };
  }
}

function story(payload: string) {
  try {
    return (JSON.parse(payload) as { body?: string }).body ?? "";
  } catch {
    return "";
  }
}
