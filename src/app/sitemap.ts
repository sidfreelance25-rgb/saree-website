import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const stores = await prisma.store.findMany({
    where: { status: "active" },
    include: { products: { where: { status: "active" } }, collections: true, pages: { where: { published: true } } },
  });
  const entries: MetadataRoute.Sitemap = [{ url: "https://taana.test/", changeFrequency: "weekly", priority: 0.4 }];
  for (const store of stores) {
    entries.push({ url: `https://taana.test/s/${store.slug}`, changeFrequency: "daily", priority: 0.8 });
    for (const product of store.products) {
      entries.push({ url: `https://taana.test/s/${store.slug}/product/${product.slug}`, changeFrequency: "weekly", priority: 0.7 });
    }
    for (const collection of store.collections) {
      entries.push({ url: `https://taana.test/s/${store.slug}/collection/${collection.slug}`, changeFrequency: "weekly", priority: 0.6 });
    }
    for (const page of store.pages) {
      entries.push({ url: `https://taana.test/s/${store.slug}/page/${page.slug}`, changeFrequency: "monthly", priority: 0.4 });
    }
  }
  return entries;
}
