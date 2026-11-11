import { ReelFrame } from "@/components/reels";
import { loadStore } from "@/lib/load";
import { prisma } from "@/lib/prisma";

export default async function InstagramPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const store = await loadStore(slug);
  const posts = await prisma.instagramPost.findMany({ where: { storeId: store.id, visible: true }, orderBy: { postedAt: "desc" } });
  const handle = store.instagramHandle?.replace(/^@/, "");
  return (
    <div className="wrap">
      <h1>Instagram</h1>
      <p className="muted">
        {handle ? (
          <>
            Reels and pictures chosen from <a href={`https://www.instagram.com/${handle}/`}>@{handle}</a>. Taana does not store an Instagram password.
          </>
        ) : (
          "This house has not added an Instagram username yet."
        )}
      </p>
      {posts.length === 0 ? <p className="note">No reels to show yet.</p> : (
        <div className="reel-grid">
          {posts.map((post) => (
            <article key={post.id} className="reel-card">
              <ReelFrame permalink={post.permalink} videoUrl={post.videoUrl} caption={post.caption} imageUrl={post.imageUrl} />
              {post.caption && <p>{post.caption}</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
