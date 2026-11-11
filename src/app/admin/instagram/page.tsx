import { addInstagramPost, instagramConnect, saveInstagramHandle, toggleInstagramPost } from "@/server/actions";
import { ReelForm, ReelFrame } from "@/components/reels";
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
      <form action={saveInstagramHandle} className="panel stack">
        <h2>Instagram ID</h2>
        <p className="muted">This is the public username. Taana does not log in, store a password, or copy the account by itself.</p>
        <label className="field"><span>Username</span><input name="handle" required defaultValue={ctx.store.instagramHandle ?? ""} placeholder="varanasiweave" /></label>
        <button className="btn" type="submit">Save Instagram ID</button>
        {query.error === "handle" && <p className="error">Enter the Instagram username, without a password.</p>}
      </form>
      <div className="panel">
        <p>Official connection: {connection?.status ?? "disconnected"}{connection?.account ? ` · @${connection.account}` : ""}</p>
        <p className="muted">{connection?.lastError || (configured ? "Meta credentials are present." : "Meta app credentials are not set, so reels are added by link.")}</p>
        {connection?.lastSyncAt && <p className="muted">Last attempt {formatWhen(connection.lastSyncAt)}</p>}
        <div className="row">
          <form action={instagramConnect}><input type="hidden" name="action" value="connect" /><button className="btn ghost" type="submit">Connect Instagram</button></form>
          <form action={instagramConnect}><input type="hidden" name="action" value="sync" /><button className="btn ghost" type="submit">Sync now</button></form>
          <form action={instagramConnect}><input type="hidden" name="action" value="disconnect" /><button className="btn ghost" type="submit">Disconnect</button></form>
        </div>
        {query.error === "rate" && <p className="error">Wait a minute before syncing again.</p>}
        {query.error === "sync" && <p className="error">Sync did not run. Add a reel link below.</p>}
      </div>
      <h2>Add a reel</h2>
      <p className="muted">Paste the reel link from Instagram. Upload the video file as well if you want it to play on this site without opening Instagram.</p>
      {query.error === "reel" && <p className="error">Use a reel link such as https://www.instagram.com/reel/…</p>}
      <ReelForm />
      <h2>Pictures</h2>
      <form action={addInstagramPost} className="stack">
        <label className="field"><span>Instagram URL</span><input name="permalink" required placeholder="https://www.instagram.com/p/..." /></label>
        <label className="field"><span>Image path</span><input name="imageUrl" required placeholder="/media/..." /></label>
        <label className="field"><span>Caption</span><input name="caption" /></label>
        <button className="btn" type="submit">Add picture</button>
      </form>
      {query.error === "post" && <p className="error">Use an https://www.instagram.com/ link and an uploaded image path.</p>}
      <h2>On the site</h2>
      {posts.map((post) => (
        <form key={post.id} action={toggleInstagramPost} className="panel stack">
          <div className="reel-card">
            <ReelFrame permalink={post.permalink} videoUrl={post.videoUrl} caption={post.caption} imageUrl={post.imageUrl} />
          </div>
          <p>{post.caption || post.permalink}</p>
          <p className="muted">{post.source} · {post.visible ? "visible" : "hidden"}</p>
          <input type="hidden" name="id" value={post.id} />
          <button className="btn ghost" type="submit">{post.visible ? "Hide" : "Show"}</button>
        </form>
      ))}
    </div>
  );
}
