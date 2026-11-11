import { adjustStockAction } from "@/server/actions";
import { sellerContext } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const ctx = await sellerContext("inventory.write");
  const query = await searchParams;
  const variants = await prisma.productVariant.findMany({
    where: { storeId: ctx.store.id },
    include: { product: true },
    orderBy: { product: { name: "asc" } },
  });
  const movements = await prisma.inventoryMovement.findMany({
    where: { storeId: ctx.store.id },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  return (
    <div>
      <h1 style={{ fontSize: "2rem" }}>Stock</h1>
      {query.error && <p className="error">{query.error}</p>}
      {variants.map((variant) => (
        <form key={variant.id} action={adjustStockAction} className="panel stack">
          <strong>{variant.product.name}</strong>
          <p className="muted">{variant.name} · {variant.sku} · {variant.stock} on hand</p>
          <input type="hidden" name="variantId" value={variant.id} />
          <label className="field"><span>Change (use a minus to remove)</span><input name="qtyDelta" inputMode="numeric" required placeholder="-1" /></label>
          <label className="field"><span>Reason</span>
            <select name="reason"><option value="count">Count correction</option><option value="damage">Damage</option><option value="received">Received</option></select>
          </label>
          <label className="field"><span>Note</span><input name="note" /></label>
          <button className="btn" type="submit">Update stock</button>
        </form>
      ))}
      <h2>Recent movements</h2>
      {movements.map((movement) => (
        <p key={movement.id}>{movement.qtyDelta > 0 ? "+" : ""}{movement.qtyDelta} · {movement.reason} · {movement.actorName} · {movement.note}</p>
      ))}
    </div>
  );
}
