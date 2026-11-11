import Link from "next/link";
import { formatINR } from "@/lib/format";
import { platformContext } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function PlatformHome() {
  const { user } = await platformContext();
  const stores = await prisma.store.findMany({ include: { theme: true, subscription: true }, orderBy: { createdAt: "desc" } });
  const orders = await prisma.order.findMany();
  const gross = orders.filter((order) => order.status !== "cancelled").reduce((sum, order) => sum + order.totalPaise, 0);
  const failed = orders.filter((order) => order.paymentStatus === "failed").length;
  return (
    <main className="platform">
      <p className="kicker">Platform</p>
      <h1 style={{ fontSize: "2.6rem" }}>Houses on Taana</h1>
      <p>{user.name}. {stores.filter((store) => store.status === "active").length} active of {stores.length} stores. Gross order value across stores {formatINR(gross)}. Failed payments {failed}.</p>
      <p><Link className="btn" href="/platform/stores/new">Create a store</Link></p>
      <div className="store-picks" style={{ marginTop: "1rem" }}>
        {stores.map((store) => (
          <Link key={store.id} href={`/platform/stores/${store.id}`} className="pick" style={{ borderTop: `8px solid ${store.theme?.primary ?? "#111"}` }}>
            <strong>{store.name}</strong>
            <p className="muted">{store.status} · {store.subscription?.plan} · /s/{store.slug}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
