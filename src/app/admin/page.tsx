import Link from "next/link";
import { formatINR } from "@/lib/format";
import { startOfDayIST } from "@/lib/metrics";
import { sellerContext } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const ctx = await sellerContext();
  const query = await searchParams;
  const start = startOfDayIST();
  const orders = await prisma.order.findMany({ where: { storeId: ctx.store.id }, include: { items: true } });
  const today = orders.filter((order) => order.createdAt >= start && order.status !== "cancelled");
  const gross = today.reduce((sum, order) => sum + order.totalPaise, 0);
  const variants = await prisma.productVariant.findMany({
    where: { storeId: ctx.store.id },
    include: { product: true },
  });
  const low = variants.filter((variant) => variant.product.status === "active" && variant.stock <= variant.product.lowStockAt);
  const cards = [
    ["Today's orders", today.length, "/admin/orders"],
    ["New", orders.filter((order) => order.status === "new").length, "/admin/orders?status=new"],
    ["Awaiting payment", orders.filter((order) => order.paymentStatus === "pending").length, "/admin/orders?pay=pending"],
    ["To pack", orders.filter((order) => order.status === "confirmed" || order.status === "processing").length, "/admin/orders?status=confirmed"],
    ["To dispatch", orders.filter((order) => order.status === "packed").length, "/admin/orders?status=packed"],
    ["Delivered", orders.filter((order) => order.status === "delivered").length, "/admin/orders?status=delivered"],
    ["Cancelled", orders.filter((order) => order.status === "cancelled").length, "/admin/orders?status=cancelled"],
    ["Returns", orders.filter((order) => order.status === "return_requested" || order.status === "returned").length, "/admin/orders?status=return_requested"],
  ] as const;
  return (
    <div>
      <h1 style={{ fontSize: "2.2rem" }}>Today</h1>
      {query.error === "permission" && <p className="error">That screen is outside your role.</p>}
      <p className="muted">Gross order value today, excluding cancelled orders: {formatINR(gross)}. This is order value, not collected payment.</p>
      <div className="stats" style={{ marginTop: "0.8rem" }}>
        {cards.map(([label, value, href]) => (
          <Link key={label} className="stat" href={href}><span className="muted">{label}</span><b>{value}</b></Link>
        ))}
      </div>
      <h2 style={{ marginTop: "1.2rem" }}>Low stock</h2>
      {low.length === 0 && <p>No saree is at its alert level.</p>}
      {low.map((variant) => (
        <Link key={variant.id} className="order-card" href={`/admin/products/${variant.productId}`}>
          {variant.product.name} · {variant.name} · {variant.stock} left
        </Link>
      ))}
      <p style={{ marginTop: "1rem" }}><Link className="btn" href={`/s/${ctx.store.slug}`} target="_blank">Open storefront</Link></p>
    </div>
  );
}
