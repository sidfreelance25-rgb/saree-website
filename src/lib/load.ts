import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "./prisma";

export const loadStore = cache(async (slug: string) => {
  const store = await prisma.store.findUnique({
    where: { slug },
    include: {
      theme: true,
      menuItems: { where: { parentId: null }, orderBy: { sort: "asc" } },
    },
  });
  if (!store?.theme) notFound();
  return { ...store, theme: store.theme };
});

export async function loadCatalog(storeId: string) {
  return prisma.product.findMany({
    where: { storeId, status: "active" },
    include: {
      images: { orderBy: { sort: "asc" } },
      variants: { orderBy: { sort: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export type CatalogProduct = Awaited<ReturnType<typeof loadCatalog>>[number];
