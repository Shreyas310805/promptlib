# PromptLib

A multi-page AI prompt library — browse image prompts as a gallery, browse text
prompt templates by category, and build your own prompt from keywords.

## Running it

No build step, no server needed. Keep all files together in one folder and open
`index.html` in a browser.

If you want to deploy it, any static host works (GitHub Pages, Netlify, Vercel).
Upload the whole folder as-is.

## Files

| File | What it is |
|---|---|
| `index.html` | Homepage with the animated hero demo |
| `images.html` | 266 image-to-image transformation prompts, filterable + searchable |
| `text.html` | Hub linking to the four text categories |
| `ppt.html` / `essay.html` / `report.html` / `email.html` | Text prompt category pages |
| `builder.html` | Keyword → prompt builder |
| `style.css` | All styling for every page |
| `script.js` | Text prompts, builder data, and all page logic |
| `prompts-image.js` | The 266 image prompts (generated — don't edit by hand) |
| `build_prompts.py` | Source of truth for image prompts; re-run to regenerate |
| `fetch-stock.js` | Bulk-download free stock thumbnails from Pexels |
| `generate-images.js` | Local script to fill `images/` via the Gemini API |
| `images/` | Gallery thumbnails + a README listing every filename |

## How the image prompts work

These are **image-to-image** prompts — the user uploads their own photo and the
prompt restyles it. Each one ends with a preservation clause ("keep the subject's
pose and facial features recognisable") because without it models drift away from
the original subject.

They're grouped into 9 categories: Traditional Media, Illustration & Animation,
Photography & Camera, Digital & Glitch, Art Movements, Scene & Setting, Portrait
Makeover, Material & Sculpture, and Practical Edits.

## Adding prompts

Everything lives in `script.js` at the top — no HTML editing needed.

- **Image prompt** → add a style to `CATALOG` in `build_prompts.py`, then run
  `python3 build_prompts.py`. Editing `prompts-image.js` directly gets
  overwritten on the next build.
- **Text prompt** → add `{filename, prompt}` to the right array in `textPromptsData`
- **Builder option** → add a string to the right array in `builderOptions`

Wrap fill-in-the-blank words in `[square brackets]` — they get highlighted
automatically.

## Adding gallery images

Two ways.

**Manually:** generate an image however you like, save it as
`images/<style-slug>.jpg`. The slug is the style name lowercased with hyphens —
"Stained Glass" becomes `stained-glass.jpg`. See `images/README.md` for the full
list of all 266 filenames grouped by category.

**Free stock, automated:** the fastest way to fill all 266.

```bash
PEXELS_API_KEY=your_key node fetch-stock.js --only 20
```

Free Pexels key at https://www.pexels.com/api/ — no card. Throttled to respect
their 200/hour limit, so a full run takes ~90 minutes; Ctrl+C and re-run resumes.
See `images/README.md` for all three sourcing options compared.

**With the Gemini API:** run the included script.

```bash
# Mac / Linux
GEMINI_API_KEY=your_key_here node generate-images.js

# Windows PowerShell
$env:GEMINI_API_KEY="your_key_here"; node generate-images.js
```

Options: `--only 1` to test with a single image first, `--force` to regenerate
ones that already exist. Requires Node 18+. Get a key at
https://aistudio.google.com/apikey

**Cost:** 266 images at roughly $0.04 each is about $10 for a full run. Verify
current pricing yourself before starting. Always do `--only 1` first.

Missing images fall back to a stock photo, then to a color swatch — the site
never shows a broken image, so you can fill these in gradually.

## About the API key

**Never put your API key in `script.js` or any `.html` file.** Those files are
downloaded by every visitor and readable through View Source. A leaked key can be
used by anyone, billed to you.

Two safe paths, both already set up:

1. `generate-images.js` reads the key from an environment variable and runs on
   your machine only. This is the right way to fill the gallery.
2. The "Generate a preview" panel on `builder.html` takes a key typed into the
   page at runtime. It stays in that browser tab and is never written to a file.

If you later add a backend (FastAPI etc.), keep the key server-side and have the
page call your endpoint instead.

Add a `.gitignore` with `.env` and any key files before pushing to GitHub.
