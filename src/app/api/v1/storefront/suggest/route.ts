import { NextResponse } from "next/server";
import { displayPrice, filterProducts } from "@/lib/catalog";
import { formatINR } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("store") ?? "";
  const q = url.searchParams.get("q") ?? "";
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store || q.trim().length < 2) return NextResponse.json({ hits: [] });
  const products = await prisma.product.findMany({
    where: { storeId: store.id, status: "active" },
    include: { variants: true },
  });
  const hits = filterProducts(products, { q }).slice(0, 6).map((product) => ({
    slug: product.slug,
    name: product.name,
    price: formatINR(displayPrice(product)),
  }));
  return NextResponse.json({ hits });
}
