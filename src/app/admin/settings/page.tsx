import { saveSettings } from "@/server/actions";
import { ATTRIBUTE_FIELDS } from "@/lib/presets";
import { sellerContext } from "@/lib/session";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const ctx = await sellerContext("settings.write");
  const query = await searchParams;
  const visible = new Set(ctx.store.visibleAttributes.split(","));
  return (
    <div>
      <h1 style={{ fontSize: "2rem" }}>Settings</h1>
      {query.saved && <p className="note">Saved. The other store is unchanged.</p>}
      <p className="muted">Subdomain reserved: {ctx.store.slug}.taana.test. This demo serves the store at /s/{ctx.store.slug}.</p>
      <form action={saveSettings} className="form-grid">
        <label className="field"><span>Description</span><textarea name="description" rows={3} defaultValue={ctx.store.description} /></label>
        <div className="two">
          <label className="field"><span>Phone</span><input name="phone" defaultValue={ctx.store.phone} /></label>
          <label className="field"><span>Email</span><input name="email" defaultValue={ctx.store.email} /></label>
          <label className="field"><span>WhatsApp number</span><input name="whatsapp" defaultValue={ctx.store.whatsapp ?? ""} /></label>
          <label className="field"><span>Instagram handle</span><input name="instagramHandle" defaultValue={ctx.store.instagramHandle ?? ""} /></label>
        </div>
        <label className="field"><span>SEO title</span><input name="seoTitle" defaultValue={ctx.store.seoTitle} /></label>
        <label className="field"><span>SEO description</span><input name="seoDescription" defaultValue={ctx.store.seoDescription} /></label>
        <div className="two">
          <label className="field"><span>Flat shipping (₹)</span><input name="shipping" defaultValue={String(ctx.store.shippingFlatPaise / 100)} /></label>
          <label className="field"><span>Free shipping over (₹)</span><input name="freeOver" defaultValue={String(ctx.store.freeShippingOverPaise / 100)} /></label>
          <label className="field"><span>GST percent</span><input name="gst" defaultValue={String(ctx.store.gstRateBps / 100)} /></label>
          <label className="field"><span>Return window (days)</span><input name="returnWindow" defaultValue={String(ctx.store.returnWindowDays)} /></label>
        </div>
        <label className="check"><input type="checkbox" name="taxInclusive" defaultChecked={ctx.store.taxInclusive} /> Prices include GST</label>
        <label className="field"><span>Serviceable PIN prefixes, comma separated</span><input name="pinPrefixes" defaultValue={ctx.store.pinPrefixes} /></label>
        <label className="field"><span>Required attribute keys</span><input name="requiredAttributes" defaultValue={ctx.store.requiredAttributes} /></label>
        <fieldset>
          <legend>Attributes shown on the product page</legend>
          {ATTRIBUTE_FIELDS.map(([key, label]) => (
            <label key={key} className="check"><input type="checkbox" name="visible" value={key} defaultChecked={visible.has(key)} /> {label}</label>
          ))}
        </fieldset>
        <div className="two">
          <label className="field"><span>Primary</span><input name="primary" defaultValue={ctx.store.theme.primary} /></label>
          <label className="field"><span>Secondary</span><input name="secondary" defaultValue={ctx.store.theme.secondary} /></label>
          <label className="field"><span>Accent</span><input name="accent" defaultValue={ctx.store.theme.accent} /></label>
          <label className="field"><span>Background</span><input name="background" defaultValue={ctx.store.theme.background} /></label>
          <label className="field"><span>Heading font</span>
            <select name="headingFont" defaultValue={ctx.store.theme.headingFont}>
              <option>Fraunces</option>
              <option>Outfit</option>
            </select>
          </label>
        </div>
        <button className="btn" type="submit">Save settings</button>
      </form>
    </div>
  );
}
