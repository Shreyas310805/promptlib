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


COUNT_RE = re.compile(r'(data-count-to=")(\d+)(")')


def live_counts():
    """Read the real figures out of the generated data files.

    The homepage prints these as headline numbers, and nothing else on that
    page loads the datasets (they were dropped from index.html to save 96KB),
    so without this they would silently drift the first time a prompt is
    added or a category renamed.
    """
    def read(name):
        path = os.path.join(BASE, name)
        return open(path, encoding="utf-8").read() if os.path.exists(path) else ""

    img = read("prompts-image.js")
    txt = read("prompts-text.js")

    image_prompts = img.count('"slug":')
    text_templates = txt.count('"filename":')
    image_cats = len(set(re.findall(r'"cat": "([^"]+)"', img)))

    # Per category, not globally: 'Structure' is a tag under both ppt and
    # report, and they are separate filters on separate pages. A global set
    # would merge them and undercount what a visitor can actually filter by.
    text_tags = 0
    for block in re.findall(r"^  (\w+): \[(.*?)^  \]", txt, re.S | re.M):
        text_tags += len(set(re.findall(r'"tag": "([^"]+)"', block[1])))

    return [image_prompts, text_templates, image_cats + text_tags]


def sync_counts(text, counts):
    """Rewrite data-count-to values in document order, leaving any extras
    (the $0 cost figure) untouched."""
    it = iter(counts)

    def swap(m):
        try:
            return m.group(1) + str(next(it)) + m.group(3)
        except StopIteration:
            return m.group(0)

    return COUNT_RE.sub(swap, text)


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

/* Five for the featured composition -- one dominant, two secondary, two
   supporting -- and three more for the picks. Taken from the rotation, so
   no two neighbours come from the same category. */
const feature   = rota.slice(0,5).map(slim);
const pickImgs  = rota.slice(5,8).map(slim);

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
  trending, imageCats, textCats, totals, feature, pickImgs, textPicks
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
    emit("featurePrompts", data.get("feature", []),
         "/* The featured composition: [0] is the dominant tile, [1] and [2]\n"
         "   the secondary pair, [3] and [4] the supporting row. */")
    emit("trendingPrompts", data.get("trending", []),
         "/* Flagged trending:true in prompts-image.js. */")
    emit("pickPrompts", data.get("pickImgs", []),
         "/* Editor's picks — image half. */")
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

    for path in pages:
        name = os.path.basename(path)
        with open(path, encoding="utf-8", newline="") as f:
            original = f.read()

        if not BLOCK_RE.search(original):
            unmarked.append(name)
            continue

        updated = apply_to(original, partials, name)
        if COUNT_RE.search(updated):
            updated = sync_counts(updated, live_counts())
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
