import Link from "next/link";
import { can, type Permission } from "@/lib/permissions";
import { sellerContext } from "@/lib/session";

const LINKS: { href: string; label: string; permission: Permission | null }[] = [
  { href: "/admin/inventory", label: "Stock", permission: "inventory.write" },
  { href: "/admin/customers", label: "Customers", permission: "customers.read" },
  { href: "/admin/content", label: "Homepage, pages, menu", permission: "content.write" },
  { href: "/admin/instagram", label: "Instagram", permission: "instagram.write" },
  { href: "/admin/discounts", label: "Discounts", permission: "promotions.write" },
  { href: "/admin/reports", label: "Reports", permission: "reports.read" },
  { href: "/admin/notifications", label: "Alerts", permission: null },
  { href: "/admin/team", label: "Team", permission: "team.write" },
  { href: "/admin/settings", label: "Settings", permission: "settings.write" },
];

export default async function MorePage() {
  const ctx = await sellerContext();
  return (
    <div className="stack">
      <h1 style={{ fontSize: "2rem" }}>More</h1>
      {LINKS.filter((link) => !link.permission || can(ctx.role, link.permission)).map((link) => (
        <Link key={link.href} className="order-card" href={link.href}>{link.label}</Link>
      ))}
    </div>
  );
}
