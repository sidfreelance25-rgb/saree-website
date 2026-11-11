import Link from "next/link";
import { formatINR, formatWhen } from "@/lib/format";
import { sellerContext } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const FILTERS = ["new", "confirmed", "processing", "packed", "shipped", "delivered", "cancelled", "return_requested", "returned"];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; pay?: string }> }) {
  const ctx = await sellerContext("orders.read");
  const query = await searchParams;
  const orders = await prisma.order.findMany({
    where: {
      storeId: ctx.store.id,
      ...(query.status ? { status: query.status } : {}),
      ...(query.pay ? { paymentStatus: query.pay } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { items: true },
    take: 50,
  });
  return (
    <div>
      <h1 style={{ fontSize: "2rem" }}>Orders</h1>
      <div className="rail">
        <Link className="chip" href="/admin/orders">All</Link>
        {FILTERS.map((status) => <Link key={status} className="chip" href={`/admin/orders?status=${status}`}>{status.replaceAll("_", " ")}</Link>)}
      </div>
      {orders.length === 0 && <p className="note">No orders in this view.</p>}
      {orders.map((order) => (
        <Link key={order.id} className="order-card" href={`/admin/orders/${order.id}`}>
          <strong>{order.number}</strong> · {order.status.replaceAll("_", " ")}
          <p>{order.customerName} · {formatINR(order.totalPaise)} · {order.paymentMethod === "cod" ? "COD" : "Demo UPI"}</p>
          <p className="muted">{order.items.map((item) => item.name).join(", ")} · {formatWhen(order.createdAt)}</p>
        </Link>
      ))}
    </div>
  );
}
