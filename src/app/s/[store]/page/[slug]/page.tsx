import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadStore } from "@/lib/load";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export async function generateMetadata({ params }: { params: Promise<{ store: string; slug: string }> }): Promise<Metadata> {
  const { store: storeSlug, slug } = await params;
  const store = await loadStore(storeSlug);
  const page = await prisma.page.findUnique({ where: { storeId_slug: { storeId: store.id, slug } } });
  return { title: page?.seoTitle || page?.title, description: page?.seoDescription || page?.body.slice(0, 150) };
}

export default async function CmsPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string; slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { store: storeSlug, slug } = await params;
  const query = await searchParams;
  const store = await loadStore(storeSlug);
  const page = await prisma.page.findUnique({ where: { storeId_slug: { storeId: store.id, slug } } });
  if (!page) notFound();
  const session = await readSession();
  const staff = session ? await prisma.staffMembership.findFirst({ where: { userId: session.uid, storeId: store.id } }) : null;
  if (!page.published && !(query.preview === "1" && staff)) notFound();
  return (
    <article className="wrap" style={{ maxWidth: 720 }}>
      <p className="crumbs"><Link href={`/s/${storeSlug}`}>Home</Link> / {page.title}</p>
      {!page.published && <p className="note">Preview. This page is not published.</p>}
      <h1 style={{ fontSize: "2.8rem" }}>{page.title}</h1>
      {page.body.split("\n").filter(Boolean).map((paragraph) => <p key={paragraph.slice(0, 24)} style={{ marginTop: "0.8rem" }}>{paragraph}</p>)}
    </article>
  );
}
