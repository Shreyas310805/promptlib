/* ==================================================================
   contours.js — the hero scene.

   A contour map of a slowly drifting height field. Pale lines on night,
   dark lines on paper: in light mode it reads as a printed map or an
   engraving, which is a thing people recognise, and that is what lets it
   sit on a white page instead of on top of one.

   ------------------------------------------------------------------
   Three inputs move it

     TIME   drifts the height field, so the landscape slowly reshapes.
     SCROLL widens the contour interval and flattens the terrain, so
            descending the hero thins nine lines down to two and then to
            nothing. The end state is bare page colour, which is what
            makes the handoff to the next section clean -- by the
            boundary there is nothing left to hand over.
     CURSOR raises a smooth hill under itself. Contours crowd into rings
            around it, the way they crowd around a summit on a real map,
            and the hill relaxes when the pointer leaves.

   ------------------------------------------------------------------
   How it is drawn

   Marching squares. The field is sampled once onto a grid of corners,
   then each cell is asked which contour levels pass through it and only
   those are traced. Asking is cheap -- a cell's min and max corner bound
   every level that can cross it -- and it matters, because the naive
   loop is cells x levels and this is closer to cells x 1.5. Crossings
   are interpolated along the cell edges rather than snapped to them, or
   the lines come out as staircases.

   Segments are collected per level into one Path2D and stroked once, so
   a frame is a dozen draw calls rather than thousands.

   ------------------------------------------------------------------
   Colour is read, never assumed

   The line colour comes from --hero-line and --hero-line-accent on the
   host, and the ground the canvas clears to comes from the host's own
   computed backgroundColor. Reading the element rather than naming a
   token is deliberate: a token can disagree with the pixels (--bg-void
   inside .hero resolved to paper while the hero was painted black for
   most of this project's life), whereas the computed background is by
   definition what is actually there.
   ================================================================== */

(function (global) {
  "use strict";

  /* ---- gradient noise ------------------------------------------------
     Fixed permutation, so the terrain is the same shape on every load.
     A hero that is subtly different each visit is a hero nobody can
     describe to anybody else. */
  var PERM = (function () {
    var p = [
      151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225,
      140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148,
      247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32,
      57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175,
      74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122,
      60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54,
      65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169,
      200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64,
      52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212,
      207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213,
      119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9,
      129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104,
      218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241,
      81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157,
      184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93,
      222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180
    ];
    var out = new Uint8Array(512);
    for (var i = 0; i < 512; i++) out[i] = p[i & 255];
    return out;
  })();

  function smooth(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function mix(a, b, t) { return a + t * (b - a); }

  function grad2(h, x, y) {
    switch (h & 7) {
      case 0: return x + y;
      case 1: return -x + y;
      case 2: return x - y;
      case 3: return -x - y;
      case 4: return x;
      case 5: return -x;
      case 6: return y;
      default: return -y;
    }
  }

  function noise2(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    xi &= 255; yi &= 255;
    var u = smooth(xf), v = smooth(yf);
    var aa = PERM[PERM[xi] + yi],     ba = PERM[PERM[xi + 1] + yi];
    var ab = PERM[PERM[xi] + yi + 1], bb = PERM[PERM[xi + 1] + yi + 1];
    return mix(
      mix(grad2(aa, xf, yf),     grad2(ba, xf - 1, yf), u),
      mix(grad2(ab, xf, yf - 1), grad2(bb, xf - 1, yf - 1), u),
      v
    );
  }

  /* ---- colour helpers ------------------------------------------------ */
  function parseRGB(v) {
    if (!v) return null;
    var m = v.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var p = m[1].split(/[,\/\s]+/).filter(Boolean).map(parseFloat);
    if (p.length < 3) return null;
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }

  function groundOf(el) {
    var n = el;
    while (n && n.nodeType === 1) {
      var c = parseRGB(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) return c;
      n = n.parentElement;
    }
    return { r: 0, g: 0, b: 0, a: 1 };
  }

  function token(el, name, fallback) {
    var v = getComputedStyle(el).getPropertyValue(name).trim();
    return v || fallback;
  }

  /* ------------------------------------------------------------------
     mountContourField(host, options) -> { update, destroy, advance }

     Same contract as the scene it replaces: the canvas is prepended to a
     host the page owns, and the copy lives in a sibling that CSS lifts
     above it.
     ------------------------------------------------------------------ */
  function mountContourField(host, options) {
    if (!host) return null;

    var cfg = {
      /* Cell size in CSS pixels. Smaller is smoother and costs more;
         below about 10 the extra detail is under the line width. */
      cell: 13,

      /* Terrain. fieldScale is per pixel: this puts roughly three broad
         ridges across a desktop hero, which is legible as landscape
         rather than as noise. */
      fieldScale: 0.0021,
      drift: 0.055,          // how fast the terrain reshapes, per second
      octaves: 2,
      /* Frames between terrain rebuilds. At 3 the drift is 0.003 of a
         noise unit per rebuild -- well under a pixel of line movement --
         and it takes two thirds of the cost off the frame. */
      noiseEvery: 3,

      /* Contour levels at rest, and at the bottom of the scroll. Nine
         down to two is a change you cannot miss, which is the point. */
      levels: 9,
      levelsEnd: 2,

      /* How flat the terrain goes by the end of the scroll. Lower means
         the remaining lines also straighten out. */
      flattenTo: 0.35,

      /* Every nth contour is drawn heavier and in the accent colour, the
         way index contours work on a real map. It gives the field a
         hierarchy instead of a uniform hatch. */
      indexEvery: 3,
      lineWidth: 1.15,
      indexLineWidth: 1.9,

      /* The pointer hill. Strength is in units of the field, whose noise
         spans roughly -1..1, so 1.15 is a hill taller than the natural
         terrain -- deliberately, because it has to be obvious. */
      pointerRadius: 165,
      pointerStrength: 1.15,
      pointerEase: 0.12,

      /* Null means read the window scroll. A number pins it, for a host
         that drives its own progress or wants a fixed state. */
      progress: null,

      dprCap: 2
    };
    if (options) for (var k in options) if (Object.prototype.hasOwnProperty.call(options, k)) cfg[k] = options[k];

    var reduced = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)");

    var canvas = document.createElement("canvas");
    canvas.className = "contour-canvas";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;";
    host.insertBefore(canvas, host.firstChild);
    var ctx = canvas.getContext("2d", { alpha: false });

    var W = 0, H = 0, dpr = 1;
    var cols = 0, rows = 0;
    var field = null;                 // (cols+1) * (rows+1) corner heights
    var base = null;                  // the same grid, terrain only, cached
    var baseAge = 1e9;                // frames since the terrain was rebuilt
    var ground = { r: 0, g: 0, b: 0 };
    var groundCss = "#000";
    var lineCol = "rgba(255,255,255,.55)";
    var indexCol = "rgba(255,242,204,.8)";

    var t = 0;                        // seconds
    var raf = 0, running = false, onScreen = true, visible = true, lastNow = 0;

    /* Target and eased position, so the hill follows the cursor smoothly
       and sinks back rather than snapping. */
    var pxTarget = -1e5, pyTarget = -1e5, pStrTarget = 0;
    var px = -1e5, py = -1e5, pStr = 0;

    /* ---- theme ------------------------------------------------------

       Read every frame, never cached between them.

       Caching this is the bug that made three heroes in a row look
       broken. The obvious implementation reads the colours once and
       re-reads them when data-theme changes -- but the theme swap is a
       CSS transition, so the attribute flips at the START of it and a
       read at that instant returns the colour being transitioned AWAY
       from. The canvas then paints the old theme's ground for the rest
       of the session: a cream hero sitting in a black page, with white
       heading text on it, which is exactly what it looked like.

       Reading per frame costs one getComputedStyle on one element and
       makes the whole class of mistake impossible -- the canvas cannot
       be out of step with the page because it never remembers what the
       page used to be. It also makes the swap itself look right, since
       the ground now interpolates along with everything else. */
    function readTheme() {
      ground = groundOf(host);
      groundCss = "rgb(" + Math.round(ground.r) + "," + Math.round(ground.g) + "," + Math.round(ground.b) + ")";
      lineCol = token(host, "--hero-line", "rgba(255,255,255,.55)");
      indexCol = token(host, "--hero-line-accent", "rgba(255,242,204,.8)");
    }

    /* ---- geometry --------------------------------------------------- */
    function resize() {
      var r = host.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      dpr = Math.min(global.devicePixelRatio || 1, cfg.dprCap);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cols = Math.ceil(W / cfg.cell);
      rows = Math.ceil(H / cfg.cell);
      field = new Float32Array((cols + 1) * (rows + 1));
      base = new Float32Array((cols + 1) * (rows + 1));
      baseAge = 1e9;
    }

    /* How far down the hero we are, 0 at the top and 1 once its foot has
       reached the top of the viewport. */
    function scrollProgress() {
      if (cfg.progress !== null) return Math.max(0, Math.min(1, cfg.progress));
      var r = host.getBoundingClientRect();
      var travel = r.height || 1;
      var p = -r.top / travel;
      return p < 0 ? 0 : p > 1 ? 1 : p;
    }

    /* ---- the height field -------------------------------------------

       Split in two, because the two halves change at wildly different
       rates. The TERRAIN is ~11,000 noise evaluations and drifts so
       slowly that rebuilding it every frame was 5.8ms a frame spent
       recomputing something nobody could see change; every third frame
       moves it by 0.003 of a noise unit. The HILL under the cursor has
       to be exact every frame, but it is arithmetic over the few hundred
       cells it actually covers, not over all 5,376. */
    function buildBase() {
      var sc = cfg.fieldScale * cfg.cell;
      var z = t * cfg.drift;
      var i = 0;
      for (var y = 0; y <= rows; y++) {
        for (var x = 0; x <= cols; x++) {
          var n = noise2(x * sc + z, y * sc - z * 0.55);
          if (cfg.octaves > 1) n += 0.42 * noise2(x * sc * 2.2 - z * 0.7, y * sc * 2.2 + z * 0.35);
          base[i++] = n;
        }
      }
      baseAge = 0;
    }

    function buildField() {
      if (baseAge >= cfg.noiseEvery) buildBase();
      baseAge++;
      field.set(base);
      if (pStr <= 0.002) return;

      /* Only the cells the hill can reach. */
      var R = cfg.pointerRadius, R2 = R * R, cs = cfg.cell;
      var x0 = Math.max(0, Math.floor((px - R) / cs)), x1 = Math.min(cols, Math.ceil((px + R) / cs));
      var y0 = Math.max(0, Math.floor((py - R) / cs)), y1 = Math.min(rows, Math.ceil((py + R) / cs));
      var stride = cols + 1, h = cfg.pointerStrength * pStr;
      for (var y2 = y0; y2 <= y1; y2++) {
        var dy = y2 * cs - py, dy2 = dy * dy, row = y2 * stride;
        for (var x2 = x0; x2 <= x1; x2++) {
          var dx = x2 * cs - px;
          var d2 = dx * dx + dy2;
          if (d2 >= R2) continue;
          /* A smooth bump, not a cone: the squared falloff keeps the
             summit round so the rings around it stay concentric. */
          var f = 1 - d2 / R2;
          field[row + x2] += h * f * f;
        }
      }
    }

    /* ---- marching squares -------------------------------------------

       One pass over the cells for ALL levels, not one pass per level.
       A cell's min and max corner say exactly which levels can cross it
       -- almost always one, sometimes two, never nine -- so the level
       range is computed arithmetically and only those are traced. The
       obvious loop is cells x levels, which at 4,500 cells and 9 levels
       is 40,500 iterations a frame to produce about 6,000 segments.

       Bit order: tl=8, tr=4, br=2, bl=1. Each case names the pair of
       edges the line runs between; 5 and 10 are the ambiguous saddles
       and get both segments, which at this cell size is invisible
       either way. */
    function traceAll(paths, n, amp) {
      var cs = cfg.cell;
      var stride = cols + 1;
      var span = 2 * amp;
      for (var y = 0; y < rows; y++) {
        var row0 = y * stride, row1 = row0 + stride;
        var y0 = y * cs, y1 = y0 + cs;
        for (var x = 0; x < cols; x++) {
          var tl = field[row0 + x], tr = field[row0 + x + 1];
          var bl = field[row1 + x], br = field[row1 + x + 1];

          var mn = tl < tr ? tl : tr; if (bl < mn) mn = bl; if (br < mn) mn = br;
          var mx = tl > tr ? tl : tr; if (bl > mx) mx = bl; if (br > mx) mx = br;

          /* level_i = -amp + span * (i + 0.5) / n, so invert for i. */
          var iLo = Math.ceil(((mn + amp) / span) * n - 0.5);
          var iHi = Math.floor(((mx + amp) / span) * n - 0.5);
          if (iLo < 0) iLo = 0;
          if (iHi > n - 1) iHi = n - 1;
          if (iLo > iHi) continue;

          var x0 = x * cs, x1 = x0 + cs;
          for (var i = iLo; i <= iHi; i++) {
            var level = -amp + span * ((i + 0.5) / n);
            var idx = (tl > level ? 8 : 0) | (tr > level ? 4 : 0) | (br > level ? 2 : 0) | (bl > level ? 1 : 0);
            if (idx === 0 || idx === 15) continue;

            var path = paths[i];
            /* Crossings interpolated along each edge, not snapped to it,
               or the contours come out as staircases. */
            var top = x0 + (level - tl) / (tr - tl) * cs;
            var bot = x0 + (level - bl) / (br - bl) * cs;
            var lft = y0 + (level - tl) / (bl - tl) * cs;
            var rgt = y0 + (level - tr) / (br - tr) * cs;

            switch (idx) {
              case 1: case 14: path.moveTo(x0, lft); path.lineTo(bot, y1); break;
              case 2: case 13: path.moveTo(bot, y1); path.lineTo(x1, rgt); break;
              case 3: case 12: path.moveTo(x0, lft); path.lineTo(x1, rgt); break;
              case 4: case 11: path.moveTo(top, y0); path.lineTo(x1, rgt); break;
              case 6: case 9:  path.moveTo(top, y0); path.lineTo(bot, y1); break;
              case 7: case 8:  path.moveTo(x0, lft); path.lineTo(top, y0); break;
              case 5:
                path.moveTo(x0, lft); path.lineTo(top, y0);
                path.moveTo(bot, y1); path.lineTo(x1, rgt); break;
              case 10:
                path.moveTo(top, y0); path.lineTo(x1, rgt);
                path.moveTo(x0, lft); path.lineTo(bot, y1); break;
            }
          }
        }
      }
    }

    /* ---- one frame --------------------------------------------------- */
    function step(dt) {
      t += dt;
      readTheme();

      px += (pxTarget - px) * cfg.pointerEase;
      py += (pyTarget - py) * cfg.pointerEase;
      pStr += (pStrTarget - pStr) * cfg.pointerEase;

      var p = scrollProgress();
      buildField();

      ctx.fillStyle = groundCss;
      ctx.fillRect(0, 0, W, H);

      /* Nine levels down to two, and the whole thing fading out over the
         last fifth so the hero is bare ground at the boundary. */
      var n = Math.max(1, Math.round(mix(cfg.levels, cfg.levelsEnd, p)));
      var fade = p > 0.8 ? Math.max(0, 1 - (p - 0.8) / 0.2) : 1;
      if (fade <= 0) return;

      /* Flattening the terrain and spreading the levels are the same
         operation: a contour of amp*n at level L is a contour of n at
         L/amp. Dividing here means the cached terrain never has to be
         rescaled, and the pointer hill keeps its full height while the
         landscape around it goes flat. */
      var amp = 1.35 / mix(1, cfg.flattenTo, p);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      var paths = new Array(n);
      for (var i = 0; i < n; i++) paths[i] = new Path2D();
      traceAll(paths, n, amp);

      ctx.globalAlpha = fade;
      for (var j = 0; j < n; j++) {
        var isIndex = (j % cfg.indexEvery) === 0;
        ctx.strokeStyle = isIndex ? indexCol : lineCol;
        ctx.lineWidth = isIndex ? cfg.indexLineWidth : cfg.lineWidth;
        ctx.stroke(paths[j]);
      }
      ctx.globalAlpha = 1;
    }

    function loop(now) {
      if (!running) return;
      raf = global.requestAnimationFrame(loop);
      var dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0.016;
      lastNow = now;
      step(dt);
    }

    function start() {
      if (running || !visible || !onScreen || isReduced()) return;
      running = true; lastNow = 0;
      raf = global.requestAnimationFrame(loop);
    }
    function stop() {
      running = false;
      if (raf) global.cancelAnimationFrame(raf);
      raf = 0;
    }
    function isReduced() { return !!(reduced && reduced.matches); }

    /* Reduced motion gets one frame of terrain and nothing moving. */
    function drawStill() { stop(); step(0); }

    /* Runs n frames outside requestAnimationFrame. Needed because some
       embedded preview surfaces suspend rAF entirely -- zero callbacks a
       second -- and without this the scene paints once and sits there,
       which makes it impossible to see or to time anywhere but a real
       browser tab. It calls the same step() the loop calls. */
    function advance(n, dt) {
      for (var i = 0; i < (n || 1); i++) step(dt === undefined ? 0.016 : dt);
    }

    /* ---- input ------------------------------------------------------- */
    function onMove(e) {
      var r = host.getBoundingClientRect();
      pxTarget = e.clientX - r.left;
      pyTarget = e.clientY - r.top;
      pStrTarget = 1;
      if (px < -1e4) { px = pxTarget; py = pyTarget; }   // no swoop in from off-screen
    }
    function onLeave() { pStrTarget = 0; }

    /* ---- lifecycle --------------------------------------------------- */
    var ro = null, io = null, mo = null, mq = null, onScroll = null;

    function onVisibility() {
      visible = document.visibilityState !== "hidden";
      if (visible) start(); else stop();
    }

    function bind() {
      if (!isReduced()) {
        host.addEventListener("pointermove", onMove, { passive: true });
        host.addEventListener("pointerleave", onLeave, { passive: true });
      }
      document.addEventListener("visibilitychange", onVisibility);

      if (global.ResizeObserver) {
        ro = new global.ResizeObserver(function () { resize(); if (isReduced()) drawStill(); });
        ro.observe(host);
      } else {
        global.addEventListener("resize", resize);
      }

      /* Off screen is off. */
      if (global.IntersectionObserver) {
        io = new global.IntersectionObserver(function (es) {
          onScreen = es[0].isIntersecting;
          if (onScreen) start(); else stop();
        }, { threshold: 0 });
        io.observe(host);
      }

      /* With motion reduced there is no loop to notice a scroll, so the
         still frame is redrawn as the hero passes instead -- the contour
         interval still widens, it just does not animate between states. */
      if (isReduced()) {
        onScroll = function () { drawStill(); };
        global.addEventListener("scroll", onScroll, { passive: true });
      }

      mo = new MutationObserver(function () {
        readTheme();
        if (isReduced()) drawStill();
      });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

      if (reduced && reduced.addEventListener) {
        mq = function () { if (isReduced()) { stop(); drawStill(); } else { start(); } };
        reduced.addEventListener("change", mq);
      }
    }

    function update(next) {
      if (next) for (var k2 in next) if (Object.prototype.hasOwnProperty.call(next, k2)) cfg[k2] = next[k2];
      readTheme();
      resize();
      if (isReduced()) drawStill(); else start();
    }

    function destroy() {
      stop();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      if (onScroll) global.removeEventListener("scroll", onScroll);
      if (ro) ro.disconnect(); else global.removeEventListener("resize", resize);
      if (io) io.disconnect();
      if (mo) mo.disconnect();
      if (reduced && mq && reduced.removeEventListener) reduced.removeEventListener("change", mq);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }

    readTheme();
    resize();
    bind();
    /* Paint one frame synchronously before handing over to the loop.
       start() only SCHEDULES a frame, so the hero was blank until the
       first callback arrived -- normally 16ms, but longer under load,
       and forever in embedded viewers that suspend rAF. A hero that
       flashes empty on load is worse than one that starts a frame
       behind. */
    step(0);
    if (isReduced()) drawStill(); else start();

    return { update: update, destroy: destroy, advance: advance, canvas: canvas };
  }

  global.mountContourField = mountContourField;
})(typeof window !== "undefined" ? window : this);
