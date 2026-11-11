import type { PrismaClient } from "@prisma/client";
import { DEFAULT_PAGES, DEFAULT_VISIBLE, presetById } from "./presets";

type Db = PrismaClient;

export type ProvisionInput = {
  name: string;
  slug: string;
  description: string;
  phone: string;
  email: string;
  whatsapp?: string;
  instagramHandle?: string;
  addressLine: string;
  city: string;
  state: string;
  pin: string;
  legalName: string;
  gstin?: string;
  logoText: string;
  seoTitle: string;
  seoDescription: string;
  orderPrefix: string;
  pinPrefixes: string;
  blockedPins?: string;
  preset: string;
  ownerUserId: string;
  announcement: string;
  heroSubtitle: string;
  story: string;
};

export async function provisionStore(db: Db, input: ProvisionInput) {
  const theme = presetById(input.preset);
  const store = await db.store.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description,
      phone: input.phone,
      email: input.email,
      whatsapp: input.whatsapp,
      instagramHandle: input.instagramHandle,
      addressLine: input.addressLine,
      city: input.city,
      state: input.state,
      pin: input.pin,
      legalName: input.legalName,
      gstin: input.gstin,
      logoText: input.logoText,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      orderPrefix: input.orderPrefix,
      pinPrefixes: input.pinPrefixes,
      blockedPins: input.blockedPins ?? "999999",
      visibleAttributes: DEFAULT_VISIBLE,
      theme: {
        create: {
          preset: theme.id,
          primary: theme.primary,
          secondary: theme.secondary,
          accent: theme.accent,
          background: theme.background,
          ink: theme.ink,
          card: theme.card,
          headingFont: theme.headingFont,
          bodyFont: theme.bodyFont,
        },
      },
      domains: {
        create: { host: `${input.slug}.taana.test`, kind: "subdomain", isPrimary: true },
      },
      memberships: { create: { userId: input.ownerUserId, role: "owner" } },
      subscription: { create: { plan: "trial", status: "trialing" } },
      instagram: { create: { status: "disconnected" } },
    },
  });

  await db.page.createMany({
    data: DEFAULT_PAGES.map((page) => ({
      storeId: store.id,
      slug: page.slug,
      title: page.title,
      body: page.body,
      published: true,
      seoTitle: `${page.title} · ${input.name}`,
      seoDescription: page.body.slice(0, 150),
    })),
  });

  const sections: { type: string; title: string; subtitle: string; sort: number; payload?: string }[] = [
    { type: "announcement", title: input.announcement, subtitle: "", sort: 10 },
    {
      type: "hero",
      title: input.name,
      subtitle: input.heroSubtitle,
      sort: 20,
      payload: JSON.stringify({ cta: "Shop the edit", href: `/s/${input.slug}/collection/new-arrivals` }),
    },
    { type: "collections", title: "Collections", subtitle: "Edited by the house, not by an algorithm.", sort: 30 },
    { type: "shop_by_type", title: "Shop by saree type", subtitle: "", sort: 40 },
    { type: "new_arrivals", title: "New arrivals", subtitle: "Just in from the loom.", sort: 50 },
    { type: "shop_by_occasion", title: "Shop by occasion", subtitle: "", sort: 60 },
    { type: "shop_by_fabric", title: "Shop by fabric", subtitle: "", sort: 70 },
    { type: "featured", title: "Featured sarees", subtitle: "", sort: 80 },
    {
      type: "campaign",
      title: "Festive dyeing is open",
      subtitle: "Wedding and puja edits ship with a blouse piece unless the page says otherwise.",
      sort: 90,
      payload: JSON.stringify({ href: `/s/${input.slug}/collection/wedding`, label: "See the wedding edit" }),
    },
    { type: "best_sellers", title: "Best sellers", subtitle: "Ranked by pieces ordered. Gross units, not paid revenue.", sort: 100 },
    { type: "instagram", title: "From the loom, on Instagram", subtitle: "Posts the seller chose to show.", sort: 110 },
    {
      type: "testimonials",
      title: "Notes from clients",
      subtitle: "",
      sort: 120,
      payload: JSON.stringify({
        quotes: [
          {
            quote: "The pallu photograph matched the saree that arrived. The zari is raised, not printed.",
            name: "Ananya Shah",
            city: "Delhi",
          },
        ],
      }),
    },
    { type: "story", title: "The house", subtitle: "", sort: 130, payload: JSON.stringify({ body: input.story }) },
    {
      type: "newsletter",
      title: "New lots, rarely",
      subtitle: "A note when a weaving lot is ready. No weekly blasts.",
      sort: 140,
    },
  ];

  await db.homepageSection.createMany({
    data: sections.map((section) => ({
      storeId: store.id,
      type: section.type,
      title: section.title,
      subtitle: section.subtitle,
      sort: section.sort,
      enabled: true,
      payload: section.payload ?? "{}",
    })),
  });

  await db.menuItem.createMany({
    data: [
      { storeId: store.id, label: "New arrivals", href: `/s/${input.slug}/collection/new-arrivals`, sort: 10 },
      { storeId: store.id, label: "Journal", href: `/s/${input.slug}/blog`, sort: 20 },
      { storeId: store.id, label: "Saree guide", href: `/s/${input.slug}/page/saree-guide`, sort: 30 },
      { storeId: store.id, label: "Our house", href: `/s/${input.slug}/page/about`, sort: 40 },
    ],
  });

  return store;
}
