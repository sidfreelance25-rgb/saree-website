"use client";

import { useState } from "react";
import { addInstagramReel } from "@/server/actions";
import { instagramReelEmbed } from "@/lib/instagram";

export function ReelForm() {
  const [videoUrl, setVideoUrl] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setPending(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/v1/admin/media", { method: "POST", body });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error || "Upload failed");
      setVideoUrl(data.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Upload failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={addInstagramReel} className="stack">
      <label className="field">
        <span>Reel link</span>
        <input name="permalink" required placeholder="https://www.instagram.com/reel/..." />
      </label>
      <label className="field"><span>Caption</span><input name="caption" placeholder="Wedding lot, March" /></label>
      <label className="field">
        <span>Video file, optional</span>
        <input type="file" accept="video/mp4,video/webm" onChange={(event) => onFile(event.target.files?.[0])} />
      </label>
      <input type="hidden" name="videoUrl" value={videoUrl} />
      {videoUrl && <video src={videoUrl} controls playsInline style={{ width: "100%", maxHeight: 360 }} />}
      {pending && <p className="muted">Uploading the video…</p>}
      {error && <p className="error">{error}</p>}
      <button className="btn" type="submit" disabled={pending}>Add reel</button>
    </form>
  );
}

export function ReelFrame({
  permalink,
  videoUrl,
  caption,
  imageUrl,
}: {
  permalink: string;
  videoUrl: string;
  caption: string;
  imageUrl: string;
}) {
  if (videoUrl.startsWith("/") && !videoUrl.includes("..")) {
    return <video src={videoUrl} poster={imageUrl || undefined} controls playsInline preload="metadata" />;
  }
  const embed = instagramReelEmbed(permalink);
  if (embed) {
    return (
      <iframe
        src={embed}
        title={caption || "Instagram reel"}
        loading="lazy"
        allow="encrypted-media; picture-in-picture"
      />
    );
  }
  if (imageUrl) {
    return (
      <a href={permalink} target="_blank" rel="noreferrer">
        <img src={imageUrl} alt={caption} />
      </a>
    );
  }
  return <a href={permalink}>Open on Instagram</a>;
}
