import Link from "next/link";
import { ProductCard } from "@/components/shell";
import { filterProducts } from "@/lib/catalog";
import { loadCatalog, loadStore } from "@/lib/load";

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { store: slug } = await params;
  const query = await searchParams;
  const store = await loadStore(slug);
  const catalog = await loadCatalog(store.id);
  const results = filterProducts(catalog, {
    q: query.q,
    fabric: query.fabric,
    occasion: query.occasion,
    sareeType: query.sareeType,
    color: query.color,
  });
  const title = query.q || query.sareeType || query.fabric || query.occasion || "Search";
  return (
    <div className="wrap">
      <p className="crumbs"><Link href={`/s/${slug}`}>Home</Link> / Search</p>
      <h1 style={{ fontSize: "2.4rem" }}>{title}</h1>
      <p className="muted">{results.length} saree{results.length === 1 ? "" : "s"} at {store.name}</p>
      {results.length === 0 ? (
        <div className="note" style={{ marginTop: "1rem" }}>
          <p>Nothing matched. Try a fabric, a colour, or an occasion.</p>
          <p><Link href={`/s/${slug}`}>Back to the house</Link></p>
        </div>
      ) : (
        <div className="grid" style={{ marginTop: "1rem" }}>
          {results.map((product) => <ProductCard key={product.id} store={slug} product={product} />)}
        </div>
      )}
    </div>
  );
}
