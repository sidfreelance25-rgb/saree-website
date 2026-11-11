import Link from "next/link";
import { endSupport, logout } from "@/server/actions";
import { can, type Permission } from "@/lib/permissions";
import { sellerContext } from "@/lib/session";

const LINKS: { href: string; label: string; permission: Permission | null }[] = [
  { href: "/admin", label: "Today", permission: null },
  { href: "/admin/orders", label: "Orders", permission: "orders.read" },
  { href: "/admin/products", label: "Products", permission: "products.read" },
  { href: "/admin/inventory", label: "Stock", permission: "inventory.write" },
  { href: "/admin/customers", label: "Customers", permission: "customers.read" },
  { href: "/admin/content", label: "Content", permission: "content.write" },
  { href: "/admin/instagram", label: "Instagram", permission: "instagram.write" },
  { href: "/admin/discounts", label: "Discounts", permission: "promotions.write" },
  { href: "/admin/reports", label: "Reports", permission: "reports.read" },
  { href: "/admin/notifications", label: "Alerts", permission: null },
  { href: "/admin/team", label: "Team", permission: "team.write" },
  { href: "/admin/settings", label: "Settings", permission: "settings.write" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await sellerContext();
  const visible = LINKS.filter((link) => !link.permission || can(ctx.role, link.permission));
  const bottom = [
    visible.find((link) => link.href === "/admin"),
    visible.find((link) => link.href === "/admin/orders"),
    visible.find((link) => link.href === "/admin/products"),
    { href: "/admin/more", label: "More" },
  ].filter(Boolean) as { href: string; label: string }[];
  return (
    <div className="admin">
      {ctx.support && (
        <div className="support-banner">
          <span>Support access for {ctx.store.name}. It expires automatically.</span>
          <form action={endSupport}><button className="btn ghost" type="submit">End</button></form>
        </div>
      )}
      <nav className="side-nav" aria-label="Seller">
        {visible.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
        <form action={logout}><button className="btn ghost" type="submit">Sign out</button></form>
      </nav>
      <div>
        <header className="admin-top">
          <div>
            <span className="brand-mark" style={{ background: ctx.store.theme.primary }} />
            <strong>{ctx.store.name}</strong>
          </div>
          <Link href="/admin/notifications" aria-label={`${ctx.unread} unread alerts`}>Alerts {ctx.unread}</Link>
        </header>
        <div className="admin-main">{children}</div>
      </div>
      <nav className="bottom-nav" aria-label="Seller mobile" style={{ gridTemplateColumns: `repeat(${bottom.length}, minmax(0, 1fr))` }}>
        {bottom.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
      </nav>
    </div>
  );
}
