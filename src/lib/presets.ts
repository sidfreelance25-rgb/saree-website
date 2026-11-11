export type ThemePreset = {
  id: string;
  label: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  ink: string;
  card: string;
  headingFont: string;
  bodyFont: string;
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "banaras",
    label: "Banaras maroon",
    primary: "#6E2433",
    secondary: "#C6A15B",
    accent: "#8C4A2F",
    background: "#F6F1E8",
    ink: "#1A1412",
    card: "#FFFCF7",
    headingFont: "Fraunces",
    bodyFont: "Outfit",
  },
  {
    id: "kanchi",
    label: "Kanchi temple",
    primary: "#143024",
    secondary: "#B08D57",
    accent: "#7A1F2B",
    background: "#F3F0EA",
    ink: "#12151A",
    card: "#FFFDF8",
    headingFont: "Fraunces",
    bodyFont: "Outfit",
  },
  {
    id: "indigo",
    label: "Indigo yard",
    primary: "#1C2E4A",
    secondary: "#C47B4A",
    accent: "#3E6B8A",
    background: "#F4F1EC",
    ink: "#14181F",
    card: "#FFFcf8",
    headingFont: "Fraunces",
    bodyFont: "Outfit",
  },
];

export function presetById(id: string) {
  return THEME_PRESETS.find((preset) => preset.id === id) ?? THEME_PRESETS[0];
}

export const ATTRIBUTE_FIELDS = [
  ["sareeType", "Saree type"],
  ["fabric", "Fabric"],
  ["weave", "Weave"],
  ["work", "Work"],
  ["color", "Colour"],
  ["pattern", "Pattern"],
  ["occasion", "Occasion"],
  ["length", "Saree length"],
  ["blouse", "Blouse piece"],
  ["origin", "Origin"],
  ["care", "Care"],
  ["dispatch", "Dispatch"],
] as const;

export const DEFAULT_VISIBLE = ATTRIBUTE_FIELDS.map(([key]) => key).join(",");

export const DEFAULT_PAGES: { slug: string; title: string; body: string }[] = [
  {
    slug: "about",
    title: "About the house",
    body: "We work with weaving families and finish each saree in small lots. The store you are browsing belongs to one seller. Taana runs the software. The cloth, the prices, and the promises are theirs.",
  },
  {
    slug: "contact",
    title: "Contact",
    body: "Write to the store email or message the WhatsApp number in the footer. Orders are confirmed by the seller before they are packed.",
  },
  {
    slug: "shipping",
    title: "Shipping policy",
    body: "Ready sarees dispatch in 1–2 working days. Made-to-order sarees show their lead time on the product page. Delivery is estimated from the PIN code you enter at checkout. Shipping is flat, and it is free above the threshold shown in your cart.",
  },
  {
    slug: "returns",
    title: "Returns and exchanges",
    body: "Unworn sarees with the blouse piece intact can be requested for return inside the store's return window, counted from delivery. Made-to-order and washed pieces are excluded. The seller approves or declines with a reason.",
  },
  {
    slug: "privacy",
    title: "Privacy",
    body: "We store the name, phone, email, and address you give us so the seller can fulfil the order. Payment card numbers are never stored. You can ask for account deletion from your account page. Marketing messages are sent only if you opt in.",
  },
  {
    slug: "terms",
    title: "Terms",
    body: "A confirmed order is an agreement between you and the store named on the invoice. Colours on a screen are a guide. Handloom sarees can vary slightly from the photograph in the way the zari catches light.",
  },
  {
    slug: "saree-guide",
    title: "Saree guide",
    body: "A standard saree with blouse piece is about 5.5 to 6.3 metres. Katan and Kanjeevaram are usually dry-clean only. If a blouse piece is included it is unstitched unless the product says otherwise. Measure the blouse length on the product page before you order stitching.",
  },
];
