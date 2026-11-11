import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { can } from "../src/lib/permissions";
import { pinServiceable } from "../src/lib/pin";
import { priceCart } from "../src/lib/pricing";
import { filterProducts } from "../src/lib/catalog";

describe("priceCart", () => {
  const base = {
    shippingFlatPaise: 9900,
    freeShippingOverPaise: 500000,
    taxInclusive: true,
    gstRateBps: 500,
  };

  it("extracts 5% inclusive GST and waives shipping over the threshold", () => {
    const quote = priceCart({
      ...base,
      lines: [{ unitPaise: 2850000, qty: 1 }],
    });
    assert.equal(quote.subtotalPaise, 2850000);
    assert.equal(quote.discountPaise, 0);
    assert.equal(quote.shippingPaise, 0);
    assert.equal(quote.taxPaise, Math.round((2850000 * 500) / 10500));
    assert.equal(quote.totalPaise, 2850000);
  });

  it("applies a percent coupon before tax and can zero shipping", () => {
    const quote = priceCart({
      ...base,
      lines: [{ unitPaise: 200000, qty: 1 }],
      coupon: { type: "percent", value: 10, freeShipping: false },
    });
    assert.equal(quote.discountPaise, 20000);
    assert.equal(quote.shippingPaise, 9900);
    assert.equal(quote.totalPaise, 180000 + 9900);
  });

  it("does not let a fixed coupon exceed the merchandise", () => {
    const quote = priceCart({
      ...base,
      lines: [{ unitPaise: 40000, qty: 1 }],
      coupon: { type: "fixed", value: 90000, freeShipping: false },
    });
    assert.equal(quote.discountPaise, 40000);
    assert.equal(quote.totalPaise, 9900);
  });

  it("adds exclusive GST on top", () => {
    const quote = priceCart({
      ...base,
      taxInclusive: false,
      lines: [{ unitPaise: 100000, qty: 1 }],
    });
    assert.equal(quote.taxPaise, 5000);
    assert.equal(quote.shippingPaise, 9900);
    assert.equal(quote.totalPaise, 100000 + 5000 + 9900);
  });
});

describe("pin and permissions", () => {
  it("honours prefixes and blocked pins", () => {
    const store = { pinPrefixes: "110,221", blockedPins: "110999" };
    assert.equal(pinServiceable(store, "110001"), true);
    assert.equal(pinServiceable(store, "560001"), false);
    assert.equal(pinServiceable(store, "110999"), false);
    assert.equal(pinServiceable(store, "11001"), false);
  });

  it("keeps order staff out of catalogue writes", () => {
    assert.equal(can("orders", "orders.write"), true);
    assert.equal(can("orders", "products.write"), false);
    assert.equal(can("catalogue", "inventory.write"), true);
    assert.equal(can("catalogue", "orders.write"), false);
    assert.equal(can("content", "content.write"), true);
    assert.equal(can("owner", "team.write"), true);
    assert.equal(can("stranger", "orders.read"), false);
  });
});

describe("filterProducts", () => {
  const products = [
    {
      id: "a",
      name: "Chandrika Katan",
      sku: "VW-1",
      fabric: "Silk",
      color: "Maroon",
      occasion: "Wedding",
      sareeType: "Banarasi",
      pattern: "Floral",
      weave: "Handloom",
      work: "Zari",
      pricePaise: 1000,
      compareAtPaise: 1500,
      featured: true,
      createdAt: new Date("2026-01-02"),
      variants: [{ pricePaise: null, stock: 2, color: "Maroon" }],
    },
    {
      id: "b",
      name: "Office cotton",
      sku: "VW-2",
      fabric: "Cotton",
      color: "Mustard",
      occasion: "Casual",
      sareeType: "Tant",
      pattern: "Geometric",
      weave: "Handloom",
      work: "Woven",
      pricePaise: 400,
      compareAtPaise: null,
      featured: false,
      createdAt: new Date("2026-02-02"),
      variants: [{ pricePaise: null, stock: 0, color: "Mustard" }],
    },
  ];

  it("searches fabric and hides out-of-stock when asked", () => {
    const silk = filterProducts(products, { q: "silk wedding" });
    assert.deepEqual(silk.map((product) => product.id), ["a"]);
    const inStock = filterProducts(products, { availability: "in" });
    assert.deepEqual(inStock.map((product) => product.id), ["a"]);
  });
});
