export function pinServiceable(store: { pinPrefixes: string; blockedPins: string }, pin: string) {
  if (!/^\d{6}$/.test(pin)) return false;
  const blocked = store.blockedPins
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (blocked.includes(pin)) return false;
  const prefixes = store.pinPrefixes
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (prefixes.length === 0) return true;
  return prefixes.some((prefix) => pin.startsWith(prefix));
}

export function deliveryCopy(
  product: { dispatch: string; leadDays: number },
  serviceable: boolean,
) {
  if (!serviceable) return "This PIN code is outside the current delivery area.";
  if (product.dispatch === "made_to_order") {
    return `Made to order. The loom needs about ${product.leadDays} days before dispatch, then 3–5 days in transit.`;
  }
  return "Ready to ship. Delivery is usually 3–5 days after dispatch.";
}
