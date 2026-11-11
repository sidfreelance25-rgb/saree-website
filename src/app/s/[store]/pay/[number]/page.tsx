import { notFound, redirect } from "next/navigation";
import { simulatePayment } from "@/server/actions";
import { formatINR } from "@/lib/format";
import { loadStore } from "@/lib/load";
import { receiptAllows } from "@/lib/metrics";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export default async function PayPage({ params }: { params: Promise<{ store: string; number: string }> }) {
  const { store: slug, number } = await params;
  const store = await loadStore(slug);
  const order = await prisma.order.findFirst({ where: { storeId: store.id, number } });
  if (!order) notFound();
  const session = await readSession();
  const user = session ? await prisma.user.findUnique({ where: { id: session.uid } }) : null;
  const allowed = (await receiptAllows(order.id)) || user?.email === order.email;
  if (!allowed) redirect(`/login?next=/s/${slug}/pay/${number}`);
  if (order.paymentStatus === "paid") redirect(`/s/${slug}/order/${number}`);
  return (
    <div className="wrap" style={{ maxWidth: 640 }}>
      <p className="kicker">Demo payment desk</p>
      <h1 style={{ fontSize: "2.4rem" }}>{order.number}</h1>
      <p>Pay {formatINR(order.totalPaise)} to {store.name}. This stand-in does not collect a card, UPI PIN, or netbanking password. A real gateway would replace this page and call the same signed webhook.</p>
      <form action={simulatePayment} className="stack">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="number" value={number} />
        <button className="btn" name="outcome" value="succeeded" type="submit">Record a successful payment</button>
        <button className="btn danger" name="outcome" value="failed" type="submit">Record a failed payment</button>
      </form>
    </div>
  );
}
