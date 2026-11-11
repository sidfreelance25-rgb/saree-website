export type CouponQuote = {
  type: "percent" | "fixed" | "free_shipping";
  value: number;
  freeShipping: boolean;
};

export type PriceInput = {
  lines: { unitPaise: number; qty: number }[];
  coupon?: CouponQuote | null;
  shippingFlatPaise: number;
  freeShippingOverPaise: number;
  taxInclusive: boolean;
  gstRateBps: number;
};

export type PriceQuote = {
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  taxPaise: number;
  totalPaise: number;
};

export function priceCart(input: PriceInput): PriceQuote {
  const subtotalPaise = input.lines.reduce((sum, line) => sum + line.unitPaise * line.qty, 0);
  let discountPaise = 0;
  if (input.coupon?.type === "percent") {
    discountPaise = Math.round((subtotalPaise * input.coupon.value) / 100);
  } else if (input.coupon?.type === "fixed") {
    discountPaise = input.coupon.value;
  }
  discountPaise = Math.max(0, Math.min(discountPaise, subtotalPaise));
  const merchandise = subtotalPaise - discountPaise;
  let shippingPaise = merchandise >= input.freeShippingOverPaise ? 0 : input.shippingFlatPaise;
  if (input.coupon && (input.coupon.type === "free_shipping" || input.coupon.freeShipping)) {
    shippingPaise = 0;
  }
  const rate = input.gstRateBps;
  const taxPaise = input.taxInclusive
    ? Math.round((merchandise * rate) / (10000 + rate))
    : Math.round((merchandise * rate) / 10000);
  const totalPaise = input.taxInclusive ? merchandise + shippingPaise : merchandise + shippingPaise + taxPaise;
  return { subtotalPaise, discountPaise, shippingPaise, taxPaise, totalPaise };
}
