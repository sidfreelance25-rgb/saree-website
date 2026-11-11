import Link from "next/link";
import { PageForm, UploadedUrl } from "@/components/widgets";
import { addMenuItem, deleteMenuItem, moveSection, toggleSection, updateSection } from "@/server/actions";
import { sellerContext } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function ContentPage() {
  const ctx = await sellerContext("content.write");
  const sections = await prisma.homepageSection.findMany({ where: { storeId: ctx.store.id }, orderBy: { sort: "asc" } });
  const pages = await prisma.page.findMany({ where: { storeId: ctx.store.id }, orderBy: { title: "asc" } });
  const menu = await prisma.menuItem.findMany({ where: { storeId: ctx.store.id }, orderBy: { sort: "asc" } });
  return (
    <div>
      <h1 style={{ fontSize: "2rem" }}>Content</h1>
      <p><Link href={`/s/${ctx.store.slug}?preview=1`}>Preview the homepage, including hidden sections</Link></p>
      <h2>Homepage</h2>
      {sections.map((section) => {
        const copy = readCopy(section.payload);
        return (
        <form key={section.id} action={updateSection} className="panel stack">
          <input type="hidden" name="id" value={section.id} />
          <p className="kicker">{section.type} · {section.enabled ? "visible" : "hidden"}</p>
          <label className="field"><span>Title</span><input name="title" defaultValue={section.title} /></label>
          <label className="field"><span>Subtitle</span><input name="subtitle" defaultValue={section.subtitle} /></label>
          <label className="field"><span>Body</span><textarea name="body" rows={4} defaultValue={copy.body} /></label>
          <UploadedUrl name="imageUrl" initial={copy.imageUrl} />
          <button className="btn" type="submit">Save section</button>
          <div className="row">
            <button className="btn ghost" formAction={toggleSection} type="submit">{section.enabled ? "Hide" : "Show"}</button>
            <button className="btn ghost" formAction={moveSection} name="direction" value="-1" type="submit">Up</button>
            <button className="btn ghost" formAction={moveSection} name="direction" value="1" type="submit">Down</button>
          </div>
        </form>
        );
      })}
      <h2>Pages</h2>
      {pages.map((page) => (
        <div key={page.id} className="panel stack">
          <p><Link href={`/s/${ctx.store.slug}/page/${page.slug}?preview=1`}>View {page.title}</Link> · {page.published ? "published" : "draft"}</p>
          <PageForm page={page} />
        </div>
      ))}
      <h2>New page</h2>
      <PageForm />
      <h2>Menu</h2>
      {menu.map((item) => (
        <form key={item.id} action={deleteMenuItem} className="row">
          <span>{item.label} → {item.href}</span>
          <input type="hidden" name="id" value={item.id} />
          <button className="btn ghost" type="submit">Remove</button>
        </form>
      ))}
      <form action={addMenuItem} className="stack">
        <label className="field"><span>Label</span><input name="label" required /></label>
        <label className="field"><span>Link</span><input name="href" required placeholder={`/s/${ctx.store.slug}/collection/wedding`} /></label>
        <button className="btn" type="submit">Add menu item</button>
      </form>
    </div>
  );
}

function readCopy(payload: string) {
  try {
    const data = JSON.parse(payload) as { body?: unknown; imageUrl?: unknown };
    return { body: typeof data.body === "string" ? data.body : "", imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : "" };
  } catch {
    return { body: "", imageUrl: "" };
  }
}
