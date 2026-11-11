import Link from "next/link";
import { addToCart } from "@/server/actions";
import { formatINR } from "@/lib/format";
import { SearchBox } from "./widgets";

type StoreLink = { label: string; href: string };
type Theme = {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  ink: string;
  card: string;
  headingFont: string;
};

export function StoreShell({
  store,
  count,
  children,
}: {
  store: {
    slug: string;
    name: string;
    logoText: string;
    description: string;
    phone: string;
    email: string;
    whatsapp: string | null;
    instagramHandle: string | null;
    city: string;
    theme: Theme;
    menuItems: StoreLink[];
  };
  count: number;
  children: React.ReactNode;
}) {
  const theme = store.theme;
  const style = {
    "--bg": theme.background,
    "--ink": theme.ink,
    "--primary": theme.primary,
    "--secondary": theme.secondary,
    "--accent": theme.accent,
    "--card": theme.card,
    "--heading": theme.headingFont === "Outfit" ? "var(--font-sans)" : "var(--font-display)",
    "--line": "rgba(26,20,18,0.14)",
    "--muted": "#5c564e",
  } as React.CSSProperties;
  return (
    <div className="store" style={style}>
      <a className="skip" href="#main">Skip to content</a>
      <header className="header">
        <Link className="logo" href={`/s/${store.slug}`}>{store.logoText}</Link>
        <nav className="nav" aria-label="Shop">
          {store.menuItems.map((item) => (
            <Link key={item.href} href={item.href}>{item.label}</Link>
          ))}
        </nav>
        <div className="header-tools">
          <SearchBox store={store.slug} />
          <Link className="icon-link" href={`/s/${store.slug}/account`}>Account</Link>
          <Link className="icon-link" href={`/s/${store.slug}/cart`} aria-label={`Cart, ${count} items`}>Cart {count}</Link>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="footer">
        <div>
          <strong className="display" style={{ fontSize: "1.6rem" }}>{store.name}</strong>
          <p className="muted">{store.description}</p>
          <p>{store.city}</p>
        </div>
        <div>
          <Link href={`/s/${store.slug}/page/shipping`}>Shipping</Link>
          <Link href={`/s/${store.slug}/page/returns`}>Returns</Link>
          <Link href={`/s/${store.slug}/page/privacy`}>Privacy</Link>
          <Link href={`/s/${store.slug}/page/terms`}>Terms</Link>
          <Link href={`/s/${store.slug}/page/saree-guide`}>Saree guide</Link>
          <Link href={`/s/${store.slug}/instagram`}>Instagram gallery</Link>
        </div>
        <div>
          <a href={`mailto:${store.email}`}>{store.email}</a>
          <a href={`tel:${store.phone}`}>{store.phone}</a>
          {store.whatsapp && <a href={`https://wa.me/${store.whatsapp}`}>WhatsApp</a>}
          {store.instagramHandle && <a href={`https://www.instagram.com/${store.instagramHandle}/`}>@{store.instagramHandle}</a>}
        </div>
      </footer>
    </div>
  );
}

export function ProductCard({
  store,
  product,
}: {
  store: string;
  product: {
    slug: string;
    name: string;
    fabric: string;
    pricePaise: number;
    compareAtPaise: number | null;
    images: { url: string; alt: string }[];
    variants: { id: string; stock: number; pricePaise: number | null }[];
    id: string;
  };
}) {
  const price = Math.min(...product.variants.map((variant) => variant.pricePaise ?? product.pricePaise));
  const stock = product.variants.reduce((sum, variant) => sum + variant.stock, 0);
  const compare = product.compareAtPaise && product.compareAtPaise > price ? product.compareAtPaise : null;
  const off = compare ? Math.round(((compare - price) / compare) * 100) : 0;
  return (
    <article className="card">
      <Link href={`/s/${store}/product/${product.slug}`}>
        {product.images[0] ? <img src={product.images[0].url} alt={product.images[0].alt || product.name} /> : <div className="ph" />}
        <h3>{product.name}</h3>
        <p className="muted">{product.fabric}</p>
        <p className="price">
          {compare && <span className="compare">{formatINR(compare)}</span>}
          {formatINR(price)}
          {off > 0 && <span className="badge"> {off}% off</span>}
        </p>
        {stock <= 0 && <p className="muted">Out of stock</p>}
      </Link>
      {stock > 0 && product.variants.length === 1 && (
        <form action={addToCart}>
          <input type="hidden" name="slug" value={store} />
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="variantId" value={product.variants[0].id} />
          <input type="hidden" name="qty" value="1" />
          <button className="btn ghost" type="submit">Add</button>
        </form>
      )}
    </article>
  );
}
