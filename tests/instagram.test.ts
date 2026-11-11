import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanInstagramHandle, instagramReelEmbed } from "../src/lib/instagram";

describe("instagram reels", () => {
  it("keeps a public handle and drops a password-like string", () => {
    assert.equal(cleanInstagramHandle(" @Varanasi.Weave "), "Varanasi.Weave");
    assert.equal(cleanInstagramHandle("not a password!"), "notapassword");
  });

  it("embeds a reel link and rejects other sites", () => {
    assert.equal(
      instagramReelEmbed("https://www.instagram.com/reel/AbC123_x/?igsh=1"),
      "https://www.instagram.com/reel/AbC123_x/embed",
    );
    assert.equal(instagramReelEmbed("https://www.instagram.com/varanasiweave/"), null);
    assert.equal(instagramReelEmbed("https://example.com/reel/AbC123"), null);
  });
});
