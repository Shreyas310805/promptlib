"""Keeps the shared chunks of the 8 HTML pages in sync from partials/.

WHY THIS EXISTS
---------------
The nav, the footer line and the shared <head> block were copy-pasted into
every page. Adding a nav link meant editing 8 files and hoping none drifted.

WHY IT WORKS THIS WAY
---------------------
The constraint is that the site stays plain HTML: no bundler, no npm, no
runtime injection that delays first paint, and every page must still work by
being opened straight off disk. So this is not a template engine and the
pages are not generated from scratch.

Instead each page keeps its full, hand-editable markup, and the shared regions
are fenced with marker comments:

    <!-- @partial nav -->
    ...machine-managed, do not edit here...
    <!-- @end nav -->

This script replaces what is between the markers with the matching file from
partials/. Everything outside them is yours and is never touched. The output
is committed, so a fresh clone needs no build step at all — you only run this
after editing a partial.

    python3 build_pages.py            rewrite pages from partials/
    python3 build_pages.py --check    report drift, change nothing, exit 1

--check is the useful one in CI or a pre-commit hook: it fails if a page has
drifted from its partial, which is what used to happen silently.
"""

import glob
import json
import os
import subprocess
import re
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
PARTIALS_DIR = os.path.join(BASE, "partials")

# <!-- @partial name --> ... <!-- @end name -->
BLOCK_RE = re.compile(
    r"(?P<open><!--[ ]@partial[ ](?P<name>[a-z0-9-]+)[ ]-->\n)"
    r"(?P<body>.*?)"
    r"(?P<close>[ \t]*<!--[ ]@end[ ](?P=name)[ ]-->)",
    re.DOTALL,
)


COUNT_RE = re.compile(r'(<span data-count="(?P<key>[a-z]+)">)([\d,]+)(</span>)')


def live_counts():
    """Read the real figures out of the data files.

    The homepage prints these in its opening line, and nothing on that page
    loads the datasets (they were dropped from index.html to save 200KB), so
    without this they would silently drift the first time a prompt is added.

    They are written into the MARKUP, not filled in by script, so the numbers
    are right with JavaScript off.
    """
    def read(name):
        path = os.path.join(BASE, name)
        return open(path, encoding="utf-8").read() if os.path.exists(path) else ""

    img = read("prompts-image.js")
    txt = read("prompts-text.js")
    return {
        "images": img.count('"slug":'),
        "text": txt.count('"filename":'),
    }


# Figures that cannot be wrapped in a span because they live in an
# attribute or in running prose. Each pattern keeps the number in its own
# group so only the digits are replaced.
COUNT_ATTRS = [
    # Anchored on the gallery input specifically. An unanchored
    # placeholder="Search N prompts" also matches the text CATEGORY pages,
    # whose N is 114 per category and has nothing to do with the image
    # total -- it rewrote all four to 273 the first time it ran.
    ("images", re.compile(r'(id="gallerySearch"[^>]*placeholder="Search )([\d,]+)( prompts)')),
    ("images", re.compile(r'(first &mdash; )([\d,]+)( image transformations)')),
    ("text",   re.compile(r'( and )([\d,]+)( fill-in-the-blank text templates)')),
]


def sync_counts(text, counts):
    """Rewrite every printed figure from the real data.

    Spans first, then the ones that cannot be spans: a placeholder lives in
    an attribute, and the about panel says the number in a sentence. Those
    two had drifted to 266 -- the count of thumbnails on disk, which is not
    the count of prompts -- and stayed wrong precisely because the sync only
    ever looked at spans.
    """

    def swap(m):
        n = counts.get(m.group("key"))
        return m.group(0) if n is None else m.group(1) + f"{n:,}" + m.group(4)

    text = COUNT_RE.sub(swap, text)
    for key, pat in COUNT_ATTRS:
        n = counts.get(key)
        if n is not None:
            text = pat.sub(lambda m, n=n: m.group(1) + f"{n:,}" + m.group(3), text)
    return text


TRENDING_OUT = "prompts-trending.js"


def write_trending():
    """Emit the homepage's data module.

    index.html deliberately does not load prompts-image.js — it is 112KB and
    the homepage displays a couple of dozen of those entries, not 273. So the
    subset it actually shows is generated here instead, together with real
    category counts and real totals.

    Everything below is SELECTED from the data, never written by hand: the
    picks are drawn by walking the categories in rotation, so the homepage
    never shows two neighbouring tiles from the same category and the
    selection changes on its own as the library grows. Only prompts with a
    render on disk are eligible for the image slots; the rest get the
    document treatment in the view.
    """
    src = os.path.join(BASE, "prompts-image.js")
    if not os.path.exists(src):
        return 0

    script = """
const fs=require('fs');
global.window={};require('./prompts-image.js');
const img=global.window.imagePrompts||[];
global.window={};
let txt={};
try{ require('./prompts-text.js'); txt=global.window.textPromptsData||{}; }catch(e){}

const have = fs.existsSync('images')
  ? new Set(fs.readdirSync('images').filter(f=>f.endsWith('.jpg')).map(f=>f.slice(0,-4)))
  : new Set();

const slim = p => ({ style:p.style, cat:p.cat, slug:p.slug, input:p.input,
                     size:p.size||'', prompt:p.prompt, thumb:have.has(p.slug) });

/* ---- category summary ------------------------------------------------ */
const byCat={};
img.forEach(p=>{ (byCat[p.cat]=byCat[p.cat]||[]).push(p); });

const imageCats = Object.entries(byCat).map(([name,list])=>{
  const cover = list.find(p=>have.has(p.slug));
  return { name, count:list.length, kind:'image',
           href:'images.html?cat='+encodeURIComponent(name),
           cover: cover ? cover.slug : null, sample: list[0].style };
}).sort((a,b)=>b.count-a.count);

const TEXT_META = {
  ppt:   { label:'Slides & decks',  href:'ppt.html'   },
  essay: { label:'Essays',          href:'essay.html' },
  report:{ label:'Reports',         href:'report.html'},
  email: { label:'Emails',          href:'email.html' }
};
const textCats = Object.entries(txt).map(([key,list])=>({
  name: (TEXT_META[key]||{}).label || key,
  count: list.length, kind:'text',
  href: (TEXT_META[key]||{}).href || (key+'.html'),
  cover: null,
  sample: [...new Set(list.map(p=>p.tag).filter(Boolean))].slice(0,3).join(' \u00b7 ')
})).sort((a,b)=>b.count-a.count);

/* ---- the rotation ----------------------------------------------------
   One pass takes the first renderable prompt of every category, the next
   takes the second, and so on. Slicing this list gives the hero, the wall
   and the picks a spread across the whole library rather than a run of
   near-identical styles from whichever category happens to be biggest. */
const byCatThumb={};
img.filter(p=>have.has(p.slug)).forEach(p=>{ (byCatThumb[p.cat]=byCatThumb[p.cat]||[]).push(p); });
const catNames=Object.keys(byCatThumb);
const rota=[];
for(let i=0;;i++){
  let any=false;
  for(const c of catNames){ const l=byCatThumb[c]; if(i<l.length){ rota.push(l[i]); any=true; } }
  if(!any) break;
}

/* Ten examples for the home page's image preview, taken from the
   rotation so no two neighbours come from the same category. Every one
   has a render on disk -- the preview is the shop window, so it is not
   the place for the seven with no example image yet. */
const examples = rota.slice(0,10).map(slim);

/* ---- trending --------------------------------------------------------- */
const trending = img.filter(p=>p.trending===true).map(slim);

/* ---- text picks -------------------------------------------------------
   One from each writing category. A text prompt has no title in the data,
   only a filename and a tag, so the view leads with the tag and the prompt
   itself rather than inventing a name for it. */
const textPicks = Object.entries(txt).map(([key,list])=>{
  const p=list[0]; if(!p) return null;
  return { cat:(TEXT_META[key]||{}).label||key, href:(TEXT_META[key]||{}).href||(key+'.html'),
           key, filename:p.filename, tag:p.tag||'', prompt:p.prompt };
}).filter(Boolean);

const totals = {
  prompts: img.length + Object.values(txt).reduce((a,b)=>a+b.length,0),
  images: img.length,
  text: Object.values(txt).reduce((a,b)=>a+b.length,0),
  categories: imageCats.length + textCats.length,
  thumbnails: have.size
};

process.stdout.write(JSON.stringify({
  trending, imageCats, textCats, totals, examples, textPicks
}));
"""
    dump = subprocess.run(["node", "-e", script],
        cwd=BASE, capture_output=True, text=True, encoding="utf-8",
    )
    if dump.returncode != 0:
        print("  ! could not read prompt data; skipping homepage module")
        print("   ", (dump.stderr or "").strip()[:200])
        return 0

    data = json.loads(dump.stdout or "{}")

    lines = [
        "/* ==================================================================",
        "   prompts-trending.js — GENERATED, do not edit by hand.",
        "",
        "   The homepage's data module. index.html does not load",
        "   prompts-image.js: it is 112KB, and the page shows about two dozen",
        "   of those 273 entries. This carries exactly the subset it renders,",
        "   plus category counts and totals, all counted from the real data.",
        "",
        "   Regenerate with:  python3 build_pages.py",
        "   ================================================================== */",
    ]

    def emit(name, rows, note=None):
        if note:
            lines.append("")
            lines.append(note)
        lines.append("window.%s = [" % name)
        for r in rows:
            lines.append("  " + json.dumps(r, ensure_ascii=False) + ",")
        lines.append("];")

    lines.append("")
    lines.append("/* Every figure below is counted, not estimated. */")
    lines.append("window.libraryStats = " + json.dumps(data.get("totals", {}), ensure_ascii=False) + ";")

    emit("libraryCategories", data.get("imageCats", []) + data.get("textCats", []),
         "/* Ordered by size. `cover` is a prompt in that category that has a\n"
         "   render on disk, so the hover reveal shows real output. */")
    emit("homeExamples", data.get("examples", []),
         "/* The home page's image preview. Ten renders, one per category\n"
         "   in rotation. */")
    emit("trendingPrompts", data.get("trending", []),
         "/* Flagged trending:true in prompts-image.js. */")
    emit("textPicks", data.get("textPicks", []),
         "/* Editor's picks — writing half, one per category. */")

    with open(os.path.join(BASE, TRENDING_OUT), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines) + "\n")
    return len(data.get("trending", []))


def load_partials():
    if not os.path.isdir(PARTIALS_DIR):
        sys.exit("partials/ not found — nothing to build from.")
    out = {}
    for path in sorted(glob.glob(os.path.join(PARTIALS_DIR, "*.html"))):
        name = os.path.splitext(os.path.basename(path))[0]
        with open(path, encoding="utf-8", newline="") as f:
            # Store without the trailing newline; the marker supplies it.
            out[name] = f.read().rstrip("\n")
    return out


def apply_to(text, partials, filename):
    missing = []

    def swap(m):
        name = m.group("name")
        if name not in partials:
            missing.append(name)
            return m.group(0)
        return m.group("open") + partials[name] + "\n" + m.group("close")

    result = BLOCK_RE.sub(swap, text)
    if missing:
        sys.exit(
            f"{filename}: no partials/{missing[0]}.html for marker '{missing[0]}'"
        )
    return result


def main():
    check_only = "--check" in sys.argv[1:]
    partials = load_partials()
    if not partials:
        sys.exit("partials/ is empty — nothing to build from.")

    pages = sorted(
        p for p in glob.glob(os.path.join(BASE, "*.html"))
    )
    changed, unmarked = [], []
    counts = live_counts()

    for path in pages:
        name = os.path.basename(path)
        with open(path, encoding="utf-8", newline="") as f:
            original = f.read()

        if not BLOCK_RE.search(original):
            unmarked.append(name)
            continue

        updated = apply_to(original, partials, name)
        # Unconditional. This used to be gated on the page containing a
        # data-count span, which meant the pages whose only figures live in
        # an attribute or a sentence were never synced at all -- which is
        # how the gallery came to advertise "Search 266 prompts" over 273.
        updated = sync_counts(updated, counts)
        if updated == original:
            continue

        changed.append(name)
        if not check_only:
            with open(path, "w", encoding="utf-8", newline="") as f:
                f.write(updated)

    print(f"partials: {', '.join(sorted(partials))}")
    print(f"pages scanned: {len(pages)}")
    if unmarked:
        print(f"  no markers (skipped): {', '.join(unmarked)}")

    if not check_only:
        n = write_trending()
        if n:
            print(f"  {TRENDING_OUT}: {n} trending prompt(s)")

    if check_only:
        if changed:
            print(f"\nDRIFTED from partials/: {', '.join(changed)}")
            print("Run: python3 build_pages.py")
            sys.exit(1)
        print("\nAll pages match partials/.")
        return

    if changed:
        print(f"  rewritten: {', '.join(changed)}")
    else:
        print("  already up to date")


if __name__ == "__main__":
    main()
