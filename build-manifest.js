/* ==================================================================
   build-manifest.js — records which gallery thumbnails actually exist.

   WHY THIS EXISTS
   ---------------
   The gallery has 266 cards. Thumbnails are optional: a card falls back to
   its gradient swatch when images/<slug>.jpg is missing. But the page cannot
   know what is missing without asking, so it used to emit all 266 <img> tags
   and let the browser discover the 404s one at a time. On a fresh deploy —
   images/ is gitignored, so that is the normal case — that is 266 failed
   requests per visitor, and 266 red lines in their console.

   This writes images/manifest.js listing the slugs that are present. The
   gallery reads it and only emits <img> for those, so a site with no
   thumbnails makes no thumbnail requests at all.

   USAGE
   -----
     node build-manifest.js

   fetch-stock.js and generate-images.js call this automatically when they
   finish, so you only need to run it by hand if you added or deleted files
   in images/ yourself.

   If images/manifest.js is deleted entirely the gallery falls back to its old
   optimistic behaviour (emit every <img>, let missing ones 404), so nothing
   silently disappears — you just lose the saved requests.
   ================================================================== */

const fs = require("fs");
const path = require("path");

const IMAGES_DIR = path.join(__dirname, "images");
const MANIFEST_FILE = path.join(IMAGES_DIR, "manifest.js");

/* Extensions the gallery can actually display. The <img> src is always .jpg
   (see generate-images.js), so only .jpg counts toward the manifest. */
const THUMB_EXT = ".jpg";

function listThumbnailSlugs(){
  if(!fs.existsSync(IMAGES_DIR)) return [];
  return fs.readdirSync(IMAGES_DIR)
    .filter((name) => name.toLowerCase().endsWith(THUMB_EXT))
    .map((name) => name.slice(0, -THUMB_EXT.length))
    .sort();
}

function writeManifest(){
  if(!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

  const slugs = listThumbnailSlugs();
  const body = [
    "/* ==================================================================",
    "   manifest.js — GENERATED, do not edit by hand.",
    "",
    "   Slugs of the thumbnails present in this folder. images.html reads this",
    "   so it only requests thumbnails that exist instead of 404ing on all 266.",
    "",
    "   Regenerate after adding or removing files here:",
    "       node build-manifest.js",
    "   ================================================================== */",
    "window.imageManifest = [",
    ...slugs.map((slug) => `  ${JSON.stringify(slug)},`),
    "];",
  ].join("\n") + "\n";

  fs.writeFileSync(MANIFEST_FILE, body, "utf8");
  return slugs.length;
}

module.exports = { writeManifest, listThumbnailSlugs };

/* Run directly, rather than being required by the other two scripts. */
if(require.main === module){
  const count = writeManifest();
  console.log(`Wrote images/manifest.js with ${count} thumbnail(s).`);
  if(!count){
    console.log("No .jpg files in images/ yet — the gallery will show gradient swatches.");
    console.log("Populate it with:  node fetch-stock.js   (free)");
    console.log("               or:  node generate-images.js   (Gemini, costs money)");
  }
}
