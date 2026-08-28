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
import os
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
