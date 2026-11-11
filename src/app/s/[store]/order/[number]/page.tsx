import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requestReturn } from "@/server/actions";
import { formatINR, formatWhen } from "@/lib/format";
import { loadStore } from "@/lib/load";
import { receiptAllows } from "@/lib/metrics";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export default async function OrderStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string; number: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { store: slug, number } = await params;
  const query = await searchParams;
  const store = await loadStore(slug);
  const order = await prisma.order.findFirst({
    where: { storeId: store.id, number },
    include: { items: true, events: { orderBy: { createdAt: "asc" } }, shipment: true, returns: true },
  });
  if (!order) notFound();
  const session = await readSession();
  const user = session ? await prisma.user.findUnique({ where: { id: session.uid } }) : null;
  const allowed = (await receiptAllows(order.id)) || user?.email === order.email;
  if (!allowed) redirect(`/login?next=/s/${slug}/order/${number}`);
  const address = JSON.parse(order.addressJson) as { line1: string; city: string; pin: string };
  return (
    <div className="wrap" style={{ maxWidth: 720 }}>
      <p className="kicker">{store.name}</p>
      <h1 style={{ fontSize: "2.4rem" }}>Order {order.number}</h1>
      <p>Placed {formatWhen(order.createdAt)}. Status: {order.status.replaceAll("_", " ")}. Payment: {order.paymentStatus.replaceAll("_", " ")}.</p>
      {query.error && <p className="error">That return could not be opened. Check the window and that the saree was delivered.</p>}
      <div className="note">
        {order.items.map((item) => (
          <p key={item.id}>{item.name} · {item.variantName} × {item.qty} · {formatINR(item.unitPricePaise * item.qty)}</p>
        ))}
        <p>Total {formatINR(order.totalPaise)} · {order.paymentMethod === "cod" ? "Cash on delivery" : "Demo UPI"}</p>
        <p>{address.line1}, {address.city} {address.pin}</p>
        {order.shipment && <p>Courier {order.shipment.courier}, tracking {order.shipment.tracking}</p>}
      </div>
      <ol className="timeline">
        {order.events.map((event) => (
          <li key={event.id}><strong>{event.status.replaceAll("_", " ")}</strong> · {event.actorName}<br /><span className="muted">{formatWhen(event.createdAt)} · {event.note}</span></li>
        ))}
      </ol>
      {order.status === "delivered" && user?.email === order.email && (
        <form action={requestReturn} className="stack">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="number" value={number} />
          <label className="field"><span>Request a return</span><textarea name="reason" required rows={3} placeholder="Unworn, blouse piece intact" /></label>
          <button className="btn" type="submit">Send return request</button>
        </form>
      )}
      <p><Link href={`/s/${slug}/account`}>Your account</Link></p>
    </div>
  );
}
