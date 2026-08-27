/* ==================================================================
   builder-data.js — keyword vocabulary for the prompt builder.

   Loaded only by builder.html.
   Pure templates — no API key, no network call. To add an option, just add a
   string to the relevant array; it appears in the dropdown automatically.
   Each entry is the literal phrase injected into the assembled prompt.
   ================================================================== */
window.builderOptions = {
  style: [
    "lush hand-painted watercolor style, soft bleeding edges, textured paper grain",
    "charcoal drawing, monochromatic smoky gradients, heavy shading",
    "traditional woodblock print, strong black outlines, flat color zones",
    "ink wash painting, fluid brushstrokes, varying opacity, negative space",
    "colored pencil sketch, visible textured linework, soft shading",
    "gouache painting, heavy opaque matte color, deep saturated tones",
    "oil painting with thick impasto brushstrokes, visible 3D relief",
    "linocut print, bold blocky negative space, raw chiseled edges",
    "stained glass, bold black leading, glowing translucent panes",
    "layered papercraft and origami, flat folded-paper shapes, 3D depth",
    "claymation stop-motion, molded clay texture, visible fingerprints",
    "embroidery, characters woven from visible threads and fabric texture",
    "fresco mural, cracked plaster texture, faded historical pigment",
    "1980s VHS home-video look, muted tones, chromatic aberration, scanlines",
    "city pop album-cover aesthetic, sleek 80s urban nightscape, neon reflections",
    "lo-fi aesthetic, high grain, low contrast, drifting dust particles",
    "Technicolor glow, oversaturated primaries, blooming halo around lights",
    "sepia-toned vintage photography, monochromatic brown tones",
    "8-bit pixel art, retro video game squares, limited palette",
    "16-bit JRPG pixel sprites, vibrant parallax background",
    "risograph print, misaligned two-color layers, visible grain",
    "art deco poster, bold geometric linework, metallic gold and teal",
    "art nouveau, whiplash curves, elegant floral framing",
    "low-poly 3D render, faceted geometric surfaces, flat shading",
    "vector illustration, ultra-clean geometric lines, flat color",
    "glitch art and datamoshing, corrupted artifacts, color-channel bleed",
    "psychedelic swirling neon palette, melting tie-dye distortion",
    "fisheye lens distortion, ultra-wide bulbous perspective",
    "heat-haze mirage, shimmering warping distortion",
    "steampunk, cluttered brass gears and rusted mechanical detail",
    "dieselpunk, dark oily heavy machinery under a grey sky",
    "cottagecore, cozy overgrown cabin, wildflowers, warm domestic detail",
    "dark fantasy, moody shadowy forest, pale spirits, gothic undertones",
    "cosmic horror, soft pastel depiction of colossal indifferent entities",
    "post-apocalyptic ruins reclaimed by vibrant green moss and trees",
    "biomechanical fusion of living tissue and vintage machinery",
    "chibi super-deformed proportions, oversized head, simple dot eyes",
    "liminal space, empty and unsettlingly quiet, flat even lighting"
  ],
  lighting: [
    "golden hour lighting, long warm shadows, amber light leaks",
    "blue hour, cool dusk tones, soft ambient glow",
    "overcast diffused light, shadowless and even",
    "dramatic god rays piercing heavy clouds",
    "bioluminescent glow, deep blues and indigos",
    "neon noir, blinding commercial neon against wet dark pavement",
    "harsh direct midday sun, hard-edged shadows",
    "soft studio lighting, single gentle shadow",
    "rim lighting, subject outlined against a dark background",
    "candlelight, warm flickering pools of light",
    "moonlight, cool silver highlights, deep shadow",
    "backlit silhouette, subject dark against bright haze"
  ],
  composition: [
    "cinematic wide shot",
    "extreme close-up",
    "overhead flat lay",
    "low angle looking up",
    "high angle looking down",
    "symmetrical centered composition",
    "rule-of-thirds off-center framing",
    "shallow depth of field, blurred background",
    "wide establishing landscape shot",
    "tight portrait crop",
    "over-the-shoulder view",
    "macro detail shot"
  ],
  mood: [
    "nostalgic and warm",
    "quiet and melancholy",
    "tense and ominous",
    "peaceful and serene",
    "energetic and chaotic",
    "dreamlike and surreal",
    "gritty and somber",
    "whimsical and playful",
    "epic and awe-inspiring",
    "lonely and isolated",
    "cozy and intimate",
    "cold and clinical"
  ],
  palette: [
    "muted earth tones",
    "vibrant jewel tones",
    "monochrome black and white",
    "teal and orange contrast",
    "soft pastel palette",
    "high-contrast primary colors",
    "desaturated washed-out tones",
    "warm amber and gold",
    "cool blues and greys",
    "neon magenta and cyan"
  ],
  finish: [
    "highly detailed, ultra sharp",
    "soft focus, gentle blur",
    "heavy film grain",
    "clean and minimal, lots of negative space",
    "richly textured surfaces",
    "glossy and reflective",
    "matte and flat",
    "painterly and loose"
  ]
};

/* Aspect ratios — the flag syntax differs per model, handled in buildPrompt(). */
window.builderRatios = ["1:1", "16:9", "9:16", "4:5", "3:2", "2:3"];
