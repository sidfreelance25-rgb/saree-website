import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/shell";
import { filterProducts, matchesRule, type SortKey } from "@/lib/catalog";
import { loadCatalog, loadStore } from "@/lib/load";
import { soldByProduct } from "@/lib/metrics";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({ params }: { params: Promise<{ store: string; slug: string }> }): Promise<Metadata> {
  const { store: storeSlug, slug } = await params;
  const store = await loadStore(storeSlug);
  const collection = await prisma.collection.findUnique({ where: { storeId_slug: { storeId: store.id, slug } } });
  return { title: collection?.seoTitle || collection?.name || "Collection", description: collection?.seoDescription || collection?.description };
}

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string; slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { store: storeSlug, slug } = await params;
  const query = await searchParams;
  const store = await loadStore(storeSlug);
  const collection = await prisma.collection.findUnique({
    where: { storeId_slug: { storeId: store.id, slug } },
    include: { products: true },
  });
  if (!collection) return <div className="wrap"><h1>Collection not found</h1></div>;
  const catalog = await loadCatalog(store.id);
  const manualIds = new Set(collection.products.map((item) => item.productId));
  const scoped = collection.kind === "rule" ? catalog.filter((product) => matchesRule(product, collection.ruleJson)) : catalog.filter((product) => manualIds.has(product.id));
  const sort = (query.sort as SortKey) || "recommended";
  const sold = await soldByProduct(store.id);
  const filtered = filterProducts(scoped, {
    fabric: query.fabric,
    color: query.color,
    weave: query.weave,
    occasion: query.occasion,
    pattern: query.pattern,
    availability: query.availability,
    discount: query.discount === "1",
    sort,
  }, sold);
  const options = (key: "fabric" | "color" | "weave" | "occasion" | "pattern") => [...new Set(scoped.map((product) => product[key]).filter(Boolean))];
  return (
    <div className="wrap">
      <p className="crumbs"><Link href={`/s/${storeSlug}`}>Home</Link> / {collection.name}</p>
      <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.4rem)" }}>{collection.name}</h1>
      <p className="lede">{collection.description}</p>
      <details className="filters">
        <summary>Filter and sort</summary>
        <form className="filter-grid" action={`/s/${storeSlug}/collection/${slug}`}>
          {(["fabric", "color", "weave", "occasion", "pattern"] as const).map((key) => (
            <label className="field" key={key}>
              <span>{key}</span>
              <select name={key} defaultValue={query[key] ?? ""}>
                <option value="">Any</option>
                {options(key).map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
          ))}
          <label className="field"><span>Availability</span>
            <select name="availability" defaultValue={query.availability ?? ""}>
              <option value="">Any</option>
              <option value="in">In stock</option>
              <option value="out">Out of stock</option>
            </select>
          </label>
          <label className="check"><input type="checkbox" name="discount" value="1" defaultChecked={query.discount === "1"} /> On offer</label>
          <label className="field"><span>Sort</span>
            <select name="sort" defaultValue={sort}>
              <option value="recommended">Recommended</option>
              <option value="newest">Newest</option>
              <option value="price_asc">Price, low to high</option>
              <option value="price_desc">Price, high to low</option>
              <option value="best">Best selling</option>
            </select>
          </label>
          <button className="btn" type="submit">Apply</button>
        </form>
      </details>
      {filtered.length === 0 ? (
        <div className="note">
          <p>No sarees match these filters.</p>
          <p><Link href={`/s/${storeSlug}/collection/${slug}`}>Clear filters</Link></p>
        </div>
      ) : (
        <div className="grid">
          {filtered.map((product) => <ProductCard key={product.id} store={storeSlug} product={product} />)}
        </div>
      )}
    </div>
  );
}
