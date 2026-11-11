import Link from "next/link";
import { loadStore } from "@/lib/load";
import { prisma } from "@/lib/prisma";

export default async function BlogIndex({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const store = await loadStore(slug);
  const posts = await prisma.blogPost.findMany({
    where: { storeId: store.id, status: "published" },
    orderBy: { publishedAt: "desc" },
  });
  return (
    <div className="wrap">
      <h1>Journal</h1>
      {posts.map((post) => (
        <article key={post.id} className="note" style={{ marginTop: "0.8rem" }}>
          <p className="kicker">{post.category}</p>
          <h2><Link href={`/s/${slug}/blog/${post.slug}`}>{post.title}</Link></h2>
          <p>{post.excerpt}</p>
        </article>
      ))}
    </div>
  );
}
