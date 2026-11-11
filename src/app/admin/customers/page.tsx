import Link from "next/link";
import { formatINR } from "@/lib/format";
import { sellerContext } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await sellerContext("customers.read");
  const query = await searchParams;
  const q = query.q?.trim() ?? "";
  const customers = await prisma.customer.findMany({
    where: {
      storeId: ctx.store.id,
      ...(q
        ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] }
        : {}),
    },
    include: { orders: true },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  return (
    <div>
      <h1 style={{ fontSize: "2rem" }}>Customers</h1>
      <form className="row" action="/admin/customers">
        <label className="field" style={{ flex: 1 }}><span>Search</span><input name="q" defaultValue={q} placeholder="Name, phone, email" /></label>
        <button className="btn" type="submit">Search</button>
      </form>
      {customers.map((customer) => {
        const spent = customer.orders.filter((order) => order.status !== "cancelled").reduce((sum, order) => sum + order.totalPaise, 0);
        return (
          <article key={customer.id} className="panel">
            <strong>{customer.name}</strong>
            <p>{customer.email} · {customer.phone}</p>
            <p className="muted">{customer.orders.length} orders · gross order value {formatINR(spent)}</p>
            <p className="muted">Email consent: {customer.consentEmail ? "yes" : "no"}</p>
            {customer.orders[0] && <Link href={`/admin/orders/${customer.orders[0].id}`}>Latest order</Link>}
          </article>
        );
      })}
    </div>
  );
}
