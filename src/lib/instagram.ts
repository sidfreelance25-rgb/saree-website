export function cleanInstagramHandle(raw: string) {
  return raw.trim().replace(/^@/, "").replace(/[^a-zA-Z0-9._]/g, "").slice(0, 30);
}

export function instagramReelEmbed(permalink: string) {
  let url: URL;
  try {
    url = new URL(permalink.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.hostname !== "www.instagram.com" && url.hostname !== "instagram.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const kind = parts[0];
  const code = parts[1];
  if (!code || !["reel", "reels", "p", "tv"].includes(kind)) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(code)) return null;
  const path = kind === "reels" ? "reel" : kind;
  return `https://www.instagram.com/${path}/${code}/embed`;
}
