"use client";

import { useActionState, useEffect, useState } from "react";
import { login, placeOrderAction, savePage, saveProduct, signup } from "@/server/actions";
import { formatINR } from "@/lib/format";

export function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);
  return null;
}

export function SearchBox({ store, initial = "" }: { store: string; initial?: string }) {
  const [q, setQ] = useState(initial);
  const [hits, setHits] = useState<{ slug: string; name: string; price: string }[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const handle = setTimeout(() => {
      fetch(`/api/v1/storefront/suggest?store=${store}&q=${encodeURIComponent(q)}`)
        .then((response) => response.json())
        .then((data) => setHits(data.hits ?? []))
        .catch(() => setHits([]));
    }, 180);
    return () => clearTimeout(handle);
  }, [q, store]);
  return (
    <form action={`/s/${store}/search`} className="search" role="search">
      <label className="sr" htmlFor="q">Search sarees</label>
      <input id="q" name="q" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search fabric, colour, occasion" autoComplete="off" />
      {hits.length > 0 && (
        <ul className="suggest">
          {hits.map((hit) => (
            <li key={hit.slug}>
              <a href={`/s/${store}/product/${hit.slug}`}>{hit.name} · {hit.price}</a>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

export function Gallery({ images }: { images: { url: string; alt: string }[] }) {
  const [index, setIndex] = useState(0);
  const current = images[index] ?? images[0];
  if (!current) return <div className="ph" />;
  return (
    <div>
      <img className="gallery-main" src={current.url} alt={current.alt} />
      {images.length > 1 && (
        <div className="thumbs">
          {images.map((image, imageIndex) => (
            <button key={image.url} type="button" onClick={() => setIndex(imageIndex)} aria-label={`Image ${imageIndex + 1}`}>
              <img src={image.url} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function RememberProduct({ store, id }: { store: string; id: string }) {
  useEffect(() => {
    const key = `recent:${store}`;
    const prev = JSON.parse(localStorage.getItem(key) || "[]") as string[];
    const next = [id, ...prev.filter((item) => item !== id)].slice(0, 8);
    localStorage.setItem(key, JSON.stringify(next));
  }, [store, id]);
  return null;
}

export function RecentlyViewed({ store }: { store: string }) {
  const [items, setItems] = useState<{ slug: string; name: string; image: string; price: string }[]>([]);
  useEffect(() => {
    const ids = JSON.parse(localStorage.getItem(`recent:${store}`) || "[]") as string[];
    if (!ids.length) return;
    fetch(`/api/v1/storefront/products?store=${store}&ids=${ids.join(",")}`)
      .then((response) => response.json())
      .then((data) => setItems(data.products ?? []))
      .catch(() => undefined);
  }, [store]);
  if (!items.length) return null;
  return (
    <section className="section">
      <div className="section-head"><h2>Recently viewed</h2></div>
      <div className="rail">
        {items.map((item) => (
          <a key={item.slug} className="card" href={`/s/${store}/product/${item.slug}`} style={{ width: 140 }}>
            <img src={item.image} alt="" />
            <h3>{item.name}</h3>
            <div className="price">{item.price}</div>
          </a>
        ))}
      </div>
    </section>
  );
}

export function CheckoutForm({
  slug,
  coupon,
  defaults,
}: {
  slug: string;
  coupon: string;
  defaults: { name: string; email: string; phone: string };
}) {
  const [state, action, pending] = useActionState(placeOrderAction, { error: "" });
  const [key] = useState(() => (typeof crypto !== "undefined" ? crypto.randomUUID() : `key-${Date.now()}`));
  return (
    <form action={action} className="stack">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="idempotencyKey" value={key} />
      <input type="hidden" name="couponCode" value={coupon} />
      <label className="field"><span>Name</span><input name="name" required defaultValue={defaults.name} autoComplete="name" /></label>
      <label className="field"><span>Mobile</span><input name="phone" required inputMode="numeric" autoComplete="tel" defaultValue={defaults.phone} placeholder="98xxxxxxxx" /></label>
      <label className="field"><span>Email</span><input name="email" type="email" required autoComplete="email" defaultValue={defaults.email} /></label>
      <label className="field"><span>Address</span><input name="line1" required autoComplete="address-line1" /></label>
      <label className="field"><span>Area</span><input name="line2" autoComplete="address-line2" /></label>
      <div className="two">
        <label className="field"><span>City</span><input name="city" required /></label>
        <label className="field"><span>State</span><input name="state" required /></label>
      </div>
      <label className="field"><span>PIN code</span><input name="pin" required inputMode="numeric" pattern="[0-9]{6}" /></label>
      <label className="field"><span>Note for the seller</span><textarea name="customerNote" rows={3} /></label>
      <div className="pay-options">
        <label><input type="radio" name="paymentMethod" value="cod" defaultChecked /> Cash on delivery</label>
        <label><input type="radio" name="paymentMethod" value="demo_upi" /> Demo UPI desk</label>
      </div>
      <p className="muted">The demo desk records a payment without taking a card or UPI PIN. Cash on delivery is confirmed by the seller.</p>
      <label className="check"><input type="checkbox" name="marketingConsent" /> Email me when a new lot is ready</label>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <button className="btn block" disabled={pending}>{pending ? "Placing the order…" : "Place order"}</button>
    </form>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, { error: "" });
  return (
    <form action={action} className="stack">
      <input type="hidden" name="next" value={next} />
      <label className="field"><span>Email</span><input name="email" type="email" required autoComplete="username" /></label>
      <label className="field"><span>Password</span><input name="password" type="password" required autoComplete="current-password" /></label>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

export function SignupForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(signup, { error: "" });
  return (
    <form action={action} className="stack">
      <input type="hidden" name="slug" value={slug} />
      <label className="field"><span>Name</span><input name="name" required /></label>
      <label className="field"><span>Email</span><input name="email" type="email" required /></label>
      <label className="field"><span>Mobile</span><input name="phone" inputMode="numeric" /></label>
      <label className="field"><span>Password</span><input name="password" type="password" required minLength={8} /></label>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <button className="btn" disabled={pending}>Create account</button>
    </form>
  );
}

type ProductDefaults = {
  id?: string;
  name?: string;
  sku?: string;
  slug?: string;
  price?: string;
  compareAt?: string;
  cost?: string;
  stock?: string;
  description?: string;
  status?: string;
  sareeType?: string;
  fabric?: string;
  weave?: string;
  work?: string;
  color?: string;
  pattern?: string;
  occasion?: string;
  lengthCm?: string;
  blouseDetail?: string;
  origin?: string;
  care?: string;
  dispatch?: string;
  leadDays?: string;
  seoTitle?: string;
  seoDescription?: string;
  featured?: boolean;
  blouseIncluded?: boolean;
  images?: string[];
  lowStockAt?: string;
};

export function ProductForm({ defaults }: { defaults: ProductDefaults }) {
  const [state, action, pending] = useActionState(saveProduct, { error: "" });
  const [images, setImages] = useState<string[]>(defaults.images ?? []);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    setUploadError("");
    for (const file of Array.from(list)) {
      try {
        const blob = await compress(file);
        const body = new FormData();
        body.set("file", new File([blob], "saree.jpg", { type: "image/jpeg" }));
        const url = await upload(body, setProgress);
        setImages((current) => [...current, url]);
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : "Upload failed");
      }
    }
    setProgress(0);
  }

  return (
    <form action={action} className="form-grid">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      <input type="hidden" name="images" value={images.join("\n")} />
      <label className="field"><span>Saree name</span><input name="name" required defaultValue={defaults.name} /></label>
      <div className="two">
        <label className="field"><span>SKU</span><input name="sku" required defaultValue={defaults.sku} /></label>
        <label className="field"><span>URL slug</span><input name="slug" defaultValue={defaults.slug} placeholder="optional" /></label>
      </div>
      <div className="two">
        <label className="field"><span>Price (₹)</span><input name="price" inputMode="decimal" required defaultValue={defaults.price} /></label>
        <label className="field"><span>Compare-at (₹)</span><input name="compareAt" inputMode="decimal" defaultValue={defaults.compareAt} /></label>
      </div>
      <div className="two">
        <label className="field"><span>Cost price (₹, private)</span><input name="cost" inputMode="decimal" defaultValue={defaults.cost} /></label>
        <label className="field"><span>Stock</span><input name="stock" inputMode="numeric" defaultValue={defaults.stock ?? "0"} /></label>
      </div>
      <label className="field"><span>Description</span><textarea name="description" rows={4} defaultValue={defaults.description} /></label>
      <div className="two">
        <label className="field"><span>Saree type</span><input name="sareeType" defaultValue={defaults.sareeType} /></label>
        <label className="field"><span>Fabric</span><input name="fabric" defaultValue={defaults.fabric} /></label>
        <label className="field"><span>Weave</span><input name="weave" defaultValue={defaults.weave} /></label>
        <label className="field"><span>Work</span><input name="work" defaultValue={defaults.work} /></label>
        <label className="field"><span>Colour</span><input name="color" defaultValue={defaults.color} /></label>
        <label className="field"><span>Pattern</span><input name="pattern" defaultValue={defaults.pattern} /></label>
        <label className="field"><span>Occasion</span><input name="occasion" defaultValue={defaults.occasion} /></label>
        <label className="field"><span>Length (cm)</span><input name="lengthCm" inputMode="numeric" defaultValue={defaults.lengthCm} /></label>
        <label className="field"><span>Origin</span><input name="origin" defaultValue={defaults.origin} /></label>
        <label className="field"><span>Dispatch</span>
          <select name="dispatch" defaultValue={defaults.dispatch ?? "ready"}>
            <option value="ready">Ready to ship</option>
            <option value="made_to_order">Made to order</option>
          </select>
        </label>
        <label className="field"><span>Lead time (days)</span><input name="leadDays" inputMode="numeric" defaultValue={defaults.leadDays} /></label>
        <label className="field"><span>Low-stock alert at</span><input name="lowStockAt" inputMode="numeric" defaultValue={defaults.lowStockAt ?? "2"} /></label>
      </div>
      <label className="field"><span>Blouse piece</span><input name="blouseDetail" defaultValue={defaults.blouseDetail} /></label>
      <label className="check"><input type="checkbox" name="blouseIncluded" defaultChecked={defaults.blouseIncluded ?? true} /> Blouse piece included</label>
      <label className="field"><span>Care</span><input name="care" defaultValue={defaults.care} /></label>
      <label className="field"><span>Status</span>
        <select name="status" defaultValue={defaults.status ?? "draft"}>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
      </label>
      <label className="check"><input type="checkbox" name="featured" defaultChecked={defaults.featured} /> Featured</label>
      <div className="two">
        <label className="field"><span>SEO title</span><input name="seoTitle" defaultValue={defaults.seoTitle} /></label>
        <label className="field"><span>SEO description</span><input name="seoDescription" defaultValue={defaults.seoDescription} /></label>
      </div>
      <div className="two">
        <label className="field"><span>Another colour</span><input name="extraVariant" placeholder="Rani" /></label>
        <label className="field"><span>Its stock</span><input name="extraStock" inputMode="numeric" /></label>
        <label className="field"><span>Its price (₹, optional)</span><input name="extraPrice" inputMode="decimal" /></label>
      </div>
      <label className="field">
        <span>Photos from camera or gallery</span>
        <input type="file" accept="image/*" capture="environment" multiple onChange={(event) => onFiles(event.target.files)} />
      </label>
      {progress > 0 && <div className="progress" aria-label="Upload progress"><span style={{ width: `${progress}%` }} /></div>}
      {uploadError && <p className="error">{uploadError}</p>}
      <div className="rail">
        {images.map((url) => <img key={url} src={url} alt="" style={{ width: 88, height: 112, objectFit: "cover" }} />)}
      </div>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <button className="btn block" disabled={pending}>{pending ? "Saving…" : "Save saree"}</button>
    </form>
  );
}

async function compress(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare the photo");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) throw new Error("Could not compress the photo");
  return blob;
}

function upload(body: FormData, onProgress: (value: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/v1/admin/media");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        const data = JSON.parse(request.responseText) as { url?: string };
        if (data.url) resolve(data.url);
        else reject(new Error("Upload did not return a file"));
      } else reject(new Error("Upload was rejected"));
    };
    request.onerror = () => reject(new Error("Upload failed on this network"));
    request.send(body);
  });
}

export function PageForm() {
  const [state, action, pending] = useActionState(savePage, { error: "" });
  return (
    <form action={action} className="form-grid">
      <label className="field"><span>Title</span><input name="title" required /></label>
      <label className="field"><span>Slug</span><input name="slug" placeholder="optional" /></label>
      <label className="field"><span>Body</span><textarea name="body" rows={6} required /></label>
      <label className="field"><span>SEO title</span><input name="seoTitle" /></label>
      <label className="field"><span>SEO description</span><input name="seoDescription" /></label>
      <label className="check"><input type="checkbox" name="published" defaultChecked /> Publish</label>
      {state?.error && <p className="error">{state.error}</p>}
      <button className="btn" disabled={pending}>Save page</button>
    </form>
  );
}

export function Money({ paise }: { paise: number }) {
  return <>{formatINR(paise)}</>;
}
