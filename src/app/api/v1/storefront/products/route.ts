import { NextResponse } from "next/server";
import { displayPrice } from "@/lib/catalog";
import { formatINR } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("store") ?? "";
  const ids = (url.searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, 8);
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store || ids.length === 0) return NextResponse.json({ products: [] });
  const products = await prisma.product.findMany({
    where: { storeId: store.id, id: { in: ids }, status: "active" },
    include: { images: { take: 1 }, variants: true },
  });
  return NextResponse.json({
    products: products.map((product) => ({
      slug: product.slug,
      name: product.name,
      image: product.images[0]?.url ?? "",
      price: formatINR(displayPrice(product)),
    })),
  });
}
