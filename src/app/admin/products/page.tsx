import Link from "next/link";
import { importProducts, setProductStatus } from "@/server/actions";
import { displayPrice, totalStock } from "@/lib/catalog";
import { formatINR } from "@/lib/format";
import { sellerContext } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const ctx = await sellerContext("products.read");
  const query = await searchParams;
  const products = await prisma.product.findMany({
    where: { storeId: ctx.store.id },
    include: { variants: true, images: { take: 1 } },
    orderBy: { updatedAt: "desc" },
  });
  const canWrite = ctx.role === "owner" || ctx.role === "manager" || ctx.role === "catalogue";
  return (
    <div>
      <div className="section-head"><h1 style={{ fontSize: "2rem" }}>Catalogue</h1>{canWrite && <Link className="btn" href="/admin/products/new">Add saree</Link>}</div>
      {query.error && <p className="error">The file could not be read. Use a simple comma-separated sheet.</p>}
      {canWrite && (
        <form action={importProducts} className="panel stack">
          <p>CSV columns: name, sku, price, stock, fabric, saree_type, color, occasion, status. Price is in rupees. Avoid commas inside cells.</p>
          <input type="file" name="file" accept=".csv,text/csv" required />
          <button className="btn" type="submit">Import</button>
          <a href="/api/v1/admin/products/export">Download current catalogue</a>
        </form>
      )}
      {products.map((product) => (
        <article key={product.id} className="order-card">
          <Link href={`/admin/products/${product.id}`}><strong>{product.name}</strong></Link>
          <p className="muted">{product.status} · {product.sku} · {formatINR(displayPrice(product))} · stock {totalStock(product)} · {product.variants.map((variant) => variant.name).join(", ") || "one colour"}</p>
          {canWrite && (
            <form action={setProductStatus}>
              <input type="hidden" name="id" value={product.id} />
              <input type="hidden" name="status" value={product.status === "active" ? "archived" : "active"} />
              <button className="btn ghost" type="submit">{product.status === "active" ? "Archive" : "Activate"}</button>
            </form>
          )}
        </article>
      ))}
    </div>
  );
}
