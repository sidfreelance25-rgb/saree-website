import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { hashPassword } from "../src/lib/auth";
import { placeOrder } from "../src/lib/checkout";
import { prisma } from "../src/lib/prisma";
import { provisionStore } from "../src/lib/provision";
import { sareeSvg, type TextilePattern } from "../src/lib/textile";

const PASSWORD = "SareeDemo!2026";

type Piece = {
  name: string;
  sku: string;
  description: string;
  sareeType: string;
  fabric: string;
  weave: string;
  work: string;
  color: string;
  secondaryColor?: string;
  pattern: string;
  occasion: string;
  lengthCm: number;
  blouseDetail: string;
  origin: string;
  care: string;
  dispatch?: "ready" | "made_to_order";
  leadDays?: number;
  price: number;
  compareAt?: number;
  cost?: number;
  stock: number;
  featured?: boolean;
  category: string;
  collections: string[];
  art: TextilePattern;
  ground: string;
  border: string;
  motif: string;
  accent: string;
  variants?: { name: string; color: string; sku: string; stock: number; price?: number; ground: string }[];
};

const houses: {
  slug: string;
  prefix: string;
  preset: string;
  ownerEmail: string;
  input: Parameters<typeof provisionStore>[1];
  categories: { name: string; slug: string; children?: { name: string; slug: string }[] }[];
  collections: { name: string; slug: string; description: string; rule?: object }[];
  pieces: Piece[];
  blog: { slug: string; title: string; excerpt: string; body: string };
}[] = [
  {
    slug: "varanasi-weave",
    prefix: "VW",
    preset: "banaras",
    ownerEmail: "meera@varanasiweave.test",
    input: {
      name: "Varanasi Weave House",
      slug: "varanasi-weave",
      description: "Katan, tanchoi, and tissue sarees finished in small lots from the lanes behind Vishwanath.",
      phone: "9876500101",
      email: "hello@varanasiweave.test",
      whatsapp: "919876500101",
      instagramHandle: "varanasiweave",
      addressLine: "14 Madanpura Lane",
      city: "Varanasi",
      state: "Uttar Pradesh",
      pin: "221001",
      legalName: "Varanasi Weave House",
      gstin: "09AABCU9603R1ZM",
      logoText: "Varanasi Weave",
      seoTitle: "Varanasi Weave House · Banarasi sarees",
      seoDescription: "Handloom Banarasi sarees with blouse pieces, woven in small lots and shipped across India.",
      orderPrefix: "VW",
      pinPrefixes: "110,201,221,400,411,500,560,600,700",
      preset: "banaras",
      ownerUserId: "",
      announcement: "Wedding lot closes Sunday. Made-to-order kadhua needs three weeks.",
      heroSubtitle: "Katan and tissue from Madanpura, with the blouse piece folded into every parcel.",
      story:
        "Meera Banerjee started the house with four looms that already worked for her family. She still visits the pit looms on Thursday. Taana is only the counter. The zari is theirs.",
    },
    categories: [
      {
        name: "Banarasi",
        slug: "banarasi",
        children: [
          { name: "Katan", slug: "katan" },
          { name: "Tanchoi", slug: "tanchoi" },
          { name: "Tissue", slug: "tissue" },
        ],
      },
      { name: "Light weaves", slug: "light-weaves" },
    ],
    collections: [
      { name: "New arrivals", slug: "new-arrivals", description: "Sarees that reached the shop this month." },
      { name: "Wedding", slug: "wedding", description: "Heavier zari for the ceremony and the evening." },
      { name: "Festive", slug: "festive", description: "Puja, sangeet, and the lunch that runs long." },
      { name: "Under ₹10,000", slug: "under-10000", description: "Lighter weaves under ten thousand rupees.", rule: { maxPricePaise: 1000000 } },
    ],
    pieces: [
      {
        name: "Chandrika Katan Bridal",
        sku: "VW-CHANDRIKA",
        description:
          "A deep maroon katan with a close kadhua field and a pallu of marigold butis. The blouse piece is unstitched, cut from the same warp.",
        sareeType: "Banarasi",
        fabric: "Silk",
        weave: "Handloom",
        work: "Zari",
        color: "Maroon",
        pattern: "Floral",
        occasion: "Wedding",
        lengthCm: 620,
        blouseDetail: "Unstitched blouse piece, about 80 cm, included.",
        origin: "Madanpura, Varanasi",
        care: "Dry clean only. Store folded in muslin, not plastic.",
        price: 2850000,
        compareAt: 3200000,
        cost: 1900000,
        stock: 3,
        featured: true,
        category: "katan",
        collections: ["new-arrivals", "wedding"],
        art: "buti",
        ground: "#6E2433",
        border: "#C6A15B",
        motif: "#F3E2B3",
        accent: "#4A1520",
      },
      {
        name: "Neel Kamal Tanchoi",
        sku: "VW-NEEL",
        description: "An all-over tanchoi in indigo, woven so the lotus reads the same on the face and the reverse.",
        sareeType: "Banarasi",
        fabric: "Silk",
        weave: "Handloom",
        work: "Woven",
        color: "Indigo",
        pattern: "Floral",
        occasion: "Festive",
        lengthCm: 600,
        blouseDetail: "Unstitched blouse piece included.",
        origin: "Varanasi",
        care: "Dry clean.",
        price: 1840000,
        stock: 5,
        featured: true,
        category: "tanchoi",
        collections: ["new-arrivals", "festive"],
        art: "paisley",
        ground: "#1C2E4A",
        border: "#C6A15B",
        motif: "#E7D7A1",
        accent: "#10192C",
      },
      {
        name: "Gulbahar Organza",
        sku: "VW-GUL",
        description: "A blush organza with a narrow zari border. Light enough for a day wedding, formal enough for the photographs.",
        sareeType: "Organza",
        fabric: "Organza",
        weave: "Handloom",
        work: "Zari",
        color: "Blush",
        pattern: "Plain",
        occasion: "Party",
        lengthCm: 560,
        blouseDetail: "Blouse piece included, unstitched.",
        origin: "Varanasi",
        care: "Dry clean. Keep away from snags.",
        price: 980000,
        compareAt: 1120000,
        stock: 8,
        category: "light-weaves",
        collections: ["new-arrivals", "festive"],
        art: "plain",
        ground: "#F2D5D0",
        border: "#8C4A2F",
        motif: "#6E2433",
        accent: "#E7B8B0",
      },
      {
        name: "Sonchampa Tissue",
        sku: "VW-SON",
        description: "Gold tissue with a slim border. It catches flash photography. Only two pieces remain from this warp.",
        sareeType: "Banarasi",
        fabric: "Tissue",
        weave: "Handloom",
        work: "Zari",
        color: "Gold",
        pattern: "Traditional",
        occasion: "Festive",
        lengthCm: 580,
        blouseDetail: "Blouse piece included.",
        origin: "Varanasi",
        care: "Dry clean.",
        price: 2200000,
        stock: 2,
        featured: true,
        category: "tissue",
        collections: ["festive", "wedding"],
        art: "stripe",
        ground: "#E6C978",
        border: "#6E2433",
        motif: "#8C4A2F",
        accent: "#C6A15B",
      },
      {
        name: "Phoolkari Cotton Silk",
        sku: "VW-PHOOL",
        description: "A rust cotton-silk for office days and train journeys. The bootis are small on purpose.",
        sareeType: "Banarasi",
        fabric: "Cotton silk",
        weave: "Handloom",
        work: "Woven",
        color: "Rust",
        pattern: "Floral",
        occasion: "Casual",
        lengthCm: 550,
        blouseDetail: "Blouse piece included.",
        origin: "Varanasi",
        care: "Gentle hand wash in cold water. Dry in shade.",
        price: 460000,
        stock: 12,
        category: "light-weaves",
        collections: ["new-arrivals"],
        art: "buti",
        ground: "#A24B32",
        border: "#1A1412",
        motif: "#F6F1E8",
        accent: "#6E3324",
      },
      {
        name: "Mayuri Shikargah",
        sku: "VW-MAYURI",
        description:
          "A shikargah field of peacocks in the pallu. Woven to order on a jala loom. Choose ivory or rani. The two colours are separate warps, with their own stock.",
        sareeType: "Banarasi",
        fabric: "Silk",
        weave: "Handloom",
        work: "Zari",
        color: "Ivory",
        secondaryColor: "Rani",
        pattern: "Traditional",
        occasion: "Wedding",
        lengthCm: 630,
        blouseDetail: "Blouse piece woven to match the chosen ground.",
        origin: "Varanasi",
        care: "Dry clean only.",
        dispatch: "made_to_order",
        leadDays: 21,
        price: 4600000,
        stock: 1,
        featured: true,
        category: "katan",
        collections: ["wedding"],
        art: "paisley",
        ground: "#F7F1E4",
        border: "#6E2433",
        motif: "#C6A15B",
        accent: "#E7D7C3",
        variants: [
          { name: "Ivory", color: "Ivory", sku: "VW-MAYURI-IV", stock: 1, ground: "#F7F1E4" },
          { name: "Rani", color: "Rani", sku: "VW-MAYURI-RA", stock: 1, price: 4750000, ground: "#C23B62" },
        ],
      },
    ],
    blog: {
      slug: "how-to-read-a-pallu",
      title: "How to read a pallu",
      excerpt: "Kadhua, cutwork, and the difference you can feel with a thumb.",
      body: "Kadhua bootis are woven in, so the reverse shows the work. Cutwork looks similar from a distance and is clipped by hand after the loom. Run a thumb under the booti. If the thread is continuous with the ground, you are holding kadhua.\n\nWe mark the technique on every product page because the price difference is the labour, not a label.",
    },
  },
  {
    slug: "kanjeevaram-atelier",
    prefix: "KA",
    preset: "kanchi",
    ownerEmail: "lakshmi@kanjeevaram.test",
    input: {
      name: "Kanjeevaram Atelier",
      slug: "kanjeevaram-atelier",
      description: "Korvai borders and temple motifs from Kanchipuram, sold by the house that commissioned them.",
      phone: "9840002202",
      email: "hello@kanjeevaram.test",
      whatsapp: "919840002202",
      instagramHandle: "kanjeevaramatelier",
      addressLine: "8 Ekambaranathar Sannidhi Street",
      city: "Kanchipuram",
      state: "Tamil Nadu",
      pin: "631502",
      legalName: "Kanjeevaram Atelier",
      gstin: "33AABCU9603R1ZX",
      logoText: "Kanjeevaram Atelier",
      seoTitle: "Kanjeevaram Atelier · Kanchipuram sarees",
      seoDescription: "Korvai Kanjeevaram sarees with contrast borders, temple motifs, and unstitched blouse pieces.",
      orderPrefix: "KA",
      pinPrefixes: "600,631,560,500,641,110,400",
      preset: "kanchi",
      ownerUserId: "",
      announcement: "Contrast-border korvai is in stock. Bridal aarabhi is woven to order.",
      heroSubtitle: "Temple borders from Kanchipuram. The join of the border is the point of the cloth.",
      story:
        "Lakshmi Iyer commissions warps from three family looms and refuses to mix them in one listing. If a border is korvai, the page says so. If it is attached later, the page says that too.",
    },
    categories: [
      {
        name: "Kanjeevaram",
        slug: "kanjeevaram",
        children: [
          { name: "Korvai", slug: "korvai" },
          { name: "Cotton", slug: "cotton" },
        ],
      },
    ],
    collections: [
      { name: "New arrivals", slug: "new-arrivals", description: "Recent warps from the three looms." },
      { name: "Wedding", slug: "wedding", description: "Bridal weight, with a blouse piece." },
      { name: "Temple border", slug: "temple-border", description: "Gopuram and rudraksha borders." },
      { name: "Under ₹10,000", slug: "under-10000", description: "Cotton and lighter silks under ten thousand.", rule: { maxPricePaise: 1000000 } },
    ],
    pieces: [
      {
        name: "Gopuram Korvai",
        sku: "KA-GOPURAM",
        description: "Temple red ground, green border, and a row of gopurams woven where the pallu turns.",
        sareeType: "Kanjivaram",
        fabric: "Silk",
        weave: "Handloom",
        work: "Zari",
        color: "Temple red",
        secondaryColor: "Green",
        pattern: "Traditional",
        occasion: "Wedding",
        lengthCm: 630,
        blouseDetail: "Contrast blouse piece in the border green, unstitched.",
        origin: "Kanchipuram",
        care: "Dry clean only.",
        price: 3400000,
        compareAt: 3650000,
        cost: 2400000,
        stock: 2,
        featured: true,
        category: "korvai",
        collections: ["new-arrivals", "wedding", "temple-border"],
        art: "temple",
        ground: "#7A1F2B",
        border: "#143024",
        motif: "#E6D3A1",
        accent: "#10241C",
      },
      {
        name: "Malli Moggu",
        sku: "KA-MALLI",
        description: "Cream ground with a jasmine trail. The zari is tested against a magnet before it is accepted.",
        sareeType: "Kanjivaram",
        fabric: "Silk",
        weave: "Handloom",
        work: "Zari",
        color: "Cream",
        pattern: "Floral",
        occasion: "Festive",
        lengthCm: 610,
        blouseDetail: "Blouse piece included.",
        origin: "Kanchipuram",
        care: "Dry clean.",
        price: 1950000,
        stock: 4,
        featured: true,
        category: "korvai",
        collections: ["new-arrivals", "festive"],
        art: "buti",
        ground: "#F4EFE2",
        border: "#143024",
        motif: "#B08D57",
        accent: "#E7E0D2",
      },
      {
        name: "Veldhari Checks",
        sku: "KA-VEL",
        description: "Mustard cotton with a checked body. Meant for a hot day and a starched fold.",
        sareeType: "Kanjivaram",
        fabric: "Cotton",
        weave: "Handloom",
        work: "Woven",
        color: "Mustard",
        pattern: "Geometric",
        occasion: "Casual",
        lengthCm: 540,
        blouseDetail: "Blouse piece included.",
        origin: "Kanchipuram",
        care: "Hand wash cold. Starch lightly if you like a crisp pleat.",
        price: 620000,
        stock: 9,
        category: "cotton",
        collections: ["new-arrivals"],
        art: "check",
        ground: "#D6A03C",
        border: "#143024",
        motif: "#F6F1E4",
        accent: "#A87820",
      },
      {
        name: "Rudraksha Border",
        sku: "KA-RUDRA",
        description: "Maroon silk with a rudraksha border in gold. The korvai join is visible on the reverse, as it should be.",
        sareeType: "Kanjivaram",
        fabric: "Silk",
        weave: "Handloom",
        work: "Zari",
        color: "Maroon",
        pattern: "Traditional",
        occasion: "Festive",
        lengthCm: 620,
        blouseDetail: "Blouse piece included.",
        origin: "Kanchipuram",
        care: "Dry clean.",
        price: 2780000,
        stock: 3,
        featured: true,
        category: "korvai",
        collections: ["temple-border", "festive"],
        art: "temple",
        ground: "#5C1E2A",
        border: "#C6A15B",
        motif: "#F3E6C4",
        accent: "#3E141C",
      },
      {
        name: "Neeranjana",
        sku: "KA-NEERA",
        description: "Sea-green silk with a narrow gold border. A reception saree that still packs flat.",
        sareeType: "Kanjivaram",
        fabric: "Silk",
        weave: "Handloom",
        work: "Zari",
        color: "Sea green",
        pattern: "Plain",
        occasion: "Party",
        lengthCm: 590,
        blouseDetail: "Blouse piece included.",
        origin: "Kanchipuram",
        care: "Dry clean.",
        price: 1540000,
        stock: 6,
        category: "korvai",
        collections: ["new-arrivals"],
        art: "stripe",
        ground: "#1F6B5A",
        border: "#E6D3A1",
        motif: "#F4EFE2",
        accent: "#143024",
      },
      {
        name: "Aarabhi Bridal",
        sku: "KA-AARABHI",
        description: "Deep purple bridal weight, woven to order. The pallu carries a full temple repeat. There is no ready stock.",
        sareeType: "Kanjivaram",
        fabric: "Silk",
        weave: "Handloom",
        work: "Zari",
        color: "Purple",
        pattern: "Traditional",
        occasion: "Wedding",
        lengthCm: 640,
        blouseDetail: "Blouse piece woven with the border.",
        origin: "Kanchipuram",
        care: "Dry clean only.",
        dispatch: "made_to_order",
        leadDays: 28,
        price: 5200000,
        stock: 0,
        featured: true,
        category: "korvai",
        collections: ["wedding"],
        art: "paisley",
        ground: "#3A2156",
        border: "#C6A15B",
        motif: "#E6D3A1",
        accent: "#241436",
      },
    ],
    blog: {
      slug: "what-korvai-means",
      title: "What korvai means",
      excerpt: "The border is woven with the body, not stitched on afterwards.",
      body: "Korvai uses three shuttles. The body and the two borders interlock. Turn the saree over at the edge. You should see a row of small loops where the colours meet, not a seam.\n\nIf a listing says contrast border and does not say korvai, ask. We only use the word when the join is woven.",
    },
  },
];

async function main() {
  const passwordHash = hashPassword(PASSWORD);
  const platform = await prisma.user.create({
    data: {
      email: "platform@taana.test",
      name: "Platform Admin",
      phone: "9800000000",
      passwordHash,
      isPlatformAdmin: true,
    },
  });
  const meera = await prisma.user.create({
    data: { email: "meera@varanasiweave.test", name: "Meera Banerjee", phone: "9876500101", passwordHash },
  });
  const ravi = await prisma.user.create({
    data: { email: "ravi@varanasiweave.test", name: "Ravi Das", phone: "9876500102", passwordHash },
  });
  const lakshmi = await prisma.user.create({
    data: { email: "lakshmi@kanjeevaram.test", name: "Lakshmi Iyer", phone: "9840002202", passwordHash },
  });
  await prisma.user.create({
    data: { email: "ananya@example.com", name: "Ananya Shah", phone: "9810011122", passwordHash },
  });

  const owners: Record<string, string> = {
    "meera@varanasiweave.test": meera.id,
    "lakshmi@kanjeevaram.test": lakshmi.id,
  };

  for (const house of houses) {
    const store = await provisionStore(prisma, { ...house.input, ownerUserId: owners[house.ownerEmail] });
    if (house.slug === "varanasi-weave") {
      await prisma.staffMembership.create({
        data: { storeId: store.id, userId: ravi.id, role: "orders" },
      });
    }

    const categoryIds = new Map<string, string>();
    for (const category of house.categories) {
      const parent = await prisma.category.create({
        data: { storeId: store.id, name: category.name, slug: category.slug, sort: 0 },
      });
      categoryIds.set(category.slug, parent.id);
      for (const [index, child] of (category.children ?? []).entries()) {
        const created = await prisma.category.create({
          data: { storeId: store.id, parentId: parent.id, name: child.name, slug: child.slug, sort: index + 1 },
        });
        categoryIds.set(child.slug, created.id);
      }
    }

    for (const [index, collection] of house.collections.entries()) {
      await prisma.collection.create({
        data: {
          storeId: store.id,
          name: collection.name,
          slug: collection.slug,
          description: collection.description,
          kind: collection.rule ? "rule" : "manual",
          ruleJson: JSON.stringify(collection.rule ?? {}),
          sort: index,
          seoTitle: `${collection.name} · ${store.name}`,
          seoDescription: collection.description,
        },
      });
    }

    const dir = join(process.cwd(), "public", "media", house.slug);
    mkdirSync(dir, { recursive: true });

    for (const piece of house.pieces) {
      const svg = sareeSvg({
        ground: piece.ground,
        border: piece.border,
        motif: piece.motif,
        accent: piece.accent,
        pattern: piece.art,
      });
      const filename = `${piece.sku.toLowerCase()}.svg`;
      writeFileSync(join(dir, filename), svg);
      const imageUrl = `/media/${house.slug}/${filename}`;
      const product = await prisma.product.create({
        data: {
          storeId: store.id,
          categoryId: categoryIds.get(piece.category),
          name: piece.name,
          slug: piece.sku.toLowerCase(),
          sku: piece.sku,
          description: piece.description,
          status: "active",
          sareeType: piece.sareeType,
          fabric: piece.fabric,
          weave: piece.weave,
          work: piece.work,
          color: piece.color,
          secondaryColor: piece.secondaryColor ?? "",
          pattern: piece.pattern,
          occasion: piece.occasion,
          lengthCm: piece.lengthCm,
          blouseIncluded: true,
          blouseDetail: piece.blouseDetail,
          origin: piece.origin,
          care: piece.care,
          dispatch: piece.dispatch ?? "ready",
          leadDays: piece.leadDays ?? 0,
          pricePaise: piece.price,
          compareAtPaise: piece.compareAt,
          costPaise: piece.cost,
          featured: Boolean(piece.featured),
          lowStockAt: 2,
          publishedAt: new Date(),
          seoTitle: `${piece.name} · ${store.name}`,
          seoDescription: piece.description.slice(0, 150),
          images: { create: [{ storeId: store.id, url: imageUrl, alt: piece.name, sort: 0 }] },
          variants: {
            create: (piece.variants ?? [
              { name: piece.color, color: piece.color, sku: `${piece.sku}-1`, stock: piece.stock },
            ]).map((variant, index) => ({
              storeId: store.id,
              name: variant.name,
              color: variant.color,
              sku: variant.sku,
              stock: variant.stock,
              pricePaise: "price" in variant ? variant.price : undefined,
              sort: index,
            })),
          },
        },
      });
      const manualCollections = house.collections.filter((collection) => !collection.rule && piece.collections.includes(collection.slug));
      for (const collection of manualCollections) {
        const row = await prisma.collection.findUnique({
          where: { storeId_slug: { storeId: store.id, slug: collection.slug } },
        });
        if (!row) continue;
        await prisma.collectionProduct.create({
          data: { collectionId: row.id, productId: product.id, storeId: store.id },
        });
      }
      await prisma.mediaAsset.create({
        data: { storeId: store.id, url: imageUrl, filename, mime: "image/svg+xml", bytes: svg.length, alt: piece.name },
      });
    }

    await prisma.blogPost.create({
      data: {
        storeId: store.id,
        slug: house.blog.slug,
        title: house.blog.title,
        excerpt: house.blog.excerpt,
        body: house.blog.body,
        status: "published",
        publishedAt: new Date(),
        category: "Weave notes",
        seoTitle: house.blog.title,
        seoDescription: house.blog.excerpt,
      },
    });

    const posts = house.pieces.slice(0, 3);
    for (const [index, piece] of posts.entries()) {
      await prisma.instagramPost.create({
        data: {
          storeId: store.id,
          source: "manual",
          permalink: `https://www.instagram.com/${house.input.instagramHandle}/`,
          imageUrl: `/media/${house.slug}/${piece.sku.toLowerCase()}.svg`,
          caption: piece.name,
          postedAt: new Date(Date.now() - index * 86400000),
          visible: true,
        },
      });
    }

    await prisma.coupon.createMany({
      data: [
        {
          storeId: store.id,
          code: "WELCOME10",
          type: "percent",
          value: 10,
          minOrderPaise: 100000,
          firstOrderOnly: true,
          perCustomerLimit: 1,
        },
        {
          storeId: store.id,
          code: "FREESHIP",
          type: "free_shipping",
          value: 0,
          freeShipping: true,
          minOrderPaise: 0,
          perCustomerLimit: 3,
        },
      ],
    });

    await prisma.review.create({
      data: {
        storeId: store.id,
        productId: (await prisma.product.findFirstOrThrow({ where: { storeId: store.id, featured: true } })).id,
        author: "Mehul Desai",
        rating: 5,
        body: "Packed in muslin, blouse piece labelled, and the border matched the photograph.",
        status: "published",
      },
    });
  }

  const store = await prisma.store.findUniqueOrThrow({ where: { slug: "varanasi-weave" } });
  const product = await prisma.product.findFirstOrThrow({
    where: { storeId: store.id, sku: "VW-CHANDRIKA" },
    include: { variants: true },
  });
  const cart = await prisma.cart.create({
    data: {
      storeId: store.id,
      items: {
        create: [{ productId: product.id, variantId: product.variants[0].id, qty: 1 }],
      },
    },
  });
  const placed = await placeOrder(prisma, {
    storeId: store.id,
    cartId: cart.id,
    idempotencyKey: "seed-order-ananya",
    email: "ananya@example.com",
    phone: "9810011122",
    customerName: "Ananya Shah",
    userId: (await prisma.user.findUniqueOrThrow({ where: { email: "ananya@example.com" } })).id,
    address: {
      name: "Ananya Shah",
      phone: "9810011122",
      line1: "12 Nizamuddin East",
      line2: "",
      city: "New Delhi",
      state: "Delhi",
      pin: "110013",
    },
    paymentMethod: "cod",
    customerNote: "Please call before the courier arrives.",
  });
  console.log(`Seeded order ${placed.order.number} for ${store.name}. Platform user ${platform.email}.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
