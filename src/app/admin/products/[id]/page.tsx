import { notFound } from "next/navigation";
import { ProductForm } from "@/components/widgets";
import { duplicateProduct } from "@/server/actions";
import { sellerContext } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await sellerContext("products.read");
  const { id } = await params;
  const product = await prisma.product.findFirst({
    where: { id, storeId: ctx.store.id },
    include: { images: { orderBy: { sort: "asc" } }, variants: { orderBy: { sort: "asc" } } },
  });
  if (!product) notFound();
  const canWrite = ctx.role === "owner" || ctx.role === "manager" || ctx.role === "catalogue";
  return (
    <div>
      <h1 style={{ fontSize: "2rem" }}>{product.name}</h1>
      <p className="muted">{product.variants.map((variant) => `${variant.name}: ${variant.stock}`).join(" · ")}</p>
      {canWrite ? (
        <>
          <ProductForm
            defaults={{
              id: product.id,
              name: product.name,
              sku: product.sku,
              slug: product.slug,
              price: String(product.pricePaise / 100),
              compareAt: product.compareAtPaise ? String(product.compareAtPaise / 100) : "",
              cost: product.costPaise ? String(product.costPaise / 100) : "",
              stock: String(product.variants[0]?.stock ?? 0),
              description: product.description,
              status: product.status,
              sareeType: product.sareeType,
              fabric: product.fabric,
              weave: product.weave,
              work: product.work,
              color: product.color,
              pattern: product.pattern,
              occasion: product.occasion,
              lengthCm: product.lengthCm ? String(product.lengthCm) : "",
              blouseDetail: product.blouseDetail,
              origin: product.origin,
              care: product.care,
              dispatch: product.dispatch,
              leadDays: String(product.leadDays),
              seoTitle: product.seoTitle,
              seoDescription: product.seoDescription,
              featured: product.featured,
              blouseIncluded: product.blouseIncluded,
              images: product.images.map((image) => image.url),
              lowStockAt: String(product.lowStockAt),
            }}
          />
          <form action={duplicateProduct}>
            <input type="hidden" name="id" value={product.id} />
            <button className="btn ghost" type="submit">Duplicate as draft</button>
          </form>
          <p><a href={`/s/${ctx.store.slug}/product/${product.slug}`}>Preview on the storefront</a></p>
        </>
      ) : (
        <p>You can view this saree. Editing is limited to catalogue staff.</p>
      )}
    </div>
  );
}
