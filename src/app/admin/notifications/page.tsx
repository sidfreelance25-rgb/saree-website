import Link from "next/link";
import { markNotificationsRead, sendTestNotification } from "@/server/actions";
import { formatWhen } from "@/lib/format";
import { sellerContext } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function NotificationsPage() {
  const ctx = await sellerContext();
  const notes = await prisma.notification.findMany({
    where: { storeId: ctx.store.id, audience: "seller" },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  return (
    <div>
      <h1 style={{ fontSize: "2rem" }}>Alerts</h1>
      <p className="muted">New orders land here and in the email log. Browser push is optional and is not the only channel.</p>
      <div className="row">
        <form action={markNotificationsRead}><button className="btn ghost" type="submit">Mark read</button></form>
        <form action={sendTestNotification}><button className="btn" type="submit">Send a test alert</button></form>
      </div>
      {notes.map((note) => (
        <Link key={note.id} className="order-card" href={note.href || "/admin/notifications"}>
          <strong>{note.title}</strong>
          <p>{note.body}</p>
          <p className="muted">{formatWhen(note.createdAt)} · {note.read ? "read" : "unread"}</p>
        </Link>
      ))}
    </div>
  );
}
