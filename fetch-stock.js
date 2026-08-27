/* ==================================================================
   fetch-stock.js — fills images/ with free stock photos from Pexels.

   This is the FREE, NO-COST way to populate the gallery thumbnails. It won't
   give you true examples of each style (a stock photo tagged "watercolor
   painting" is a real watercolor, but a photo tagged "4K ultra sharp" is just
   a sharp photo). For genuine style examples use generate-images.js instead,
   which costs money but produces the actual transformation.

   Many people do both: stock for the bulk, generated images for the styles
   that show up highest on the page.

   SETUP
   -----
   1. Free API key, instant, no card:  https://www.pexels.com/api/
   2. Node 18 or newer
   3. From inside the promptlib folder:

        Mac / Linux:
          PEXELS_API_KEY=your_key_here node fetch-stock.js

        Windows PowerShell:
          $env:PEXELS_API_KEY="your_key_here"; node fetch-stock.js

   USAGE
   -----
   node fetch-stock.js                 fetch every missing thumbnail
   node fetch-stock.js --only 20       just the first 20 missing (good first run)
   node fetch-stock.js --cat "Traditional Media"    one category only
   node fetch-stock.js --force         re-fetch even if the file exists

   RATE LIMIT: Pexels allows 200 requests per hour on a free key. There are 266
   prompts, so a full run is throttled to stay under that and takes roughly 90
   minutes. Use --only or --cat to do it in chunks instead. If you get rate
   limited the script stops cleanly and tells you to re-run later — already
   downloaded files are skipped, so re-running picks up where it left off.

   LICENCE: Pexels photos are free to use, including commercially. Crediting
   photographers is not required but is requested — images.html carries a Pexels
   credit line in the footer for this reason. Keep it if you use this script.
   Per-photo credits are appended to images/CREDITS.md, which is committed
   alongside the thumbnails.
   ================================================================== */

const fs = require("fs");
const path = require("path");
const { writeManifest } = require("./build-manifest");

const API_KEY = process.env.PEXELS_API_KEY;
const IMAGES_DIR = path.join(__dirname, "images");
const CREDITS_FILE = path.join(IMAGES_DIR, "CREDITS.md");

/* 200/hour ceiling → one request every 18.5s is the safe steady rate.
   Bump this down only if you have a raised limit from Pexels. */
const DELAY_MS = 18500;

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const onlyIdx = args.indexOf("--only");
const ONLY = onlyIdx !== -1 ? parseInt(args[onlyIdx + 1], 10) : null;
const catIdx = args.indexOf("--cat");
const CAT = catIdx !== -1 ? args[catIdx + 1] : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadPrompts(){
  const file = path.join(__dirname, "prompts-image.js");
  if(!fs.existsSync(file)){
    throw new Error("prompts-image.js not found — run: python3 build_prompts.py");
  }
  global.window = {};
  require(file);
  const list = global.window.imagePrompts;
  if(!Array.isArray(list) || !list.length){
    throw new Error("prompts-image.js did not define window.imagePrompts");
  }
  return list;
}

async function searchPhoto(query){
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=portrait`;
  const res = await fetch(url, { headers: { Authorization: API_KEY } });

  if(res.status === 429){
    const err = new Error("Rate limit reached");
    err.rateLimited = true;
    throw err;
  }
  if(!res.ok){
    throw new Error(`search failed — HTTP ${res.status}`);
  }

  const data = await res.json();
  const photo = data?.photos?.[0];
  if(!photo) throw new Error("no results for that search term");

  return {
    /* 'medium' is ~350px tall. Cards render at 230-360px, so 'large' (940px)
       was fetching roughly 8x the bytes needed and, since thumbnails are
       committed to the repo, would have bloated it to ~80MB instead of ~13MB. */
    url: photo.src?.medium || photo.src?.large || photo.src?.original,
    photographer: photo.photographer,
    link: photo.url
  };
}

async function download(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error(`download failed — HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main(){
  if(!API_KEY){
    console.error("\nMissing PEXELS_API_KEY.\n");
    console.error("  Mac/Linux:  PEXELS_API_KEY=your_key node fetch-stock.js");
    console.error("  PowerShell: $env:PEXELS_API_KEY=\"your_key\"; node fetch-stock.js\n");
    console.error("Free key, instant, no card needed: https://www.pexels.com/api/\n");
    process.exit(1);
  }

  if(!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

  let queue = loadPrompts();
  console.log(`Loaded ${queue.length} prompts`);

  /* Captured before filtering — loadPrompts() can't be called twice, since
     require() caches the module and window.imagePrompts is only set on first load. */
  const allCats = [...new Set(queue.map((p) => p.cat))];

  if(CAT){
    queue = queue.filter((p) => p.cat.toLowerCase() === CAT.toLowerCase());
    if(!queue.length){
      console.error(`\nNo category matching "${CAT}". Options:`);
      allCats.forEach((c) => console.error(`  ${c}`));
      process.exit(1);
    }
    console.log(`Filtered to category "${CAT}": ${queue.length}`);
  }

  if(!FORCE){
    const before = queue.length;
    queue = queue.filter((p) => !fs.existsSync(path.join(IMAGES_DIR, `${p.slug}.jpg`)));
    const skipped = before - queue.length;
    if(skipped) console.log(`Skipping ${skipped} already downloaded (--force to redo)`);
  }

  if(ONLY) queue = queue.slice(0, ONLY);

  if(!queue.length){
    console.log("\nNothing to fetch — all thumbnails already present.\n");
    return;
  }

  const mins = Math.ceil((queue.length * DELAY_MS) / 60000);
  console.log(`\nFetching ${queue.length} thumbnail(s). Throttled for the Pexels rate limit — about ${mins} min.`);
  console.log("Safe to stop with Ctrl+C at any point; re-running resumes.\n");

  const credits = [];
  let ok = 0, failed = 0;

  for(let i = 0; i < queue.length; i++){
    const item = queue[i];
    process.stdout.write(`[${i + 1}/${queue.length}] ${item.style} ... `);

    try {
      const photo = await searchPhoto(item.search);
      const buffer = await download(photo.url);
      fs.writeFileSync(path.join(IMAGES_DIR, `${item.slug}.jpg`), buffer);
      credits.push(`- ${item.style} — photo by ${photo.photographer} on Pexels (${photo.link})`);
      console.log(`saved (${photo.photographer})`);
      ok++;
    } catch (err) {
      if(err.rateLimited){
        console.log("RATE LIMITED");
        console.log(`\nHit the hourly cap after ${ok} downloads. Wait an hour and re-run —`);
        console.log("finished files are skipped automatically.\n");
        break;
      }
      console.log(`failed — ${err.message}`);
      failed++;
    }

    if(i < queue.length - 1) await sleep(DELAY_MS);
  }

  if(credits.length){
    const header = fs.existsSync(CREDITS_FILE)
      ? "\n"
      : "# Photo credits\n\nStock thumbnails from Pexels. Free to use, credit appreciated.\n\n";
    fs.appendFileSync(CREDITS_FILE, header + credits.join("\n") + "\n");
    console.log(`\nCredits appended to images/CREDITS.md`);
  }

  /* Refresh the manifest so images.html knows which thumbnails now exist —
     without this the gallery keeps showing gradient swatches for them. */
  const inManifest = writeManifest();
  console.log(`\nDone. ${ok} downloaded, ${failed} failed.`);
  console.log(`images/manifest.js now lists ${inManifest} thumbnail(s).`);
  if(ok) console.log("Open images.html to see them.\n");
}

main().catch((err) => {
  console.error("\nError:", err.message, "\n");
  process.exit(1);
});
