import type { Metadata } from "next";
import { cookies } from "next/headers";
import { StoreShell } from "@/components/shell";
import { loadStore } from "@/lib/load";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({ params }: { params: Promise<{ store: string }> }): Promise<Metadata> {
  const { store: slug } = await params;
  const store = await loadStore(slug);
  return {
    title: store.seoTitle,
    description: store.seoDescription,
    openGraph: { title: store.seoTitle, description: store.seoDescription, images: store.shareImage ? [store.shareImage] : undefined },
  };
}

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ store: string }>;
}) {
  const { store: slug } = await params;
  const store = await loadStore(slug);
  if (store.status !== "active") {
    return (
      <main className="wrap">
        <h1>{store.name} is paused</h1>
        <p>This storefront is not taking visitors right now.</p>
      </main>
    );
  }
  const announcement = await prisma.homepageSection.findFirst({
    where: { storeId: store.id, type: "announcement", enabled: true },
  });
  const jar = await cookies();
  const cartId = jar.get(`cart_${store.id}`)?.value;
  const items = cartId
    ? await prisma.cartItem.findMany({ where: { cartId, cart: { storeId: store.id } } })
    : [];
  const count = items.reduce((sum, item) => sum + item.qty, 0);
  return (
    <StoreShell store={store} count={count}>
      {announcement && <div className="announce">{announcement.title}</div>}
      {children}
    </StoreShell>
  );
}
