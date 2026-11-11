import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadStore } from "@/lib/load";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({ params }: { params: Promise<{ store: string; slug: string }> }): Promise<Metadata> {
  const { store: storeSlug, slug } = await params;
  const store = await loadStore(storeSlug);
  const post = await prisma.blogPost.findUnique({ where: { storeId_slug: { storeId: store.id, slug } } });
  return { title: post?.seoTitle || post?.title, description: post?.seoDescription || post?.excerpt };
}

export default async function BlogPostPage({ params }: { params: Promise<{ store: string; slug: string }> }) {
  const { store: storeSlug, slug } = await params;
  const store = await loadStore(storeSlug);
  const post = await prisma.blogPost.findFirst({ where: { storeId: store.id, slug, status: "published" } });
  if (!post) notFound();
  return (
    <article className="wrap" style={{ maxWidth: 720 }}>
      <p className="crumbs"><Link href={`/s/${storeSlug}/blog`}>Journal</Link> / {post.title}</p>
      <h1 style={{ fontSize: "2.6rem" }}>{post.title}</h1>
      {post.body.split("\n").filter(Boolean).map((paragraph) => <p key={paragraph.slice(0, 32)} style={{ marginTop: "0.9rem" }}>{paragraph}</p>)}
    </article>
  );
}
