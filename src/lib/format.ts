export function formatINR(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

export function rupeesToPaise(rupees: number) {
  return Math.round(rupees * 100);
}

export function discountPercent(pricePaise: number, compareAtPaise?: number | null) {
  if (!compareAtPaise || compareAtPaise <= pricePaise) return 0;
  return Math.round(((compareAtPaise - pricePaise) / compareAtPaise) * 100);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

export function formatWhen(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}
