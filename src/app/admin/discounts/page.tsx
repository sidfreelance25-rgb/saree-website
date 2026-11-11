import { saveCoupon } from "@/server/actions";
import { sellerContext } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function DiscountsPage() {
  const ctx = await sellerContext("promotions.write");
  const coupons = await prisma.coupon.findMany({ where: { storeId: ctx.store.id }, orderBy: { code: "asc" } });
  return (
    <div>
      <h1 style={{ fontSize: "2rem" }}>Discounts</h1>
      <p className="muted">Coupons do not stack. The checkout applies one code.</p>
      {coupons.map((coupon) => (
        <p key={coupon.id} className="panel">{coupon.code} · {coupon.type} · {coupon.value} · used {coupon.usedCount}{coupon.usageLimit ? ` / ${coupon.usageLimit}` : ""} · {coupon.active ? "active" : "off"}</p>
      ))}
      <form action={saveCoupon} className="form-grid">
        <label className="field"><span>Code</span><input name="code" required /></label>
        <label className="field"><span>Type</span>
          <select name="type"><option value="percent">Percent</option><option value="fixed">Fixed amount in rupees</option><option value="free_shipping">Free shipping</option></select>
        </label>
        <label className="field"><span>Value</span><input name="value" defaultValue="10" /></label>
        <label className="field"><span>Minimum merchandise (₹)</span><input name="min" defaultValue="0" /></label>
        <label className="check"><input type="checkbox" name="firstOrderOnly" /> First order only</label>
        <button className="btn" type="submit">Save coupon</button>
      </form>
    </div>
  );
}
