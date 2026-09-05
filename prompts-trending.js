/* ==================================================================
   prompts-trending.js — GENERATED, do not edit by hand.

   The homepage's data module. index.html does not load
   prompts-image.js: it is 112KB, and the page shows about two dozen
   of those 273 entries. This carries exactly the subset it renders,
   plus category counts and totals, all counted from the real data.

   Regenerate with:  python3 build_pages.py
   ================================================================== */

/* Every figure below is counted, not estimated. */
window.libraryStats = {"prompts": 729, "images": 273, "text": 456, "categories": 14, "thumbnails": 266};

/* Ordered by size. `cover` is a prompt in that category that has a
   render on disk, so the hover reveal shows real output. */
window.libraryCategories = [
  {"name": "Traditional Media", "count": 38, "kind": "image", "href": "images.html?cat=Traditional%20Media", "cover": "watercolor-painting", "sample": "Watercolor Painting"},
  {"name": "Photography & Camera", "count": 36, "kind": "image", "href": "images.html?cat=Photography%20%26%20Camera", "cover": "4k-ultra-sharp", "sample": "4K Ultra Sharp"},
  {"name": "Illustration & Animation", "count": 32, "kind": "image", "href": "images.html?cat=Illustration%20%26%20Animation", "cover": "hand-painted-anime-film", "sample": "Hand-Painted Anime Film"},
  {"name": "Art Movements", "count": 32, "kind": "image", "href": "images.html?cat=Art%20Movements", "cover": "renaissance-oil", "sample": "Renaissance Oil"},
  {"name": "Digital & Glitch", "count": 28, "kind": "image", "href": "images.html?cat=Digital%20%26%20Glitch", "cover": "glitch-art", "sample": "Glitch Art"},
  {"name": "Scene & Setting", "count": 28, "kind": "image", "href": "images.html?cat=Scene%20%26%20Setting", "cover": "outer-space", "sample": "Outer Space"},
  {"name": "Portrait Makeover", "count": 28, "kind": "image", "href": "images.html?cat=Portrait%20Makeover", "cover": "professional-headshot", "sample": "Professional Headshot"},
  {"name": "Material & Sculpture", "count": 22, "kind": "image", "href": "images.html?cat=Material%20%26%20Sculpture", "cover": "made-of-glass", "sample": "Made of Glass"},
  {"name": "Practical Edits", "count": 22, "kind": "image", "href": "images.html?cat=Practical%20Edits", "cover": "white-background-product", "sample": "White Background Product"},
  {"name": "Featured Concepts", "count": 7, "kind": "image", "href": "images.html?cat=Featured%20Concepts", "cover": null, "sample": "Younger Self"},
  {"name": "Slides & decks", "count": 114, "kind": "text", "href": "ppt.html", "cover": null, "sample": "Structure · Slides & visuals · Delivery"},
  {"name": "Essays", "count": 114, "kind": "text", "href": "essay.html", "cover": null, "sample": "Planning · Drafting · Revision"},
  {"name": "Reports", "count": 114, "kind": "text", "href": "report.html", "cover": null, "sample": "Structure · Analysis · Recommendations"},
  {"name": "Emails", "count": 114, "kind": "text", "href": "email.html", "cover": null, "sample": "Outreach · Workplace · Difficult"},
];

/* The featured composition: [0] is the dominant tile, [1] and [2]
   the secondary pair, [3] and [4] the supporting row. */
window.featurePrompts = [
  {"style": "Watercolor Painting", "cat": "Traditional Media", "slug": "watercolor-painting", "input": "1 photo", "size": "tall", "prompt": "Transform the uploaded photo into a soft watercolor painting with bleeding edges, visible paper texture and translucent washes. Keep the subject's pose, proportions and facial features clearly recognisable, and preserve the original composition.", "thumb": true},
  {"style": "Hand-Painted Anime Film", "cat": "Illustration & Animation", "slug": "hand-painted-anime-film", "input": "1 photo", "size": "", "prompt": "Convert the attached photo into a hand-painted anime film frame with soft cel shading, detailed painted backgrounds and warm natural light. Keep the subject's identity, pose and clothing recognisable while simplifying detail to suit the style.", "thumb": true},
  {"style": "4K Ultra Sharp", "cat": "Photography & Camera", "slug": "4k-ultra-sharp", "input": "1 photo", "size": "", "prompt": "Redraw this photo as an ultra-sharp 4K photograph with crisp micro-detail and clean natural colour. Keep the subject and composition exactly as they are — change only the photographic treatment.", "thumb": true},
  {"style": "Glitch Art", "cat": "Digital & Glitch", "slug": "glitch-art", "input": "1 photo", "size": "short", "prompt": "Redraw this photo as glitch art with corrupted digital artifacts, displaced scanlines and colour channel bleed. Keep the underlying subject readable beneath the effect so it stays identifiable.", "thumb": true},
  {"style": "Renaissance Oil", "cat": "Art Movements", "slug": "renaissance-oil", "input": "1 photo", "size": "", "prompt": "Convert the attached photo into a Renaissance oil painting with balanced composition, soft modelling and warm varnished tone. Keep the subject's pose and the overall composition intact while adopting the movement's visual language.", "thumb": true},
];

/* Flagged trending:true in prompts-image.js. */
window.trendingPrompts = [
  {"style": "Younger Self", "cat": "Featured Concepts", "slug": "younger-self", "input": "2 photos", "size": "short", "prompt": "A conceptual split-era Polaroid photograph featuring the person from your first uploaded image (current self) sitting on a weathered park bench beside the person from your second uploaded image (younger self). They are holding ice cream cones and sharing a laugh. Medium: 2000s instant film with a white Polaroid border. Lighting: hard direct flash. Style: faded pastel colour grading, heavy film grain, slight light leaks. CRITICAL: strict facial identity transfer — the first image's face onto the older figure, the second image's face onto the younger figure.", "thumb": false},
  {"style": "35mm Night Street", "cat": "Featured Concepts", "slug": "35mm-night-street", "input": "1 photo", "size": "", "prompt": "Restage the uploaded photo as a cinematic 35mm film street photograph in a narrow, rainy alley at midnight. Subject: the person from the photo walking away holding a clear plastic umbrella. Lighting: vibrant neon signage reflecting in wet cobblestone puddles, moody low-key lighting. Style: authentic movie still, heavy film grain, saturated film emulation, halation blooming around the lights. Keep the subject's build, hair and clothing recognisable.", "thumb": false},
  {"style": "Medium Format Portrait", "cat": "Featured Concepts", "slug": "medium-format-portrait", "input": "1 photo", "size": "tall", "prompt": "Restyle the uploaded portrait as a dreamy, slightly overexposed close-up shot on 120mm medium format film, with the subject making direct eye contact. Lighting: intense golden hour glow, heavy amber light leaks, soft halation. Texture: authentic film dust and scratches, 1970s aesthetic. Enforce strict facial consistency with the uploaded face — alter only the lighting, grade and framing.", "thumb": false},
  {"style": "Cozy Room", "cat": "Featured Concepts", "slug": "cozy-room", "input": "no photo", "size": "short", "prompt": "An interior environment design of a cosy, cluttered bedroom. Style: hand-painted 2D anime art, detailed linework, painterly backgrounds. Details: overgrown potted plants on the windowsill, towering shelves of old books, scattered papers and mugs. Lighting: warm volumetric sunlight streaming through a large bay window. Colour palette: soft pastels, lush greens.", "thumb": false},
  {"style": "Infinite Field", "cat": "Featured Concepts", "slug": "infinite-field", "input": "no photo", "size": "", "prompt": "A vast, ultra-wide landscape shot of a lone young explorer standing in an endless, rolling field of vibrant wildflowers. Background: giant fluffy cumulonimbus clouds against a bright blue sky. Style: hand-drawn 2D animation, traditional painterly textures, cel-shaded, soft natural light.", "thumb": false},
  {"style": "Magical Train", "cat": "Featured Concepts", "slug": "magical-train", "input": "no photo", "size": "", "prompt": "An interior POV perspective from a vintage train carriage travelling seamlessly across a shallow, glowing ocean at sunset. Style: 1990s anime aesthetic, hand-painted watercolour backgrounds. Lighting: warm golden-hour light flooding the cabin, reflective water surface. Mood: dreamy, surreal, melancholic.", "thumb": false},
  {"style": "90s Cyberpunk Cafe", "cat": "Featured Concepts", "slug": "90s-cyberpunk-cafe", "input": "no photo", "size": "tall", "prompt": "A retro 1990s anime screenshot of an underground futuristic hacker cafe. Elements: glowing green CRT monitors, messy cable runs, overflowing ashtrays. Style: vintage cyberpunk anime, cel-shaded animation, authentic VHS tracking artifacts, static noise, scanlines. Colour palette: neon magenta, cyan, deep shadows.", "thumb": false},
];

/* Editor's picks — image half. */
window.pickPrompts = [
  {"style": "Outer Space", "cat": "Scene & Setting", "slug": "outer-space", "input": "1 photo", "size": "", "prompt": "Take the subject from the uploaded photo and present it floating in outer space with stars, nebula colour and rim lighting from a distant sun. Keep the subject unchanged and replace only the surroundings. Match the lighting on the subject to the new environment.", "thumb": true},
  {"style": "Professional Headshot", "cat": "Portrait Makeover", "slug": "professional-headshot", "input": "1 photo", "size": "short", "prompt": "Convert the attached photo into a clean professional headshot with soft studio lighting and a neutral background. Keep the person's facial features, skin tone and expression clearly recognisable.", "thumb": true},
  {"style": "Made of Glass", "cat": "Material & Sculpture", "slug": "made-of-glass", "input": "1 photo", "size": "", "prompt": "Recreate the subject from the uploaded photo as if it were sculpted from clear glass with refractive highlights and internal reflections. Keep the silhouette, pose and proportions intact so the subject stays recognisable.", "thumb": true},
];

/* Editor's picks — writing half, one per category. */
window.textPicks = [
  {"cat": "Slides & decks", "href": "ppt.html", "key": "ppt", "filename": "ppt_001.txt", "tag": "Structure", "prompt": "Draft a [number]-slide skeleton for a [duration]-minute talk on [topic] to [audience], giving each slide a headline that states a claim rather than a label, plus a one-line note on what that slide must prove."},
  {"cat": "Essays", "href": "essay.html", "key": "essay", "filename": "essay_001.txt", "tag": "Planning", "prompt": "Narrow the broad topic [topic] into [number] essay-sized angles that could each be argued in [word count] words, and note for each one what kind of evidence it would demand. Assume a [course level] reader."},
  {"cat": "Reports", "href": "report.html", "key": "report", "filename": "report_001.txt", "tag": "Structure", "prompt": "Draft terms of reference for a [report type] report on [topic], covering purpose, scope, key questions, deliverables and a deadline of [date]. Keep each section to three sentences and flag any assumption that needs sign-off from [stakeholder]."},
  {"cat": "Emails", "href": "email.html", "key": "email", "filename": "email_001.txt", "tag": "Outreach", "prompt": "Write a cold outreach email to a [job title] at [company] introducing [product or service], opening with a specific observation about their business instead of a compliment. Keep it under [word count] words and end with one low-friction ask."},
];
