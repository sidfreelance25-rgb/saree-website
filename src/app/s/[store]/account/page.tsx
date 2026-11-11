import Link from "next/link";
import { SignupForm } from "@/components/widgets";
import { requestDeletion } from "@/server/actions";
import { formatINR, formatWhen } from "@/lib/format";
import { loadStore } from "@/lib/load";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export default async function AccountPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const store = await loadStore(slug);
  const session = await readSession();
  const user = session ? await prisma.user.findUnique({ where: { id: session.uid } }) : null;
  if (!user) {
    return (
      <div className="wrap" style={{ maxWidth: 640 }}>
        <h1 style={{ fontSize: "2.4rem" }}>Account</h1>
        <p><Link href={`/login?next=/s/${slug}/account`}>Sign in</Link> or create an account for {store.name}.</p>
        <SignupForm slug={slug} />
      </div>
    );
  }
  const orders = await prisma.order.findMany({
    where: { storeId: store.id, email: user.email },
    orderBy: { createdAt: "desc" },
  });
  const customer = await prisma.customer.findUnique({
    where: { storeId_email: { storeId: store.id, email: user.email } },
    include: { wishlist: { include: { product: true } } },
  });
  return (
    <div className="wrap">
      <h1 style={{ fontSize: "2.4rem" }}>{user.name}</h1>
      <p className="muted">{user.email}</p>
      {user.deletionRequestedAt && <p className="note">A deletion request is open.</p>}
      <h2>Orders</h2>
      {orders.length === 0 && <p>No orders at this house yet.</p>}
      {orders.map((order) => (
        <Link key={order.id} className="order-card" href={`/s/${slug}/order/${order.number}`}>
          <strong>{order.number}</strong>
          <p>{order.status.replaceAll("_", " ")} · {formatINR(order.totalPaise)}</p>
          <p className="muted">{formatWhen(order.createdAt)}</p>
        </Link>
      ))}
      <h2>Wishlist</h2>
      {(customer?.wishlist ?? []).map((item) => (
        <p key={item.id}><Link href={`/s/${slug}/product/${item.product.slug}`}>{item.product.name}</Link></p>
      ))}
      <form action={requestDeletion}>
        <button className="btn danger" type="submit">Request account deletion</button>
      </form>
    </div>
  );
}
