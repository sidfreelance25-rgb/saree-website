import Link from "next/link";
import { notFound } from "next/navigation";
import { setStoreStatus, startSupport } from "@/server/actions";
import { platformContext } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function PlatformStorePage({ params }: { params: Promise<{ id: string }> }) {
  await platformContext();
  const { id } = await params;
  const store = await prisma.store.findUnique({
    where: { id },
    include: { theme: true, domains: true, subscription: true, memberships: { include: { user: true } } },
  });
  if (!store) notFound();
  return (
    <main className="platform">
      <p className="kicker"><Link href="/platform">Platform</Link></p>
      <h1 style={{ fontSize: "2.4rem" }}>{store.name}</h1>
      <p>Status {store.status}. Plan {store.subscription?.plan}. Theme {store.theme?.preset} primary {store.theme?.primary}.</p>
      <p>Domains: {store.domains.map((domain) => domain.host).join(", ") || "none"}</p>
      <ul>
        {store.memberships.map((member) => <li key={member.id}>{member.user.name} · {member.role}</li>)}
      </ul>
      <form action={startSupport}>
        <input type="hidden" name="id" value={store.id} />
        <button className="btn" type="submit">Open seller admin for 30 minutes</button>
      </form>
      <form action={setStoreStatus} className="form-grid">
        <input type="hidden" name="id" value={store.id} />
        <label className="field"><span>Status</span>
          <select name="status" defaultValue={store.status}>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="field"><span>Support notes</span><textarea name="notes" rows={3} defaultValue={store.supportNotes} /></label>
        <button className="btn ghost" type="submit">Save status</button>
      </form>
      <p><Link href={`/s/${store.slug}`}>View storefront</Link></p>
    </main>
  );
}
