# Images folder

Thumbnails for the 266 image-transformation prompts. Drop a `.jpg` here
named exactly as listed below and it appears on the site automatically.

Missing files fall back to a colour swatch, so the site works fine with only
some of these filled in. Do the popular categories first.

After adding or removing files here by hand, run `node build-manifest.js`
from the project folder. It rewrites `manifest.js`, which tells the gallery
which thumbnails exist so it does not request the ones that do not.
`fetch-stock.js` and `generate-images.js` do this for you automatically.

## Three ways to fill this folder

### 1. Free stock photos (recommended to start)

Free Pexels API key, no card: https://www.pexels.com/api/

```bash
PEXELS_API_KEY=your_key node fetch-stock.js --only 20      # try 20 first
PEXELS_API_KEY=your_key node fetch-stock.js --cat "Traditional Media"
PEXELS_API_KEY=your_key node fetch-stock.js                # all of them
```

Free forever. Throttled to respect the 200-requests-per-hour limit, so a full
run takes about 90 minutes — Ctrl+C anytime, re-running resumes where it left off.

Caveat: stock photos approximate the style rather than demonstrate it. A photo
tagged "watercolor painting" really is a watercolor, but one tagged "4K ultra
sharp" is just a sharp photo.

### 2. AI-generated examples (costs money, looks best)

Gemini API key: https://aistudio.google.com/apikey

```bash
GEMINI_API_KEY=your_key node generate-images.js --only 1   # ALWAYS test one first
GEMINI_API_KEY=your_key node generate-images.js
```

Roughly $0.04 per image, so about $10 for all 266. These are true examples of
each transformation, so they sell the style far better than stock.

### 3. Manual, free

Generate images by hand and save them with the filenames below. Free options:
Bing Image Creator, Google AI Studio, Leonardo.ai daily credits, Craiyon.
Slow for 266, but fine for the handful at the top of the page.

## Filenames

### Traditional Media

- `watercolor-painting.jpg` — Watercolor Painting
- `oil-painting.jpg` — Oil Painting
- `impasto-oil.jpg` — Impasto Oil
- `acrylic-painting.jpg` — Acrylic Painting
- `gouache-illustration.jpg` — Gouache Illustration
- `pencil-sketch.jpg` — Pencil Sketch
- `detailed-graphite-portrait.jpg` — Detailed Graphite Portrait
- `colored-pencil.jpg` — Colored Pencil
- `charcoal-drawing.jpg` — Charcoal Drawing
- `conte-crayon.jpg` — Conte Crayon
- `ink-pen-hatching.jpg` — Ink Pen Hatching
- `ink-wash.jpg` — Ink Wash
- `brush-pen-illustration.jpg` — Brush Pen Illustration
- `pastel-drawing.jpg` — Pastel Drawing
- `oil-pastel.jpg` — Oil Pastel
- `crayon-drawing.jpg` — Crayon Drawing
- `marker-illustration.jpg` — Marker Illustration
- `airbrush-art.jpg` — Airbrush Art
- `scratchboard.jpg` — Scratchboard
- `etching-print.jpg` — Etching Print
- `lithograph.jpg` — Lithograph
- `woodblock-print.jpg` — Woodblock Print
- `linocut-print.jpg` — Linocut Print
- `screen-print.jpg` — Screen Print
- `risograph-print.jpg` — Risograph Print
- `halftone-print.jpg` — Halftone Print
- `stained-glass.jpg` — Stained Glass
- `mosaic-tile.jpg` — Mosaic Tile
- `fresco-mural.jpg` — Fresco Mural
- `tempera-panel.jpg` — Tempera Panel
- `encaustic-wax.jpg` — Encaustic Wax
- `paper-collage.jpg` — Paper Collage
- `stencil-spray-art.jpg` — Stencil Spray Art
- `graffiti-mural.jpg` — Graffiti Mural
- `chalkboard-drawing.jpg` — Chalkboard Drawing
- `sand-art.jpg` — Sand Art
- `embroidery.jpg` — Embroidery
- `cross-stitch.jpg` — Cross-Stitch

### Illustration & Animation

- `hand-painted-anime-film.jpg` — Hand-Painted Anime Film
- `soft-cel-animation.jpg` — Soft Cel Animation
- `retro-80s-anime.jpg` — Retro 80s Anime
- `90s-anime.jpg` — 90s Anime
- `modern-digital-anime.jpg` — Modern Digital Anime
- `classic-2d-feature-animation.jpg` — Classic 2D Feature Animation
- `rubber-hose-cartoon.jpg` — Rubber Hose Cartoon
- `newspaper-comic-strip.jpg` — Newspaper Comic Strip
- `comic-book-panel.jpg` — Comic Book Panel
- `graphic-novel-noir.jpg` — Graphic Novel Noir
- `manga-panel.jpg` — Manga Panel
- `western-cartoon.jpg` — Western Cartoon
- `storyboard-sketch.jpg` — Storyboard Sketch
- `concept-art.jpg` — Concept Art
- `character-sheet.jpg` — Character Sheet
- `vector-flat-illustration.jpg` — Vector Flat Illustration
- `isometric-illustration.jpg` — Isometric Illustration
- `children-s-picture-book.jpg` — Children's Picture Book
- `editorial-illustration.jpg` — Editorial Illustration
- `sticker-art.jpg` — Sticker Art
- `chibi-style.jpg` — Chibi Style
- `caricature.jpg` — Caricature
- `line-art.jpg` — Line Art
- `coloring-book-page.jpg` — Coloring Book Page
- `cel-shaded-3d.jpg` — Cel-Shaded 3D
- `low-poly-3d.jpg` — Low-Poly 3D
- `voxel-art.jpg` — Voxel Art
- `pixel-art.jpg` — Pixel Art
- `16-bit-sprite.jpg` — 16-Bit Sprite
- `claymation-frame.jpg` — Claymation Frame
- `papercraft-layers.jpg` — Papercraft Layers
- `silhouette-animation.jpg` — Silhouette Animation

### Photography & Camera

- `4k-ultra-sharp.jpg` — 4K Ultra Sharp
- `8k-hyper-detail.jpg` — 8K Hyper Detail
- `drone-top-down.jpg` — Drone Top-Down
- `drone-orbit-shot.jpg` — Drone Orbit Shot
- `tilt-shift-miniature.jpg` — Tilt-Shift Miniature
- `long-exposure.jpg` — Long Exposure
- `light-painting.jpg` — Light Painting
- `macro-detail.jpg` — Macro Detail
- `fisheye-lens.jpg` — Fisheye Lens
- `wide-angle-environmental.jpg` — Wide-Angle Environmental
- `telephoto-compression.jpg` — Telephoto Compression
- `bokeh-portrait.jpg` — Bokeh Portrait
- `golden-hour.jpg` — Golden Hour
- `blue-hour.jpg` — Blue Hour
- `overcast-soft-light.jpg` — Overcast Soft Light
- `harsh-midday-sun.jpg` — Harsh Midday Sun
- `film-noir.jpg` — Film Noir
- `high-contrast-monochrome.jpg` — High Contrast Monochrome
- `sepia-vintage.jpg` — Sepia Vintage
- `cross-processed-film.jpg` — Cross-Processed Film
- `lomography.jpg` — Lomography
- `double-exposure.jpg` — Double Exposure
- `infrared-photography.jpg` — Infrared Photography
- `hdr-photography.jpg` — HDR Photography
- `anamorphic-widescreen.jpg` — Anamorphic Widescreen
- `35mm-film-grain.jpg` — 35mm Film Grain
- `instant-photo.jpg` — Instant Photo
- `daguerreotype.jpg` — Daguerreotype
- `tintype.jpg` — Tintype
- `disposable-camera.jpg` — Disposable Camera
- `security-camera.jpg` — Security Camera
- `dashcam-footage.jpg` — Dashcam Footage
- `underwater-photography.jpg` — Underwater Photography
- `thermal-imaging.jpg` — Thermal Imaging
- `night-vision.jpg` — Night Vision
- `x-ray-scan.jpg` — X-Ray Scan

### Digital & Glitch

- `glitch-art.jpg` — Glitch Art
- `datamosh.jpg` — Datamosh
- `pixel-sorting.jpg` — Pixel Sorting
- `vhs-tape.jpg` — VHS Tape
- `crt-monitor.jpg` — CRT Monitor
- `vaporwave.jpg` — Vaporwave
- `cyberpunk-neon.jpg` — Cyberpunk Neon
- `holographic-foil.jpg` — Holographic Foil
- `chromatic-aberration.jpg` — Chromatic Aberration
- `ascii-art.jpg` — ASCII Art
- `dot-matrix-print.jpg` — Dot Matrix Print
- `thermal-receipt-print.jpg` — Thermal Receipt Print
- `blueprint.jpg` — Blueprint
- `wireframe-render.jpg` — Wireframe Render
- `topographic-map.jpg` — Topographic Map
- `circuit-board.jpg` — Circuit Board
- `falling-code.jpg` — Falling Code
- `deep-fried-meme.jpg` — Deep-Fried Meme
- `jpeg-compression.jpg` — JPEG Compression
- `kaleidoscope.jpg` — Kaleidoscope
- `fractal-recursion.jpg` — Fractal Recursion
- `liquid-distortion.jpg` — Liquid Distortion
- `heat-map.jpg` — Heat Map
- `duotone.jpg` — Duotone
- `neon-outline.jpg` — Neon Outline
- `hologram-projection.jpg` — Hologram Projection
- `point-cloud-scan.jpg` — Point Cloud Scan
- `vector-trace.jpg` — Vector Trace

### Art Movements

- `renaissance-oil.jpg` — Renaissance Oil
- `baroque-chiaroscuro.jpg` — Baroque Chiaroscuro
- `rococo.jpg` — Rococo
- `neoclassical.jpg` — Neoclassical
- `romanticism.jpg` — Romanticism
- `impressionist.jpg` — Impressionist
- `post-impressionist.jpg` — Post-Impressionist
- `pointillism.jpg` — Pointillism
- `fauvism.jpg` — Fauvism
- `expressionism.jpg` — Expressionism
- `cubism.jpg` — Cubism
- `futurism.jpg` — Futurism
- `surrealism.jpg` — Surrealism
- `dada-collage.jpg` — Dada Collage
- `bauhaus.jpg` — Bauhaus
- `constructivist-poster.jpg` — Constructivist Poster
- `de-stijl.jpg` — De Stijl
- `art-nouveau.jpg` — Art Nouveau
- `art-deco.jpg` — Art Deco
- `pop-art.jpg` — Pop Art
- `op-art.jpg` — Op Art
- `abstract-expressionism.jpg` — Abstract Expressionism
- `minimalism.jpg` — Minimalism
- `brutalist-graphic.jpg` — Brutalist Graphic
- `ukiyo-e.jpg` — Ukiyo-e
- `chinese-ink-painting.jpg` — Chinese Ink Painting
- `persian-miniature.jpg` — Persian Miniature
- `mughal-miniature.jpg` — Mughal Miniature
- `madhubani.jpg` — Madhubani
- `warli-art.jpg` — Warli Art
- `illuminated-manuscript.jpg` — Illuminated Manuscript
- `vintage-travel-poster.jpg` — Vintage Travel Poster

### Scene & Setting

- `outer-space.jpg` — Outer Space
- `underwater-scene.jpg` — Underwater Scene
- `dense-jungle.jpg` — Dense Jungle
- `desert-dunes.jpg` — Desert Dunes
- `snowy-landscape.jpg` — Snowy Landscape
- `heavy-rain.jpg` — Heavy Rain
- `thick-fog.jpg` — Thick Fog
- `autumn-forest.jpg` — Autumn Forest
- `cherry-blossom-season.jpg` — Cherry Blossom Season
- `cyberpunk-city.jpg` — Cyberpunk City
- `medieval-village.jpg` — Medieval Village
- `post-apocalyptic-ruins.jpg` — Post-Apocalyptic Ruins
- `floating-island.jpg` — Floating Island
- `snow-globe.jpg` — Snow Globe
- `miniature-diorama.jpg` — Miniature Diorama
- `museum-exhibit.jpg` — Museum Exhibit
- `postage-stamp.jpg` — Postage Stamp
- `banknote-engraving.jpg` — Banknote Engraving
- `magazine-cover.jpg` — Magazine Cover
- `movie-poster.jpg` — Movie Poster
- `album-cover.jpg` — Album Cover
- `trading-card.jpg` — Trading Card
- `wanted-poster.jpg` — Wanted Poster
- `vintage-advertisement.jpg` — Vintage Advertisement
- `loading-screen.jpg` — Loading Screen
- `billboard-mockup.jpg` — Billboard Mockup
- `storefront-window.jpg` — Storefront Window
- `rooftop-at-night.jpg` — Rooftop at Night

### Portrait Makeover

- `professional-headshot.jpg` — Professional Headshot
- `corporate-portrait.jpg` — Corporate Portrait
- `passport-photo.jpg` — Passport Photo
- `yearbook-portrait.jpg` — Yearbook Portrait
- `royal-oil-portrait.jpg` — Royal Oil Portrait
- `marble-bust.jpg` — Marble Bust
- `bronze-statue.jpg` — Bronze Statue
- `wax-figure.jpg` — Wax Figure
- `action-figure.jpg` — Action Figure
- `vinyl-collectible.jpg` — Vinyl Collectible
- `toy-brick-minifigure.jpg` — Toy Brick Minifigure
- `plush-toy.jpg` — Plush Toy
- `gingerbread-figure.jpg` — Gingerbread Figure
- `balloon-sculpture.jpg` — Balloon Sculpture
- `tattoo-design.jpg` — Tattoo Design
- `superhero.jpg` — Superhero
- `astronaut.jpg` — Astronaut
- `medieval-knight.jpg` — Medieval Knight
- `samurai.jpg` — Samurai
- `cowboy.jpg` — Cowboy
- `pirate-captain.jpg` — Pirate Captain
- `wizard.jpg` — Wizard
- `steampunk-inventor.jpg` — Steampunk Inventor
- `cyberpunk-netrunner.jpg` — Cyberpunk Netrunner
- `renaissance-noble.jpg` — Renaissance Noble
- `1920s-portrait.jpg` — 1920s Portrait
- `1970s-film-portrait.jpg` — 1970s Film Portrait
- `fashion-editorial.jpg` — Fashion Editorial

### Material & Sculpture

- `made-of-glass.jpg` — Made of Glass
- `made-of-ice.jpg` — Made of Ice
- `made-of-marble.jpg` — Made of Marble
- `made-of-bronze.jpg` — Made of Bronze
- `made-of-gold.jpg` — Made of Gold
- `made-of-wood.jpg` — Made of Wood
- `made-of-paper.jpg` — Made of Paper
- `made-of-fabric.jpg` — Made of Fabric
- `made-of-yarn.jpg` — Made of Yarn
- `made-of-clay.jpg` — Made of Clay
- `made-of-chocolate.jpg` — Made of Chocolate
- `made-of-candy.jpg` — Made of Candy
- `made-of-smoke.jpg` — Made of Smoke
- `made-of-water.jpg` — Made of Water
- `made-of-fire.jpg` — Made of Fire
- `made-of-lightning.jpg` — Made of Lightning
- `made-of-crystal.jpg` — Made of Crystal
- `made-of-sand.jpg` — Made of Sand
- `made-of-metal-wire.jpg` — Made of Metal Wire
- `made-of-stone.jpg` — Made of Stone
- `made-of-neon-tubes.jpg` — Made of Neon Tubes
- `made-of-origami.jpg` — Made of Origami

### Practical Edits

- `white-background-product.jpg` — White Background Product
- `lifestyle-product-shot.jpg` — Lifestyle Product Shot
- `food-photography.jpg` — Food Photography
- `real-estate-interior.jpg` — Real Estate Interior
- `virtual-staging.jpg` — Virtual Staging
- `background-removal.jpg` — Background Removal
- `studio-backdrop.jpg` — Studio Backdrop
- `cinematic-color-grade.jpg` — Cinematic Color Grade
- `restore-old-photo.jpg` — Restore Old Photo
- `colorize-black-and-white.jpg` — Colorize Black and White
- `upscale-and-sharpen.jpg` — Upscale and Sharpen
- `remove-background-clutter.jpg` — Remove Background Clutter
- `change-to-golden-hour.jpg` — Change to Golden Hour
- `change-to-night.jpg` — Change to Night
- `change-season-to-winter.jpg` — Change Season to Winter
- `change-season-to-autumn.jpg` — Change Season to Autumn
- `add-dramatic-sky.jpg` — Add Dramatic Sky
- `add-water-reflection.jpg` — Add Water Reflection
- `t-shirt-mockup.jpg` — T-Shirt Mockup
- `mug-mockup.jpg` — Mug Mockup
- `phone-screen-mockup.jpg` — Phone Screen Mockup
- `framed-wall-art.jpg` — Framed Wall Art
