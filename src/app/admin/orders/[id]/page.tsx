import Link from "next/link";
import { notFound } from "next/navigation";
import { decideReturn, moveOrder, saveOrderNote } from "@/server/actions";
import { formatINR, formatWhen } from "@/lib/format";
import { sellerContext } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function OrderDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const ctx = await sellerContext("orders.read");
  const { id } = await params;
  const query = await searchParams;
  const order = await prisma.order.findFirst({
    where: { id, storeId: ctx.store.id },
    include: {
      items: true,
      events: { orderBy: { createdAt: "asc" } },
      shipment: true,
      payments: true,
      refunds: true,
      returns: true,
    },
  });
  if (!order) notFound();
  const address = JSON.parse(order.addressJson) as { name: string; phone: string; line1: string; line2: string; city: string; state: string; pin: string };
  const canWrite = ctx.role === "owner" || ctx.role === "manager" || ctx.role === "orders";
  return (
    <div>
      <p className="kicker"><Link href="/admin/orders">Orders</Link></p>
      <h1 style={{ fontSize: "2rem" }}>{order.number}</h1>
      <p>{formatWhen(order.createdAt)} · {order.status.replaceAll("_", " ")} · payment {order.paymentStatus.replaceAll("_", " ")}</p>
      {query.error && <p className="error" role="alert">{query.error}</p>}
      <div className="panel">
        <strong>{order.customerName}</strong>
        <p>{order.phone}</p>
        <p>{order.email}</p>
        <p>{address.line1}{address.line2 ? `, ${address.line2}` : ""}</p>
        <p>{address.city}, {address.state} {address.pin}</p>
      </div>
      <div className="panel">
        {order.items.map((item) => (
          <p key={item.id}>{item.name} · {item.variantName} · {item.sku} × {item.qty} · {formatINR(item.unitPricePaise)}</p>
        ))}
        <div className="summary">
          <div><span>Merchandise</span><span>{formatINR(order.subtotalPaise)}</span></div>
          <div><span>Discount</span><span>{formatINR(order.discountPaise)}</span></div>
          <div><span>Shipping</span><span>{formatINR(order.shippingPaise)}</span></div>
          <div><span>GST {ctx.store.taxInclusive ? "(included)" : ""}</span><span>{formatINR(order.taxPaise)}</span></div>
          <div><strong>Order total</strong><strong>{formatINR(order.totalPaise)}</strong></div>
        </div>
        <p className="muted">Order total is the amount due. It is not labelled as collected cash unless payment is paid.</p>
        {order.customerNote && <p>Customer note: {order.customerNote}</p>}
        {order.internalNote && <p>Internal: {order.internalNote}</p>}
        {order.shipment && <p>Shipped with {order.shipment.courier}, {order.shipment.tracking}</p>}
      </div>
      <ol className="timeline">
        {order.events.map((event) => (
          <li key={event.id}>
            <strong>{event.status.replaceAll("_", " ")}</strong> · {event.actorName}
            <div className="muted">{formatWhen(event.createdAt)} · {event.note}</div>
          </li>
        ))}
      </ol>
      {canWrite && (
        <div className="sticky-actions">
          {order.status === "new" && (
            <form action={moveOrder}><input type="hidden" name="id" value={order.id} /><input type="hidden" name="to" value="confirmed" /><button className="btn block">Confirm order</button></form>
          )}
          {(order.status === "confirmed" || order.status === "processing") && (
            <form action={moveOrder}><input type="hidden" name="id" value={order.id} /><input type="hidden" name="to" value="packed" /><button className="btn block">Mark packed</button></form>
          )}
          {order.status === "packed" && (
            <form action={moveOrder} className="stack">
              <input type="hidden" name="id" value={order.id} />
              <input type="hidden" name="to" value="shipped" />
              <label className="field"><span>Courier</span><input name="courier" required placeholder="India Post" /></label>
              <label className="field"><span>Tracking number</span><input name="tracking" required /></label>
              <label className="field"><span>Tracking link</span><input name="trackingUrl" placeholder="https://" /></label>
              <button className="btn block">Mark shipped</button>
            </form>
          )}
          {order.status === "shipped" && (
            <form action={moveOrder}><input type="hidden" name="id" value={order.id} /><input type="hidden" name="to" value="delivered" /><button className="btn block">Mark delivered</button></form>
          )}
          {["new", "confirmed", "processing", "packed"].includes(order.status) && (
            <form action={moveOrder} className="stack">
              <input type="hidden" name="id" value={order.id} />
              <input type="hidden" name="to" value="cancelled" />
              <label className="field"><span>Cancellation reason</span><input name="note" required /></label>
              <button className="btn danger" type="submit">Cancel order</button>
            </form>
          )}
        </div>
      )}
      {order.returns.map((request) => (
        <div key={request.id} className="panel">
          <p>Return {request.status}: {request.reason}</p>
          {canWrite && request.status === "requested" && (
            <div className="row">
              <form action={decideReturn}>
                <input type="hidden" name="returnId" value={request.id} />
                <input type="hidden" name="decision" value="approve" />
                <button className="btn" type="submit">Approve return</button>
              </form>
              <form action={decideReturn}>
                <input type="hidden" name="returnId" value={request.id} />
                <input type="hidden" name="decision" value="reject" />
                <input type="hidden" name="note" value="Return declined" />
                <button className="btn ghost" type="submit">Decline</button>
              </form>
            </div>
          )}
        </div>
      ))}
      {canWrite && (
        <form action={saveOrderNote} className="stack">
          <input type="hidden" name="id" value={order.id} />
          <label className="field"><span>Internal note</span><textarea name="note" rows={2} defaultValue={order.internalNote} /></label>
          <input type="hidden" name="internal" value="on" />
          <button className="btn ghost" type="submit">Save note</button>
        </form>
      )}
      <p className="row">
        <Link className="btn ghost" href={`/admin/orders/${order.id}/invoice`}>Invoice</Link>
        <a className="btn ghost" href={`/api/v1/admin/orders/${order.id}/invoice`}>Download PDF</a>
      </p>
    </div>
  );
}
