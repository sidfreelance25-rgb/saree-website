import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const stores = await prisma.store.findMany({
    where: { status: "active" },
    include: { theme: true },
    orderBy: { name: "asc" },
  });
  return (
    <main className="platform">
      <p className="kicker">Taana</p>
      <div className="platform-hero">
        <h1>A counter for each saree house.</h1>
        <p className="lede" style={{ marginTop: "1rem" }}>
          One platform. Separate catalogues, colours, orders, and staff. Customers shop a single house. Sellers run the day from a phone.
        </p>
        <p style={{ marginTop: "1rem" }}>
          <Link className="btn" href="/login">Seller and platform sign in</Link>
        </p>
      </div>
      <h2>Demo houses</h2>
      <p className="muted">These are two independent stores, not one mixed catalogue.</p>
      <div className="store-picks" style={{ marginTop: "0.8rem" }}>
        {stores.map((store) => (
          <Link key={store.id} href={`/s/${store.slug}`} className="pick" style={{ borderTop: `8px solid ${store.theme?.primary ?? "#1a1412"}` }}>
            <p className="kicker">{store.city}</p>
            <h3 className="display" style={{ fontSize: "2rem", margin: "0.2rem 0" }}>{store.name}</h3>
            <p>{store.description}</p>
          </Link>
        ))}
      </div>
      <details className="demo-accounts">
        <summary>Demo accounts</summary>
        <div className="note">
          <p>Password for every demo account: SareeDemo!2026</p>
          <p>Platform admin: platform@taana.test</p>
          <p>Varanasi owner: meera@varanasiweave.test</p>
          <p>Varanasi orders only: ravi@varanasiweave.test</p>
          <p>Kanchipuram owner: lakshmi@kanjeevaram.test</p>
          <p>Customer: ananya@example.com</p>
        </div>
      </details>
    </main>
  );
}
