/* ==================================================================
   generate-images.js — fills images/ using Cloudflare Workers AI.

   RUN THIS ON YOUR OWN MACHINE ONLY. Never deploy it. Credentials come
   from .env, which is gitignored, so they never land in a file the
   browser downloads.

   WHAT IT MAKES
   -------------
   Every image prompt in this library restyles a photo you supply, so an
   example has to show BOTH halves to mean anything: the photo that went
   in, and what the prompt turned it into.

     images/base/<name>.jpg   the "before" photos, generated once
     images/<slug>.jpg        the "after" for each prompt

   A base photo is generated twice over: at 1024 for the site to display,
   and at 504 to feed back into the API. That second copy exists because
   the model refuses input images of 512x512 or larger. Same photograph
   either way, so the before and the after genuinely correspond.

   SETUP
   -----
   1. Node 18 or newer (check with: node --version)
   2. Python with Pillow, for the resizing and JPEG encoding. Already a
      dependency of this repo via build_pages.py.
   3. A .env in the repo root holding:

        CLOUDFLARE_ACCOUNT_ID=...
        CLOUDFLARE_API_TOKEN=...

      The token needs the Workers AI read/run permission.

   USAGE
   -----
   node generate-images.js --bases          the base photos only
   node generate-images.js --only 5         the next 5 missing edits
   node generate-images.js                  every missing edit, until the
                                            daily budget runs out
   node generate-images.js --slugs a,b,c    redo these, overwriting
   node generate-images.js --force          redo everything (expensive)
   node generate-images.js --dry-run        plan only, spends nothing
   node generate-images.js --review         rebuild review.html, spends nothing
   node generate-images.js --short-prompts  generate from promptShort instead
   node generate-images.js --clashes        report material clashes, spends nothing

   BUDGET
   ------
   The free tier is 10,000 neurons a day, resetting at 00:00 UTC. This
   model bills 26.05 neurons per output 512x512 tile and 5.37 per input
   tile, so a 1024x1024 edit over one small input costs about 110 and the
   day holds roughly 85 of them once a safety margin is kept back.

   Spend is measured per call from the real width and height rather than
   assumed, logged to .image-usage.json (gitignored), and the run stops
   cleanly when the day is used up. Everything already on disk is
   skipped, so the next run picks up exactly where this one stopped.
   ================================================================== */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = __dirname;
const IMAGES_DIR = path.join(ROOT, "images");
const BASE_DIR = path.join(IMAGES_DIR, "base");
const USAGE_LOG = path.join(ROOT, ".image-usage.json");

const MODEL = "@cf/black-forest-labs/flux-2-klein-4b";

/* Billing, from the Workers AI pricing page. A tile is 512x512 and a
   partial tile counts as a whole one. */
const NEURONS_PER_OUTPUT_TILE = 26.05;
const NEURONS_PER_INPUT_TILE = 5.37;
const DAILY_NEURONS = 10000;
/* Stop here rather than at the ceiling: the last call of a day should
   fail because we chose to stop, not because the API cut us off
   mid-image. */
const SAFETY_MARGIN = 400;

const OUT_SIZE = 1024;      // what the site shows
const INPUT_SIZE = 504;     // must be < 512 in both axes
const JPEG_TARGET_BYTES = 250 * 1024;

const CONCURRENCY = 2;      // polite, and easy to reason about when resuming
const MAX_RETRIES = 4;

/* ------------------------------------------------------------------
   The base photographs

   Fictional people only, described as types rather than likenesses, and
   never a named or recognisable person.
   ------------------------------------------------------------------ */
const BASE_PHOTOS = {
  portrait: "A candid outdoor portrait of a fictional woman in her early thirties with shoulder-length dark curly hair, wearing a plain olive jacket, looking slightly off camera, soft overcast daylight, shallow depth of field, natural skin texture, unremarkable background of a blurred park. Ordinary documentary photograph, not a model, no styling.",
  portrait2: "A candid outdoor portrait of a fictional girl about nine years old with shoulder-length dark curly hair, wearing a plain yellow raincoat, looking slightly off camera, soft overcast daylight, shallow depth of field, natural skin texture, unremarkable background of a blurred park. Ordinary family snapshot, not a model.",
  street: "A quiet city street in late afternoon, wet pavement reflecting shopfront signage, a few anonymous pedestrians at a distance with faces not visible, parked cars, overhead tram wires, flat overcast light. Ordinary documentary photograph, no landmark, no readable brand names.",
  room: "A lived-in living room corner photographed in daylight: a linen sofa with a crumpled throw, a low wooden coffee table with a half-read book and a mug, a floor lamp, a rug with visible texture, plants on a windowsill. Natural window light, slightly untidy, ordinary interior photograph.",
  landscape: "A wide open landscape at mid-morning: rolling green hills under a big sky with broken cloud, a dirt track curving away toward a distant line of trees, dry grass in the foreground. Even natural light, no people, no buildings. Ordinary travel photograph.",
  pet: "A medium-sized short-haired brown dog sitting on a wooden floor indoors, head slightly tilted, looking toward the camera, soft window light from the left, a corner of a rug visible. Ordinary pet photograph, natural fur texture, no costume.",
  product: "A deep terracotta-orange matte glazed ceramic mug with a chunky handle and a visible glaze pool near the base, standing on a light grey concrete surface against a soft neutral background, lit by a single large softbox from the left with a gentle shadow to the right. Strongly coloured, clearly opaque, unmistakably fired clay. Simple product photograph, no branding, no text.",
  food: "A bowl of noodle soup on a dark wooden table photographed from a high angle, chopsticks resting across the rim, scattered herbs and a small dish of chilli beside it, warm side lighting. Ordinary food photograph, natural and slightly imperfect."
};

/* Which base photo a prompt gets. Read in order; the first match wins.
   The `input` field on a prompt says how MANY photos it needs, not which
   kind, so the choice is made from the category and then refined by slug.

   Slugs are hyphen-delimited, so the patterns match whole segments. Bare
   substrings put caricature on the dog, because "cari-CAT-ure" contains
   "cat", and there is a whole family of that mistake waiting in a list of
   273 names. */
const SEG = (...words) => new RegExp(`(^|-)(${words.join("|")})(-|$)`);

/* Named outright where the automatic rules get it wrong or where a prompt
   would otherwise land on a base that already looks like the answer. */
const BASE_OVERRIDE = {
  "cyberpunk-netrunner": "portrait",  // a netrunner is a person, not a street
  "caricature": "portrait",           // a caricature is of somebody
  "mug-mockup": "room",               // the product base IS a mug
  "made-of-neon-tubes": "product",    // a material edit, like its siblings
  "made-of-clay": "portrait",         // the product base IS fired clay
  "marble-bust": "portrait",          // a bust is of a person
  "bronze-statue": "portrait",
  "wax-figure": "portrait",
  "action-figure": "portrait",
  "toy-brick-minifigure": "portrait",
  "plush-toy": "pet",                 // a plush animal from a real animal
  "gingerbread-figure": "portrait",
  "balloon-sculpture": "pet",         // balloon animals are animals
  "food-photography": "food",
  "underwater-photography": "pet",    // a dog is a better swimmer than a mug
};

const SLUG_HINTS = [
  [SEG("food", "dish", "meal", "recipe", "cook"), "food"],
  [SEG("product", "packshot", "mockup", "bottle", "label"), "product"],
  [SEG("pet", "dog", "cat", "animal", "wildlife"), "pet"],
  [SEG("room", "interior", "kitchen", "bedroom", "cozy"), "room"],
  [SEG("street", "city", "urban", "neon", "noir", "cyberpunk", "rooftop"), "street"],
  [SEG("landscape", "mountain", "forest", "field", "sky", "drone", "aerial", "space", "dunes", "jungle"), "landscape"],
  [SEG("portrait", "headshot", "face", "selfie", "self"), "portrait"]
];

const CATEGORY_BASE = {
  "Portrait Makeover": "portrait",
  "Photography & Camera": "portrait",
  "Traditional Media": "portrait",
  "Art Movements": "portrait",
  "Illustration & Animation": "portrait",
  "Digital & Glitch": "street",
  "Scene & Setting": "landscape",
  "Material & Sculpture": "product",
  "Practical Edits": "product",
  "Featured Concepts": "portrait"
};

function baseFor(entry) {
  if (BASE_OVERRIDE[entry.slug]) return BASE_OVERRIDE[entry.slug];
  for (const [re, name] of SLUG_HINTS) if (re.test(entry.slug)) return name;
  return CATEGORY_BASE[entry.cat] || "portrait";
}

/* ------------------------------------------------------------------
   Material clashes

   A prompt that turns something into glass has nothing to show if the
   thing was already glass. The edit happens, the example proves
   nothing, and it is invisible in testing because the image is not
   wrong -- it is just uninformative.

   So each base photo declares what it is already made of, and every
   prompt naming a target material is checked against it before the run.
   ------------------------------------------------------------------ */
/* Only the SUBJECT's material counts. A portrait wears a cotton jacket, but
   rendering the whole picture as embroidery still transforms the face, the
   hair and the background, so the jacket does not make it invisible. What
   does make it invisible is the subject itself already being the answer:
   a fired-clay mug asked to become clay. */
const BASE_MATERIALS = {
  portrait:  { subject: ["skin", "hair"],        scene: ["fabric", "cotton", "foliage"] },
  portrait2: { subject: ["skin", "hair"],        scene: ["fabric", "cotton", "foliage"] },
  street:    { subject: ["concrete", "glass", "metal"], scene: ["asphalt", "water"] },
  room:      { subject: ["fabric", "wood"],      scene: ["paper", "plant"] },
  landscape: { subject: ["grass", "soil"],       scene: ["sky", "water"] },
  pet:       { subject: ["fur"],                 scene: ["wood"] },
  product:   { subject: ["ceramic", "clay"],     scene: ["concrete", "stone"] },
  food:      { subject: ["liquid", "ceramic"],   scene: ["wood"] }
};

/* The material a prompt is trying to produce, from its slug. */
function targetMaterial(slug) {
  const m = slug.match(/^made-of-(.+)$/);
  if (m) return m[1].replace(/-/g, " ");
  const named = {
    "marble-bust": "stone", "bronze-statue": "metal", "wax-figure": "wax",
    "stained-glass": "glass", "mosaic-tile": "ceramic", "papercraft-layers": "paper",
    "paper-collage": "paper", "sand-art": "sand", "embroidery": "fabric",
    "cross-stitch": "fabric", "claymation-frame": "clay", "plush-toy": "fabric",
    "gingerbread-figure": "candy", "balloon-sculpture": "rubber",
    "toy-brick-minifigure": "plastic", "wireframe-render": "wireframe"
  };
  return named[slug] || null;
}

function materialClash(entry) {
  const target = targetMaterial(entry.slug);
  if (!target) return null;
  const base = baseFor(entry);
  const have = (BASE_MATERIALS[base] || {}).subject || [];
  const head = target.split(" ")[0];
  const hit = have.find((mat) => target.includes(mat) || mat.includes(head));
  return hit ? { slug: entry.slug, target, base, already: hit } : null;
}

/* ------------------------------------------------------------------
   Arguments
   ------------------------------------------------------------------ */
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const FORCE = has("--force");
const BASES_ONLY = has("--bases");
const DRY_RUN = has("--dry-run");
const REVIEW = has("--review");
const SHORT_PROMPTS = has("--short-prompts");
const CLASHES = has("--clashes");

function valueOf(flag) {
  const i = args.indexOf(flag);
  return i === -1 ? null : args[i + 1];
}

/* `--only` with a missing or non-numeric value used to parse to NaN,
   which is falsy, so the slice was skipped and the FULL queue ran on a
   metered API. Validate rather than parse. */
const ONLY = (() => {
  if (!has("--only")) return null;
  const raw = valueOf("--only");
  const n = Number(raw);
  if (!raw || raw.startsWith("--") || !Number.isInteger(n) || n < 1) {
    console.error(`--only needs a positive whole number, got: ${raw === undefined ? "(nothing)" : raw}`);
    process.exit(1);
  }
  return n;
})();

const SLUGS = (() => {
  if (!has("--slugs")) return null;
  const raw = valueOf("--slugs");
  if (!raw || raw.startsWith("--")) {
    console.error("--slugs needs a comma-separated list of slugs");
    process.exit(1);
  }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
})();

/* ------------------------------------------------------------------
   Credentials
   ------------------------------------------------------------------ */
function loadEnv() {
  const file = path.join(ROOT, ".env");
  if (!fs.existsSync(file)) {
    console.error(".env not found in the repo root.");
    process.exit(1);
  }
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const ENV = loadEnv();
if (!ENV.CLOUDFLARE_ACCOUNT_ID || !ENV.CLOUDFLARE_API_TOKEN) {
  /* Names only. The values never reach stdout, a log file or an error. */
  console.error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must both be set in .env, and neither may be blank.");
  process.exit(1);
}
const API_URL = `https://api.cloudflare.com/client/v4/accounts/${ENV.CLOUDFLARE_ACCOUNT_ID}/ai/run/${MODEL}`;

/* ------------------------------------------------------------------
   Usage ledger
   ------------------------------------------------------------------ */
function today() {
  return new Date().toISOString().slice(0, 10); // UTC, matching the reset
}

function readUsage() {
  try {
    const j = JSON.parse(fs.readFileSync(USAGE_LOG, "utf8"));
    if (j.date === today()) return j;
  } catch (err) { /* no log yet, or last run was another day */ }
  return { date: today(), neurons: 0, calls: 0, images: [] };
}

function writeUsage(u) {
  fs.writeFileSync(USAGE_LOG, JSON.stringify(u, null, 2));
}

const tiles = (w, h) => Math.ceil(w / 512) * Math.ceil(h / 512);

function costOf(w, h, inputs) {
  return tiles(w, h) * NEURONS_PER_OUTPUT_TILE
       + inputs * tiles(INPUT_SIZE, INPUT_SIZE) * NEURONS_PER_INPUT_TILE;
}

/* ------------------------------------------------------------------
   Image work, handed to Pillow

   Node has no image codec of its own and this repo deliberately has no
   package.json, so resizing and re-encoding go through the Python that
   build_pages.py already needs.
   ------------------------------------------------------------------ */
const PY_RESIZE = `
import sys, io
from PIL import Image
src, dst, longest, target = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
im = Image.open(src).convert("RGB")
w, h = im.size
if max(w, h) > longest:
    s = longest / max(w, h)
    im = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
# Walk the quality down only as far as the size target needs.
for q in (92, 88, 84, 80, 76, 72, 68):
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=q, optimize=True, progressive=True)
    if buf.tell() <= target or q == 68:
        open(dst, "wb").write(buf.getvalue())
        print(f"{im.size[0]}x{im.size[1]} q{q} {buf.tell()}")
        break
`;

function writeJpeg(srcBuf, dst, longest, targetBytes) {
  const tmp = dst + ".tmp";
  fs.writeFileSync(tmp, srcBuf);
  try {
    const out = execFileSync("python", ["-c", PY_RESIZE, tmp, dst, String(longest), String(targetBytes)], {
      encoding: "utf8"
    });
    return out.trim();
  } finally {
    fs.unlinkSync(tmp);
  }
}

/* ------------------------------------------------------------------
   The API
   ------------------------------------------------------------------ */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Errors worth trying again: transport, 429, and 5xx. */
function transient(status, err) {
  if (err) return true;
  return status === 429 || (status >= 500 && status < 600);
}

async function generate({ prompt, width, height, inputs = [], seed }) {
  let lastErr = "unknown";
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const fd = new FormData();
    fd.append("prompt", prompt);
    fd.append("width", String(width));
    fd.append("height", String(height));
    if (seed !== undefined) fd.append("seed", String(seed));
    inputs.forEach((buf, i) => {
      fd.append(`input_image_${i}`, new Blob([buf], { type: "image/jpeg" }), `input_${i}.jpg`);
    });

    let res, err = null;
    try {
      res = await fetch(API_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${ENV.CLOUDFLARE_API_TOKEN}` },
        body: fd
      });
    } catch (e) {
      err = e;
    }

    if (!err && res.ok) {
      const j = await res.json();
      if (j.success && j.result && typeof j.result.image === "string") {
        return { buf: Buffer.from(j.result.image, "base64") };
      }
      lastErr = JSON.stringify(j.errors || j).slice(0, 200);
      /* A well-formed refusal is not going to succeed on a retry. */
      return { error: lastErr, fatal: true };
    }

    const status = err ? 0 : res.status;
    lastErr = err ? err.message : `HTTP ${status} ${(await res.text()).slice(0, 200)}`;

    /* A rate limit means the budget is gone, whatever our own count says.
       Stop the run rather than hammering it. */
    if (status === 429) return { error: lastErr, rateLimited: true };
    if (!transient(status, err)) return { error: lastErr, fatal: true };

    const wait = Math.min(30000, 1500 * 2 ** (attempt - 1));
    console.log(`      retry ${attempt}/${MAX_RETRIES} in ${Math.round(wait / 1000)}s — ${lastErr.slice(0, 80)}`);
    await sleep(wait);
  }
  return { error: lastErr };
}

/* ------------------------------------------------------------------
   Prompts
   ------------------------------------------------------------------ */
function loadPrompts() {
  const file = path.join(ROOT, "prompts-image.js");
  if (!fs.existsSync(file)) {
    console.error("prompts-image.js not found. Run build_prompts.py first.");
    process.exit(1);
  }
  global.window = {};
  require(file);
  const list = global.window.imagePrompts || [];
  if (!list.length) {
    console.error("prompts-image.js parsed but held no prompts.");
    process.exit(1);
  }
  return list;
}

/** The instruction sent for one prompt's example. */
function editInstruction(entry) {
  /* The site shows the long prompt. Whether the model does better with it
     is a separate question, measured rather than assumed, so either can be
     used for generation. */
  const body = SHORT_PROMPTS && entry.promptShort ? entry.promptShort : entry.prompt;
  return `${body}

Apply this transformation to the supplied photograph. Keep the subject, pose and composition of the original recognisable; change only the visual treatment.`;
}


/* ------------------------------------------------------------------
   Structural similarity, base against result

   A restyle should keep the composition: the watercolour of a portrait
   is still that portrait, in that pose, at that crop. When the model
   ignores the input photo and paints from the words alone, the layout
   goes with it -- and that is exactly the failure that is hard to catch
   by eye across 273 tiles but trivial to measure.

   Both images are reduced to an edge map, then to 16x16, each normalised
   to zero mean and unit variance, and correlated.

   Edges rather than brightness, because brightness lies. A day-to-night
   restyle inverts the tone of half the frame, which drove the luminance
   score for outer-space down to 0.19 even though its hills and track are
   pixel-for-pixel where they were; and two unrelated photographs that
   happen to share a bright top and dark bottom scored 0.46, which is a
   false pass. On edges those became 0.68 and -0.18.

   Measured on the first five: real restyles land between 0.68 and 0.95,
   unrelated images between -0.18 and -0.05. The 0.30 threshold sits in
   the gap with room on both sides.
   ------------------------------------------------------------------ */
const PY_CORR = `
import sys, math
from PIL import Image, ImageFilter

def edges(p):
    im = Image.open(p).convert("L").resize((128, 128), Image.LANCZOS)
    # Gradient magnitude, not brightness. A day-to-night restyle inverts the
    # tone of half the frame and tanks a luminance correlation even though the
    # composition is untouched; edges survive that and still collapse when the
    # picture is actually different.
    im = im.filter(ImageFilter.FIND_EDGES).resize((16, 16), Image.LANCZOS)
    v = list(im.tobytes())
    m = sum(v) / len(v)
    d = [x - m for x in v]
    n = math.sqrt(sum(x * x for x in d)) or 1.0
    return [x / n for x in d]

def change(a, b):
    # Mean absolute RGB difference. Near zero means the edit did nothing
    # visible, which is a different failure from ignoring the source and needs
    # its own warning: the picture is not wrong, it just proves nothing.
    x = list(Image.open(a).convert("RGB").resize((32, 32), Image.LANCZOS).tobytes())
    y = list(Image.open(b).convert("RGB").resize((32, 32), Image.LANCZOS).tobytes())
    return sum(abs(i - j) for i, j in zip(x, y)) / (len(x) * 255)

a, b = sys.argv[1], sys.argv[2]
ea, eb = edges(a), edges(b)
print(round(sum(x * y for x, y in zip(ea, eb)), 4), round(change(a, b), 4))
`;

/* Returns { match, change }: how much of the composition survived, and how
   much of the picture actually moved. They fail in opposite directions --
   a low match means the model ignored the photo, a low change means it
   barely touched it -- so both are needed. Calibrated on the first set:
   identical images score 0.000 change, and the subtlest real edit (glitch,
   whose artefacts are sparse) scores 0.049, so 0.03 separates them. */
function scorePair(basePath, resultPath) {
  try {
    const out = execFileSync("python", ["-c", PY_CORR, basePath, resultPath], { encoding: "utf8" });
    const [m, c] = out.trim().split(/\s+/).map(Number);
    return { match: m, change: c };
  } catch (err) {
    return { match: null, change: null };
  }
}
const MATCH_FLOOR = 0.30;   // below: ignored the base photo
const CHANGE_FLOOR = 0.03;  // below: nothing visibly happened

/* ------------------------------------------------------------------
   review.html

   Local only, gitignored, not linked from the site. Every prompt that
   has a result, beside the photograph it was made from and the prompt
   text that produced it, so a mismatch is obvious rather than something
   you have to go and look up.

   Image URLs carry the file's modification time. Without it the browser
   keeps showing whatever it cached under that name, which is exactly
   how a regenerated example can look unchanged -- the first thing to
   suspect when a thumbnail does not match its prompt.
   ------------------------------------------------------------------ */
function buildReview() {
  const prompts = loadPrompts();
  const stamp = (p) => {
    try { return Math.round(fs.statSync(p).mtimeMs); } catch (e) { return 0; }
  };

  const rows = prompts.map((p) => {
    const out = path.join(IMAGES_DIR, `${p.slug}.jpg`);
    if (!fs.existsSync(out)) return null;
    const noPhoto = p.input === "no photo";
    const two = p.input === "2 photos";
    const names = noPhoto ? [] : two ? ["portrait", "portrait2"] : [baseFor(p)];
    const first = names[0] ? path.join(BASE_DIR, `${names[0]}.jpg`) : null;
    const sc = first && fs.existsSync(first) ? scorePair(first, out) : { match: null, change: null };
    return { p, names, out, corr: sc.match, chg: sc.change };
  }).filter(Boolean);

  /* Worst first: the point of the page is finding the bad ones. */
  const ranked = rows.slice().sort((a, b) => {
    if (a.corr === null) return 1;
    if (b.corr === null) return -1;
    return a.corr - b.corr;
  });
  const ignored = ranked.filter((r) => r.corr !== null && r.corr < MATCH_FLOOR);
  const unchanged = ranked.filter((r) => r.chg !== null && r.chg < CHANGE_FLOOR);

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const card = ({ p, names, out, corr, chg }) => {
    const tooSame = chg !== null && chg < CHANGE_FLOOR;
    const cls = corr === null ? "" : tooSame ? " same" : corr < MATCH_FLOOR ? " bad" : corr < 0.5 ? " warn" : "";
    const score = corr === null ? "no base"
      : `match ${corr.toFixed(2)} · change ${chg.toFixed(2)}${tooSame ? " — nothing changed" : ""}`;
    return `
    <figure class="c${cls}" id="${esc(p.slug)}">
      <div class="pair">
        ${names.map((n) => `<img src="images/base/${n}.jpg?v=${stamp(path.join(BASE_DIR, n + ".jpg"))}" alt="before" loading="lazy">`).join("")}
        <img class="after" src="images/${esc(p.slug)}.jpg?v=${stamp(out)}" alt="after" loading="lazy">
      </div>
      <figcaption>
        <div class="head">
          <code>${esc(p.slug)}</code>
          <span class="score" title="structural match with the base photo">${score}</span>
        </div>
        <span class="meta">${esc(p.style)} &middot; ${esc(p.cat)} &middot; ${esc(p.input || "")}${names.length ? ` &middot; base: ${names.join("+")}` : " &middot; no base"}</span>
        <p class="prompt">${esc(p.prompt)}</p>
      </figcaption>
    </figure>`;
  };

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>PromptLib image review — ${rows.length} of ${prompts.length}</title>
<style>
 body{background:#0b0b0c;color:#eee;font:14px/1.55 system-ui,sans-serif;margin:0;padding:24px}
 h1{font-weight:500;font-size:20px;margin:0 0 4px}
 p.sub{color:#999;margin:0 0 8px;max-width:80ch}
 .flags{margin:0 0 22px;padding:12px 14px;border:1px solid #5a3a12;background:#1d1408;border-radius:8px;max-width:80ch}
 .flags b{color:#ffa62e}
 .flags code{cursor:pointer}
 .grid{display:grid;gap:22px;grid-template-columns:repeat(auto-fill,minmax(360px,1fr))}
 .c{margin:0;background:#141416;border:1px solid #2a2a2e;border-radius:10px;overflow:hidden;scroll-margin:20px}
 .c.warn{border-color:#5a4a12}
 .c.bad{border-color:#7a2a2a}
 .c.same{border-color:#2a5a7a}
 .flags.same{border-color:#123a5a;background:#081420}
 .flags.same b{color:#5fd8ff}
 .c.same .score{color:#5fd8ff}
 .pair{display:flex;gap:2px;background:#2a2a2e}
 .pair img{flex:1;min-width:0;width:100%;aspect-ratio:1;object-fit:cover;display:block}
 .after{outline:2px solid #ffa62e;outline-offset:-2px}
 figcaption{padding:10px 12px;display:flex;flex-direction:column;gap:6px}
 .head{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
 code{font:12px ui-monospace,monospace;color:#ffa62e;user-select:all}
 .score{font:12px ui-monospace,monospace;color:#777}
 .c.warn .score{color:#d9b23a}
 .c.bad .score{color:#ff7a7a}
 .meta{color:#999;font-size:12px}
 .prompt{margin:0;font:12px/1.6 ui-monospace,monospace;color:#bbb;background:#0d0d0f;border:1px solid #232327;border-radius:6px;padding:8px 10px;max-height:8.6em;overflow:auto}
</style></head><body>
<h1>Image review</h1>
<p class="sub">${rows.length} of ${prompts.length} prompts have a result. Left is the base photo, right (outlined) is the generated example, and the prompt that made it is underneath. The number is how much of the base photo's composition survived the restyle.</p>
${ignored.length ? `<p class="flags"><b>${ignored.length} ignored the base photo.</b> Match below ${MATCH_FLOOR.toFixed(2)} usually means the model painted from the words instead of the picture: ${ignored.map((r) => `<code>${esc(r.p.slug)}</code>`).join(", ")}</p>` : ""}
${unchanged.length ? `<p class="flags same"><b>${unchanged.length} changed almost nothing.</b> Change below ${CHANGE_FLOOR.toFixed(2)} means the result is nearly the base photo, so the example proves nothing even though it is not wrong: ${unchanged.map((r) => `<code>${esc(r.p.slug)}</code>`).join(", ")}</p>` : ""}
${!ignored.length && !unchanged.length ? `<p class="flags"><b>Nothing flagged.</b> Every result kept its composition and visibly changed.</p>` : ""}
<div class="grid">${ranked.map(card).join("")}</div>
</body></html>`;

  fs.writeFileSync(path.join(ROOT, "review.html"), html);
  console.log(`review.html written — ${rows.length} of ${prompts.length} prompts have a result`);
  console.log(`  ${ignored.length} ignored the base photo (match < ${MATCH_FLOOR})`);
  console.log(`  ${unchanged.length} changed almost nothing (change < ${CHANGE_FLOOR})`);
  const redo = [...new Set([...ignored, ...unchanged].map((r) => r.p.slug))];
  if (redo.length) console.log(`  --slugs ${redo.join(",")}`);
}

/* ------------------------------------------------------------------
   Runner
   ------------------------------------------------------------------ */
async function runQueue(jobs, usage) {
  let stopped = null;
  let done = 0;
  let idx = 0;

  const worker = async () => {
    while (idx < jobs.length && !stopped) {
      const job = jobs[idx++];
      const spend = costOf(job.width, job.height, job.inputs.length);

      if (usage.neurons + spend > DAILY_NEURONS - SAFETY_MARGIN) {
        stopped = "budget";
        return;
      }

      const res = await generate(job);
      if (res.rateLimited) { stopped = "rate-limit"; return; }
      if (res.error) {
        console.log(`  x  ${job.label} — ${res.error.slice(0, 120)}`);
        continue;
      }

      const info = writeJpeg(res.buf, job.dst, OUT_SIZE, JPEG_TARGET_BYTES);
      usage.neurons += spend;
      usage.calls += 1;
      usage.images.push(path.basename(job.dst));
      writeUsage(usage);
      done += 1;
      console.log(`  ok ${job.label.padEnd(34)} ${info}  [${Math.round(usage.neurons)}/${DAILY_NEURONS} neurons]`);
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
  return { done, stopped };
}

async function main() {
  fs.mkdirSync(BASE_DIR, { recursive: true });
  if (REVIEW) return buildReview();

  if (CLASHES) {
    const prompts = loadPrompts();
    const found = prompts.map(materialClash).filter(Boolean);
    const usage = {};
    prompts.forEach((p) => { const b = baseFor(p); usage[b] = (usage[b] || 0) + 1; });
    console.log("base photo usage:", JSON.stringify(usage));
    console.log(`
material clashes: ${found.length}`);
    found.forEach((c) => console.log(`  ${c.slug.padEnd(26)} wants ${c.target.padEnd(14)} but base/${c.base} is already ${c.already}`));
    if (!found.length) console.log("  none — no prompt targets a material its base photo already has");
    return;
  }
  const usage = readUsage();

  console.log(`PromptLib image generation — ${MODEL}`);
  console.log(`budget today (${usage.date} UTC): ${Math.round(usage.neurons)} of ${DAILY_NEURONS} neurons used\n`);

  /* ---- base photographs ---- */
  const baseJobs = [];
  for (const [name, prompt] of Object.entries(BASE_PHOTOS)) {
    const dst = path.join(BASE_DIR, `${name}.jpg`);
    if (fs.existsSync(dst) && !FORCE) continue;
    baseJobs.push({
      label: `base/${name}`,
      dst,
      prompt: `${prompt} Photorealistic, shot on a full-frame camera, natural colour.`,
      width: OUT_SIZE, height: OUT_SIZE, inputs: [], seed: 1000 + baseJobs.length
    });
  }

  if (baseJobs.length) {
    console.log(`base photographs: ${baseJobs.length} to make`);
    if (!DRY_RUN) {
      const r = await runQueue(baseJobs, usage);
      console.log(`  ${r.done} written${r.stopped ? ` — stopped (${r.stopped})` : ""}\n`);
      if (r.stopped) return finish(usage, r.stopped);
    }
  } else {
    console.log("base photographs: all present");
  }

  /* Every base photo also gets a small copy, because the model will not
     take an input image of 512x512 or more. */
  if (!DRY_RUN) {
    for (const name of Object.keys(BASE_PHOTOS)) {
      const src = path.join(BASE_DIR, `${name}.jpg`);
      const small = path.join(BASE_DIR, `${name}.in.jpg`);
      if (fs.existsSync(src) && (!fs.existsSync(small) || FORCE)) {
        writeJpeg(fs.readFileSync(src), small, INPUT_SIZE, 200 * 1024);
      }
    }
  }

  if (BASES_ONLY) return finish(usage, null);

  /* ---- the edits ---- */
  const prompts = loadPrompts();
  let queue = prompts.filter((p) => {
    const dst = path.join(IMAGES_DIR, `${p.slug}.jpg`);
    if (SLUGS) return SLUGS.includes(p.slug);
    if (FORCE) return true;
    return !fs.existsSync(dst);
  });
  if (ONLY) queue = queue.slice(0, ONLY);

  const jobs = queue.map((p) => {
    const noPhoto = p.input === "no photo";
    const two = p.input === "2 photos";
    const names = noPhoto ? [] : two ? ["portrait", "portrait2"] : [baseFor(p)];
    const inputs = names.map((n) => {
      const f = path.join(BASE_DIR, `${n}.in.jpg`);
      if (!fs.existsSync(f)) throw new Error(`missing base photo ${n}.in.jpg — run with --bases first`);
      return fs.readFileSync(f);
    });
    return {
      label: p.slug,
      dst: path.join(IMAGES_DIR, `${p.slug}.jpg`),
      /* With no photo to work from, the prompt describes the picture
         outright rather than an edit to make. */
      prompt: noPhoto ? p.prompt : editInstruction(p),
      width: OUT_SIZE, height: OUT_SIZE,
      inputs,
      base: names.join("+") || "(none)"
    };
  });

  const perJob = jobs.length ? costOf(OUT_SIZE, OUT_SIZE, jobs[0].inputs.length) : 0;
  const affordable = Math.max(0, Math.floor((DAILY_NEURONS - SAFETY_MARGIN - usage.neurons) / perJob));
  console.log(`\nedits: ${jobs.length} queued, about ${Math.round(perJob)} neurons each`);
  console.log(`today's remaining budget covers about ${affordable}\n`);

  if (DRY_RUN) {
    jobs.slice(0, 20).forEach((j) => console.log(`  ${j.label.padEnd(34)} <- ${j.base}`));
    if (jobs.length > 20) console.log(`  ... and ${jobs.length - 20} more`);
    return;
  }
  if (!jobs.length) return finish(usage, null);

  const r = await runQueue(jobs, usage);
  console.log(`\n${r.done} written${r.stopped ? ` — stopped (${r.stopped})` : ""}`);
  finish(usage, r.stopped);
}

function finish(usage, stopped) {
  const onDisk = fs.existsSync(IMAGES_DIR)
    ? fs.readdirSync(IMAGES_DIR).filter((f) => f.endsWith(".jpg")).length
    : 0;
  console.log(`\nresult images on disk: ${onDisk}`);
  console.log(`neurons used today: ${Math.round(usage.neurons)} of ${DAILY_NEURONS}`);
  if (stopped === "budget" || stopped === "rate-limit") {
    console.log("\nThe day's budget is spent. It resets at 00:00 UTC —");
    console.log("run the same command again then and it will carry on from here.");
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
