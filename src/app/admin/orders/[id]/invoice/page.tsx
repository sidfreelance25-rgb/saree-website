import Link from "next/link";
import { notFound } from "next/navigation";
import { formatINR, formatWhen } from "@/lib/format";
import { sellerContext } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await sellerContext("orders.read");
  const { id } = await params;
  const order = await prisma.order.findFirst({ where: { id, storeId: ctx.store.id }, include: { items: true } });
  if (!order) notFound();
  const address = JSON.parse(order.addressJson) as { name: string; line1: string; city: string; state: string; pin: string };
  return (
    <article className="invoice">
      <p className="no-print"><Link href={`/admin/orders/${order.id}`}>Back to the order</Link>. Use the browser print dialog for a paper copy.</p>
      <h1 style={{ fontSize: "2rem" }}>{ctx.store.legalName}</h1>
      <p>{ctx.store.addressLine}, {ctx.store.city} {ctx.store.pin}</p>
      {ctx.store.gstin && <p>GSTIN {ctx.store.gstin}</p>}
      <h2>Tax invoice {order.number}</h2>
      <p>{formatWhen(order.createdAt)}</p>
      <p>Bill to {address.name}, {address.line1}, {address.city}, {address.state} {address.pin}</p>
      <table className="specs">
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id}><td>{item.name} × {item.qty}</td><td>{formatINR(item.unitPricePaise * item.qty)}</td></tr>
          ))}
          <tr><td>GST {ctx.store.taxInclusive ? "included in merchandise" : ""}</td><td>{formatINR(order.taxPaise)}</td></tr>
          <tr><td>Shipping</td><td>{formatINR(order.shippingPaise)}</td></tr>
          <tr><td>Invoice total</td><td>{formatINR(order.totalPaise)}</td></tr>
        </tbody>
      </table>
      <p className="muted">Invoice total is the amount billed. Payment status: {order.paymentStatus.replaceAll("_", " ")}.</p>
    </article>
  );
}
