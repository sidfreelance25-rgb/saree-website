import { addInstagramPost, instagramConnect, toggleInstagramPost } from "@/server/actions";
import { formatWhen } from "@/lib/format";
import { sellerContext } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function InstagramAdmin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const ctx = await sellerContext("instagram.write");
  const query = await searchParams;
  const connection = await prisma.instagramConnection.findUnique({ where: { storeId: ctx.store.id } });
  const posts = await prisma.instagramPost.findMany({ where: { storeId: ctx.store.id }, orderBy: { postedAt: "desc" } });
  const configured = Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
  return (
    <div>
      <h1 style={{ fontSize: "2rem" }}>Instagram</h1>
      <div className="panel">
        <p>Status: {connection?.status ?? "disconnected"}</p>
        <p className="muted">{connection?.lastError || (configured ? "Meta credentials are present." : "The platform operator has not added Meta app credentials.")}</p>
        {connection?.lastSyncAt && <p className="muted">Last attempt {formatWhen(connection.lastSyncAt)}</p>}
        <p>A professional Instagram account can be connected only through Meta's official flow. This screen never asks for an Instagram password.</p>
        <div className="row">
          <form action={instagramConnect}><input type="hidden" name="action" value="connect" /><button className="btn" type="submit">Connect Instagram</button></form>
          <form action={instagramConnect}><input type="hidden" name="action" value="sync" /><button className="btn ghost" type="submit">Sync now</button></form>
          <form action={instagramConnect}><input type="hidden" name="action" value="disconnect" /><button className="btn ghost" type="submit">Disconnect</button></form>
        </div>
        {query.error === "rate" && <p className="error">Wait a minute before syncing again.</p>}
        {query.error === "sync" && <p className="error">Sync did not run. Use the manual gallery until a professional account is connected.</p>}
        {query.error === "post" && <p className="error">Use an https://www.instagram.com/ link and an uploaded image path.</p>}
      </div>
      <h2>Manual gallery</h2>
      <form action={addInstagramPost} className="stack">
        <label className="field"><span>Instagram URL</span><input name="permalink" required placeholder="https://www.instagram.com/yourhouse/" /></label>
        <label className="field"><span>Image path</span><input name="imageUrl" required placeholder="/media/..." /></label>
        <label className="field"><span>Caption</span><input name="caption" /></label>
        <button className="btn" type="submit">Add post</button>
      </form>
      {posts.map((post) => (
        <form key={post.id} action={toggleInstagramPost} className="panel">
          <img src={post.imageUrl} alt="" style={{ width: 96, height: 96, objectFit: "cover" }} />
          <p>{post.caption}</p>
          <p className="muted">{post.source} · {post.visible ? "visible" : "hidden"}</p>
          <input type="hidden" name="id" value={post.id} />
          <button className="btn ghost" type="submit">{post.visible ? "Hide" : "Show"}</button>
        </form>
      ))}
    </div>
  );
}
