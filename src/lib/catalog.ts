export type SortKey = "recommended" | "newest" | "price_asc" | "price_desc" | "best";

export type CatalogFilters = {
  q?: string;
  fabric?: string;
  color?: string;
  weave?: string;
  occasion?: string;
  pattern?: string;
  sareeType?: string;
  availability?: string;
  discount?: boolean;
  minPaise?: number;
  maxPaise?: number;
  sort?: SortKey;
};

type VariantLike = { pricePaise: number | null; stock: number; color?: string };
type ProductLike = {
  id: string;
  name: string;
  sku: string;
  fabric: string;
  color: string;
  occasion: string;
  sareeType: string;
  pattern: string;
  weave: string;
  work: string;
  pricePaise: number;
  compareAtPaise: number | null;
  featured: boolean;
  createdAt: Date;
  variants: VariantLike[];
};

export function unitPrice(product: { pricePaise: number }, variant: { pricePaise: number | null }) {
  return variant.pricePaise ?? product.pricePaise;
}

export function displayPrice(product: { pricePaise: number; variants?: VariantLike[] }) {
  const prices = (product.variants ?? []).map((variant) => variant.pricePaise ?? product.pricePaise);
  if (prices.length === 0) return product.pricePaise;
  return Math.min(...prices);
}

export function totalStock(product: { variants?: { stock: number }[] }) {
  return (product.variants ?? []).reduce((sum, variant) => sum + variant.stock, 0);
}

export function filterProducts<T extends ProductLike>(
  products: T[],
  filters: CatalogFilters,
  sold: Record<string, number> = {},
) {
  const q = filters.q?.trim().toLowerCase() ?? "";
  const filtered = products.filter((product) => {
    if (q) {
      const hay = [
        product.name,
        product.sku,
        product.fabric,
        product.color,
        product.occasion,
        product.sareeType,
        product.pattern,
        product.weave,
        product.work,
        ...product.variants.map((variant) => variant.color ?? ""),
      ]
        .join(" ")
        .toLowerCase();
      const ok = q.split(/\s+/).every((part) => hay.includes(part));
      if (!ok) return false;
    }
    if (filters.fabric && product.fabric !== filters.fabric) return false;
    if (filters.color && product.color !== filters.color && !product.variants.some((v) => v.color === filters.color)) {
      return false;
    }
    if (filters.weave && product.weave !== filters.weave) return false;
    if (filters.occasion && product.occasion !== filters.occasion) return false;
    if (filters.pattern && product.pattern !== filters.pattern) return false;
    if (filters.sareeType && product.sareeType !== filters.sareeType) return false;
    const stock = totalStock(product);
    if (filters.availability === "in" && stock <= 0) return false;
    if (filters.availability === "out" && stock > 0) return false;
    const price = displayPrice(product);
    if (filters.discount && !(product.compareAtPaise && product.compareAtPaise > price)) return false;
    if (filters.minPaise != null && price < filters.minPaise) return false;
    if (filters.maxPaise != null && price > filters.maxPaise) return false;
    return true;
  });

  const sort = filters.sort ?? "recommended";
  return filtered.sort((a, b) => {
    if (sort === "price_asc") return displayPrice(a) - displayPrice(b);
    if (sort === "price_desc") return displayPrice(b) - displayPrice(a);
    if (sort === "newest") return b.createdAt.getTime() - a.createdAt.getTime();
    if (sort === "best") return (sold[b.id] ?? 0) - (sold[a.id] ?? 0);
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

export function matchesRule(
  product: { pricePaise: number; sareeType: string; occasion: string; fabric: string; variants?: VariantLike[] },
  ruleJson: string,
) {
  let rule: { maxPricePaise?: number; sareeType?: string; occasion?: string; fabric?: string } = {};
  try {
    rule = JSON.parse(ruleJson || "{}") as typeof rule;
  } catch {
    return false;
  }
  if (rule.maxPricePaise != null && displayPrice(product) > rule.maxPricePaise) return false;
  if (rule.sareeType && product.sareeType !== rule.sareeType) return false;
  if (rule.occasion && product.occasion !== rule.occasion) return false;
  if (rule.fabric && product.fabric !== rule.fabric) return false;
  return true;
}
