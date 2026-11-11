import { formatINR } from "@/lib/format";
import { sellerContext } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const ctx = await sellerContext("reports.read");
  const query = await searchParams;
  const from = query.from ? new Date(query.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = query.to ? new Date(query.to) : new Date();
  const orders = await prisma.order.findMany({
    where: { storeId: ctx.store.id, createdAt: { gte: from, lte: to } },
    include: { items: true },
  });
  const live = orders.filter((order) => order.status !== "cancelled");
  const gross = live.reduce((sum, order) => sum + order.totalPaise, 0);
  const collected = orders.filter((order) => order.paymentStatus === "paid").reduce((sum, order) => sum + order.totalPaise, 0);
  const aov = live.length ? Math.round(gross / live.length) : 0;
  const byProduct = new Map<string, { name: string; qty: number; value: number }>();
  for (const order of live) {
    for (const item of order.items) {
      const row = byProduct.get(item.productId) ?? { name: item.name, qty: 0, value: 0 };
      row.qty += item.qty;
      row.value += item.unitPricePaise * item.qty;
      byProduct.set(item.productId, row);
    }
  }
  const ranked = [...byProduct.values()].sort((a, b) => b.qty - a.qty);
  return (
    <div>
      <h1 style={{ fontSize: "2rem" }}>Reports</h1>
      <p className="muted">Gross order value is the sum of non-cancelled order totals. Collected payment is only orders marked paid. They are not the same number.</p>
      <form className="two">
        <label className="field"><span>From</span><input type="date" name="from" defaultValue={query.from} /></label>
        <label className="field"><span>To</span><input type="date" name="to" defaultValue={query.to} /></label>
        <button className="btn" type="submit">Update</button>
      </form>
      <div className="stats">
        <div className="stat"><span className="muted">Orders</span><b>{live.length}</b></div>
        <div className="stat"><span className="muted">Gross order value</span><b>{formatINR(gross)}</b></div>
        <div className="stat"><span className="muted">Collected</span><b>{formatINR(collected)}</b></div>
        <div className="stat"><span className="muted">Average order value</span><b>{formatINR(aov)}</b></div>
      </div>
      <h2>By product</h2>
      {ranked.map((row) => <p key={row.name}>{row.name} · {row.qty} pieces · merchandise {formatINR(row.value)}</p>)}
      <p><a href={`/api/v1/admin/reports.csv?from=${from.toISOString()}&to=${to.toISOString()}`}>Download CSV</a></p>
    </div>
  );
}
