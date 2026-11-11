import { loadStore } from "@/lib/load";
import { prisma } from "@/lib/prisma";

export default async function InstagramPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const store = await loadStore(slug);
  const connection = await prisma.instagramConnection.findUnique({ where: { storeId: store.id } });
  const posts = await prisma.instagramPost.findMany({ where: { storeId: store.id, visible: true }, orderBy: { postedAt: "desc" } });
  return (
    <div className="wrap">
      <h1>Instagram</h1>
      <p className="muted">
        {connection?.status === "connected"
          ? `Connected${connection.account ? ` as @${connection.account}` : ""}.`
          : "This house has not connected a professional Instagram account. The pictures below were chosen by the seller and link to their profile. Taana does not store an Instagram password."}
      </p>
      {posts.length === 0 ? <p className="note">No posts to show yet.</p> : (
        <div className="insta" style={{ marginTop: "1rem" }}>
          {posts.map((post) => (
            <a key={post.id} href={post.permalink} target="_blank" rel="noreferrer">
              <img src={post.imageUrl} alt={post.caption} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
