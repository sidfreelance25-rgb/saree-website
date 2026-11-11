import { NextResponse } from "next/server";
import { totalStock } from "@/lib/catalog";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export async function GET() {
  const session = await readSession();
  if (!session) return new NextResponse("Sign in required", { status: 401 });
  const membership = await prisma.staffMembership.findFirst({ where: { userId: session.uid } });
  const storeId = session.supportStoreId ?? membership?.storeId;
  const role = session.supportStoreId ? "owner" : membership?.role ?? "";
  if (!storeId || !can(role, "products.read")) return new NextResponse("Not allowed", { status: 403 });
  const products = await prisma.product.findMany({
    where: { storeId },
    include: { variants: true },
    orderBy: { name: "asc" },
  });
  const lines = ["name,sku,price,stock,fabric,saree_type,color,occasion,status"];
  for (const product of products) {
    lines.push(
      [product.name, product.sku, (product.pricePaise / 100).toString(), String(totalStock(product)), product.fabric, product.sareeType, product.color, product.occasion, product.status].join(","),
    );
  }
  return new NextResponse(lines.join("\n"), {
    headers: { "content-type": "text/csv; charset=utf-8" },
  });
}
