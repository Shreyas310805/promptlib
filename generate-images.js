/* ==================================================================
   generate-images.js — fills the images/ folder using the Gemini API.

   RUN THIS ON YOUR OWN MACHINE ONLY. Never deploy it, and never put your
   API key into any file the browser downloads (script.js, any .html).
   The key is read from an environment variable so it never lands in the code.

   SETUP
   -----
   1. Get a key:  https://aistudio.google.com/apikey
   2. Node 18 or newer (check with: node --version)
   3. From inside the promptlib folder, run:

        Mac / Linux:
          GEMINI_API_KEY=your_key_here node generate-images.js

        Windows PowerShell:
          $env:GEMINI_API_KEY="your_key_here"; node generate-images.js

   USAGE
   -----
   node generate-images.js              generate every missing image
   node generate-images.js --force      regenerate everything, overwriting
   node generate-images.js --only 3     only the first 3 missing (test run)
   node generate-images.js --needs-generation
                                        only the ~18 styles stock photos cannot
                                        show — pair this with fetch-stock.js

   Images are written as images/<style-slug>.jpg, which is exactly what the
   site looks for — no code changes needed afterward.

   COST WARNING: there are 266 prompts and images are billed individually.
   At roughly $0.04 per image a full run is about $10 — check current Gemini
   pricing yourself before starting, since rates change.

   ALWAYS start with:  node generate-images.js --only 1
   Confirm that one image looks right before running the rest. You can also fill
   the gallery gradually — missing thumbnails fall back to a colour swatch, so
   the site works fine with only some of them generated.
   ================================================================== */

const fs = require("fs");
const path = require("path");

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-3.1-flash-image";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const IMAGES_DIR = path.join(__dirname, "images");
const DELAY_MS = 2000;

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const NEEDS_GEN = args.includes("--needs-generation");
const onlyIdx = args.indexOf("--only");
const ONLY = onlyIdx !== -1 ? parseInt(args[onlyIdx + 1], 10) : null;

function slugify(str){
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Loads the same prompt file the website uses, so the two can never drift apart.
   Thumbnails are generated FROM the transformation prompt using a stock subject,
   so each card shows what that style looks like. */
const SAMPLE_SUBJECT = "a friendly portrait photo of a person standing outdoors in soft daylight";

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

/* The site's prompts assume a user-uploaded photo. For a thumbnail there is no
   upload, so we restate the prompt against a described sample subject. */
function thumbnailPrompt(entry){
  return `Create a single example image demonstrating this photo-editing style.
Start from this imagined source photo: ${SAMPLE_SUBJECT}.
Apply this transformation: ${entry.prompt}
Output only the finished transformed image, no text or captions.`;
}

async function generateOne(prompt){
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": API_KEY
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  if(!res.ok){
    const body = await res.text();
    throw new Error(`HTTP ${res.status} — ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p) => p.inlineData?.data);

  if(!imagePart){
    const textPart = parts.find((p) => p.text);
    throw new Error(textPart ? `No image returned. Model said: ${textPart.text.slice(0, 200)}` : "No image data in response");
  }

  return Buffer.from(imagePart.inlineData.data, "base64");
}

async function main(){
  if(!API_KEY){
    console.error("\nMissing GEMINI_API_KEY.\n");
    console.error("  Mac/Linux:  GEMINI_API_KEY=your_key node generate-images.js");
    console.error("  PowerShell: $env:GEMINI_API_KEY=\"your_key\"; node generate-images.js\n");
    console.error("Get a key at https://aistudio.google.com/apikey\n");
    process.exit(1);
  }

  if(!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

  const prompts = loadPrompts();
  console.log(`Loaded ${prompts.length} prompts from script.js`);

  let queue = prompts.map((p) => ({ ...p, slug: p.slug || slugify(p.style) }));

  if(!FORCE){
    const before = queue.length;
    queue = queue.filter((p) => !fs.existsSync(path.join(IMAGES_DIR, `${p.slug}.jpg`)));
    const skipped = before - queue.length;
    if(skipped) console.log(`Skipping ${skipped} that already exist (use --force to redo them)`);
  }

  /* --needs-generation targets only the styles stock photos can't demonstrate,
     which is the cheap way to complement a Pexels run. */
  if(NEEDS_GEN){
    const before = queue.length;
    queue = queue.filter((p) => p.stock === false);
    console.log(`Narrowed to ${queue.length} of ${before} that stock can't cover`);
  }

  if(ONLY) queue = queue.slice(0, ONLY);

  if(!queue.length){
    console.log("\nNothing to generate — all images already exist.\n");
    return;
  }

  console.log(`Generating ${queue.length} image(s) with ${MODEL}\n`);

  let ok = 0, failed = 0;

  for(let i = 0; i < queue.length; i++){
    const item = queue[i];
    const label = `[${i + 1}/${queue.length}] ${item.style}`;
    process.stdout.write(`${label} ... `);

    try {
      const buffer = await generateOne(thumbnailPrompt(item));
      fs.writeFileSync(path.join(IMAGES_DIR, `${item.slug}.jpg`), buffer);
      console.log(`saved images/${item.slug}.jpg`);
      ok++;
    } catch (err) {
      console.log(`FAILED — ${err.message}`);
      failed++;
    }

    if(i < queue.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\nDone. ${ok} generated, ${failed} failed.`);
  if(ok) console.log("Open images.html to see them.\n");
  if(failed) console.log("Re-run the script to retry just the failed ones.\n");
}

main().catch((err) => {
  console.error("\nUnexpected error:", err.message, "\n");
  process.exit(1);
});
