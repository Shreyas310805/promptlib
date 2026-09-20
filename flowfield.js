/* ==================================================================
   flowfield.js — the hero scene.

   Several thousand particles drifting along an invisible vector field,
   each leaving a short trail. It reads as a moving TEXTURE rather than
   as a set of objects, which is what lets type and glass buttons sit on
   top of it without fighting for attention.

   The pointer is the point. The orbital scene it replaces moved a
   camera, so the cursor shifted the whole picture slightly and nothing
   in the picture reacted. Here the cursor deforms the FIELD: particles
   near it are pushed outward and given a swirl, and because each one
   keeps a little of that push as momentum, the disturbance goes on
   unwinding for about a second after you stop moving. You are stirring
   something, not panning across it.

   ------------------------------------------------------------------
   How it stays cheap

   Three things do almost all of the work:

     1. The field is computed on a COARSE GRID, one cell per ~16px,
        not per particle. Four thousand particles then do an O(1) grid
        lookup instead of four thousand noise evaluations. At 1440x900
        that is about 5,000 noise calls a frame regardless of how many
        particles there are.

     2. Trails are free. The canvas is never cleared -- each frame it
        is painted over with the background colour at low alpha, so
        whatever was drawn before dims a little. No per-particle
        history, no second buffer.

     3. Segments are batched by colour. All particles sharing a colour
        go into one path and get one stroke() call, so a frame costs a
        handful of draw calls rather than thousands.

   ------------------------------------------------------------------
   The background colour is READ, not assumed

   The fade in (2) has to be the exact colour the hero is painted, or
   every frame leaves a wash of something else behind: a black fade on
   paper builds up as grey haze, and a paper fade on black does the
   same in reverse. It is tempting to read --bg-void for this. That is
   wrong here, and quietly so -- inside .hero the light theme resolves
   --bg-void to paper while the hero itself is painted black, so the
   token and the pixels disagree.

   So this reads the host's own computed backgroundColor, walking up if
   it is transparent, and re-reads it when the theme attribute changes.
   That is true whatever the CSS says now and whatever it says later: if
   the hero is ever allowed to go light, the field follows with no
   change here.
   ================================================================== */

(function (global) {
  "use strict";

  var TAU = Math.PI * 2;

  /* ------------------------------------------------------------------
     Gradient noise

     Fixed permutation rather than a seeded shuffle, so the field is the
     same shape on every load -- the hero should not be subtly different
     each time somebody arrives.
     ------------------------------------------------------------------ */
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

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a, b, t) { return a + t * (b - a); }

  /* 2D gradient noise, roughly -1..1. Gradients are the eight diagonals
     and axes, picked by the low bits of the permutation. */
  function grad2(hash, x, y) {
    switch (hash & 7) {
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
    var xi = Math.floor(x) & 255;
    var yi = Math.floor(y) & 255;
    var xf = x - Math.floor(x);
    var yf = y - Math.floor(y);
    var u = fade(xf);
    var v = fade(yf);

    var aa = PERM[PERM[xi] + yi];
    var ab = PERM[PERM[xi] + yi + 1];
    var ba = PERM[PERM[xi + 1] + yi];
    var bb = PERM[PERM[xi + 1] + yi + 1];

    var x1 = lerp(grad2(aa, xf, yf), grad2(ba, xf - 1, yf), u);
    var x2 = lerp(grad2(ab, xf, yf - 1), grad2(bb, xf - 1, yf - 1), u);
    return lerp(x1, x2, v);
  }

  /* ------------------------------------------------------------------
     Colour helpers
     ------------------------------------------------------------------ */

  /* The computed background of the host, or of the nearest ancestor
     that actually paints one. Returns {r,g,b}; falls back to black,
     which is what the hero is in both themes today. */
  function groundColour(el) {
    var node = el;
    while (node && node.nodeType === 1) {
      var c = parseRGB(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0) return c;
      node = node.parentElement;
    }
    return { r: 0, g: 0, b: 0, a: 1 };
  }

  function parseRGB(value) {
    if (!value) return null;
    var m = value.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var parts = m[1].split(/[,\/\s]+/).filter(Boolean).map(parseFloat);
    if (parts.length < 3) return null;
    return {
      r: parts[0], g: parts[1], b: parts[2],
      a: parts.length > 3 ? parts[3] : 1
    };
  }

  /* Read a custom property off the host so the field is painted in the
     page's own palette and follows any theme or accent change. */
  function token(el, name, fallback) {
    var v = getComputedStyle(el).getPropertyValue(name).trim();
    return v || fallback;
  }

  /* ------------------------------------------------------------------
     mountFlowField(host, options) -> { update, destroy }

     Mirrors mountOrbital's contract exactly: the canvas is prepended to
     a host the page owns, and copy lives in a sibling that CSS lifts
     above it. Swapping one for the other is a one-line change in
     initHero().
     ------------------------------------------------------------------ */
  function mountFlowField(host, options) {
    if (!host) return null;

    var cfg = {
      /* Particle budget. The cost here is the per-particle grid lookup
         and line segment, both cheap; the field itself does not care. */
      /* Far fewer than you would guess. The first pass used 4,200 and
         the hero became a mat of tangled thread with no ground left to
         read type against.

         The count and the trail length trade against each other, and
         the trail is the part that matters: long strokes are what make
         it read as FLOW rather than as drifting dust. So the trail is
         set long and the count is brought right down to pay for it.
         A stroke here reaches roughly 170px before it fades, and 180 of
         them leave most of the frame as ground. */
      particleCount: 180,
      /* Noise frequency, and it has a floor. Set too low the whole
         canvas spans less than two periods of the noise, the field comes
         out nearly uniform, every particle drifts the same way and
         leaves, and what is left is sparse drifting dust. 0.0030 puts
         about four periods across a desktop hero, which is enough
         structure for particles to circulate in rather than escape. */
      fieldScale: 0.0030,
      /* How fast the field itself churns, independent of particle speed.

         This wants to be SLOW. At 0.045 the whole field reorganised
         about every two seconds -- faster than a particle's 170-frame
         life -- so nothing ever followed one current from end to end and
         the picture came out as short scratches pointing everywhere.
         Two identical mounts looked like different designs depending on
         which moment you caught. At 0.005 a current holds its shape for
         roughly half a minute, which is long enough to be followed and
         still slow enough to never feel static. */
      fieldDrift: 0.005,
      speed: 1.75,
      /* How much of the previous frame survives. Lower fades slower and
         gives longer trails; too low and the residue never clears. */
      /* Trail length, and the single most important number here. At
         0.055 a streak was gone inside a dozen frames and the field read
         as drifting dust however many particles were thrown at it; at
         0.013 a stroke reached 400px and 400 of them wove into a solid
         mat. A stroke stays visible for about ln(0.05)/ln(1-a) frames,
         so this is roughly 100 frames, or 170px at the speed above. */
      fadeAlpha: 0.030,
      lineWidth: 1,
      /* Pointer influence radius in CSS pixels, and how hard it pushes. */
      pointerRadius: 220,
      pointerForce: 1.5,
      /* A little rotation around the cursor as well as straight
         repulsion -- pure repulsion reads as a bubble, a touch of swirl
         reads as stirring. */
      pointerSwirl: 0.55,
      /* Particles are retired and respawned so they cannot all end up
         pooled in the same few attractor basins. */
      maxAge: 360,
      dprCap: 1.75,
      /* Resolved from tokens at mount unless given outright. */
      colors: null
    };
    if (options) for (var k in options) if (options.hasOwnProperty.call(options, k)) cfg[k] = options[k];

    var reduced = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)");

    var canvas = document.createElement("canvas");
    canvas.className = "field-canvas";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;";
    host.insertBefore(canvas, host.firstChild);

    var ctx = canvas.getContext("2d", { alpha: false });

    var W = 0, H = 0, dpr = 1;
    var cols = 0, rows = 0, CELL = 16;
    var field = null;            // Float32Array of angles, one per cell
    var parts = null;            // flat Float32Array: x, y, vx, vy, age, life
    var STRIDE = 6;
    var buckets = [];            // one path batch per colour
    var ground = { r: 0, g: 0, b: 0 };
    var fadeStyle = "rgba(0,0,0,0.055)";

    var pointer = { x: -1e4, y: -1e4, active: false, energy: 0 };
    var raf = 0, running = false, visible = true, onScreen = true;
    var t = 0;

    /* ---- palette ---------------------------------------------------- */
    function resolveColours() {
      ground = groundColour(host);
      fadeStyle = "rgba(" + Math.round(ground.r) + "," + Math.round(ground.g) + "," +
                  Math.round(ground.b) + "," + cfg.fadeAlpha + ")";

      var list = cfg.colors;
      if (!list) {
        /* The page's five, minus the ground itself. Reading them rather
           than naming them means a theme or accent change carries. */
        list = [
          token(host, "--sun", "#FFF2CC"),
          token(host, "--amber", "#FFA62E"),
          token(host, "--ice", "#5FD8FF"),
          token(host, "--deep", "#3F7DFF")
        ];
      }
      /* Weighted so the field reads mostly as the section accent with
         the other three as occasional threads, rather than as four
         equal ribbons which looks like a test card. */
      buckets = [
        { color: list[0], alpha: 0.30, path: null },
        { color: list[1], alpha: 0.24, path: null },
        { color: list[2], alpha: 0.22, path: null },
        { color: list[3], alpha: 0.20, path: null }
      ];
    }

    /* ---- geometry --------------------------------------------------- */
    function resize() {
      var rect = host.getBoundingClientRect();
      var cssW = Math.max(1, Math.round(rect.width));
      var cssH = Math.max(1, Math.round(rect.height));
      dpr = Math.min(global.devicePixelRatio || 1, cfg.dprCap);

      W = cssW; H = cssH;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cols = Math.ceil(W / CELL) + 1;
      rows = Math.ceil(H / CELL) + 1;
      field = new Float32Array(cols * rows);

      /* Repaint the ground outright on resize: the fade only ever dims
         what is already there, so a fresh canvas would otherwise start
         from transparent black and flash. */
      ctx.fillStyle = "rgb(" + Math.round(ground.r) + "," + Math.round(ground.g) + "," + Math.round(ground.b) + ")";
      ctx.fillRect(0, 0, W, H);

      seed();
    }

    function seed() {
      var n = cfg.particleCount;
      /* Fewer on a phone: the field is the same, it just needs less
         thread to read as one. */
      /* A phone has a third of the area, not a third of the need: the
         same count over a smaller canvas reads as denser, but cutting
         to a third left barely a hundred strokes and the field stopped
         reading as one thing at all. */
      if (W < 768) n = Math.round(n * 0.62);
      else if (W < 1100) n = Math.round(n * 0.8);

      parts = new Float32Array(n * STRIDE);
      for (var i = 0; i < n; i++) respawn(i, true);
    }

    function respawn(i, initial) {
      var o = i * STRIDE;
      parts[o] = Math.random() * W;
      parts[o + 1] = Math.random() * H;
      parts[o + 2] = 0;
      parts[o + 3] = 0;
      /* Stagger the ages on first fill so they do not all retire on the
         same frame and pulse. */
      parts[o + 4] = initial ? Math.random() * cfg.maxAge : 0;
      parts[o + 5] = cfg.maxAge * (0.6 + Math.random() * 0.8);
    }

    /* ---- the field -------------------------------------------------- */
    function buildField() {
      var z = t * cfg.fieldDrift;
      var s = cfg.fieldScale * CELL;
      var idx = 0;
      for (var y = 0; y < rows; y++) {
        for (var x = 0; x < cols; x++) {
          /* Two octaves: the first sets the broad current, the second
             breaks it up so the lines do not run parallel for the whole
             width of the screen. */
          var n = noise2(x * s + z, y * s - z * 0.6);
          n += 0.35 * noise2(x * s * 2.3 - z * 0.8, y * s * 2.3 + z * 0.4);
          /* Half a turn of swing across the noise range. At 1.35 the
             field wound through two full turns and particles spiralled
             into tight knots instead of running -- curls, not currents.
             Long sweeping paths need the angle to change GENTLY. */
          field[idx++] = n * TAU * 0.5;
        }
      }
    }

    function angleAt(x, y) {
      var cx = x / CELL, cy = y / CELL;
      var ix = cx | 0, iy = cy | 0;
      if (ix < 0) ix = 0; else if (ix > cols - 1) ix = cols - 1;
      if (iy < 0) iy = 0; else if (iy > rows - 1) iy = rows - 1;
      return field[iy * cols + ix];
    }

    /* ---- frame ------------------------------------------------------ */
    function step() {
      buildField();

      /* Dim the previous frame instead of clearing it. This is the whole
         trail mechanism. */
      ctx.fillStyle = fadeStyle;
      ctx.fillRect(0, 0, W, H);

      var i, o, b;
      for (b = 0; b < buckets.length; b++) buckets[b].path = new Path2D();

      var count = parts.length / STRIDE;
      var pr = cfg.pointerRadius;
      var pr2 = pr * pr;
      /* The cursor's influence decays on its own, so letting go of the
         mouse lets the wake unwind rather than switching it off. */
      var energy = pointer.energy;

      for (i = 0; i < count; i++) {
        o = i * STRIDE;
        var x = parts[o], y = parts[o + 1];
        var vx = parts[o + 2], vy = parts[o + 3];

        var a = angleAt(x, y);
        var fx = Math.cos(a) * cfg.speed;
        var fy = Math.sin(a) * cfg.speed;

        if (energy > 0.002) {
          var dx = x - pointer.x, dy = y - pointer.y;
          var d2 = dx * dx + dy * dy;
          if (d2 < pr2 && d2 > 0.0001) {
            var d = Math.sqrt(d2);
            var falloff = 1 - d / pr;
            falloff *= falloff;                 // soft edge, hard centre
            var push = cfg.pointerForce * falloff * energy;
            var nx = dx / d, ny = dy / d;
            fx += nx * push;
            fy += ny * push;
            /* Perpendicular component: the swirl. */
            fx += -ny * push * cfg.pointerSwirl;
            fy += nx * push * cfg.pointerSwirl;
          }
        }

        /* Momentum is what makes the disturbance outlive the gesture.
           0.82 keeps roughly a second of it at 60fps. */
        vx = vx * 0.82 + fx * 0.18;
        vy = vy * 0.82 + fy * 0.18;

        var nxp = x + vx, nyp = y + vy;
        var age = parts[o + 4] + 1;

        if (nxp < -8 || nxp > W + 8 || nyp < -8 || nyp > H + 8 || age > parts[o + 5]) {
          respawn(i, false);
          continue;
        }

        parts[o] = nxp; parts[o + 1] = nyp;
        parts[o + 2] = vx; parts[o + 3] = vy;
        parts[o + 4] = age;

        var p = buckets[i & 3].path;
        p.moveTo(x, y);
        p.lineTo(nxp, nyp);
      }

      ctx.lineWidth = cfg.lineWidth;
      ctx.lineCap = "round";
      for (b = 0; b < buckets.length; b++) {
        ctx.globalAlpha = buckets[b].alpha;
        ctx.strokeStyle = buckets[b].color;
        ctx.stroke(buckets[b].path);
      }
      ctx.globalAlpha = 1;

      pointer.energy *= 0.94;
      t += 1;
    }

    function loop() {
      if (!running) return;
      step();
      raf = global.requestAnimationFrame(loop);
    }

    function start() {
      if (running || !visible || !onScreen || isReduced()) return;
      running = true;
      raf = global.requestAnimationFrame(loop);
    }

    function stop() {
      running = false;
      if (raf) global.cancelAnimationFrame(raf);
      raf = 0;
    }

    function isReduced() { return !!(reduced && reduced.matches); }

    /* One still frame, and nothing moving. Somebody who asked for no
       motion wants it stopped, not slowed. */
    function drawStatic() {
      ctx.fillStyle = "rgb(" + Math.round(ground.r) + "," + Math.round(ground.g) + "," + Math.round(ground.b) + ")";
      ctx.fillRect(0, 0, W, H);
      /* Just run the simulation forward and stop. An earlier version set
         cfg.fadeAlpha to 0 here meaning to let trails accumulate fully,
         which did nothing at all: step() paints with fadeStyle, a string
         resolveColours() builds, so changing the number it was built
         from after the fact changes nothing. Running longer is what
         actually settles the picture. */
      for (var n = 0; n < 420; n++) step();
      stop();
    }

    /* ---- input ------------------------------------------------------ */
    function onMove(e) {
      var rect = host.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
      pointer.energy = 1;
    }
    function onLeave() { pointer.active = false; }

    /* ---- lifecycle -------------------------------------------------- */
    var ro = null, io = null, mo = null, mqHandler = null;

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
        ro = new global.ResizeObserver(function () { resize(); });
        ro.observe(host);
      } else {
        global.addEventListener("resize", resize);
      }

      /* Off screen is off. A hero that keeps painting while you read the
         rest of the page is a battery bug. */
      if (global.IntersectionObserver) {
        io = new global.IntersectionObserver(function (entries) {
          onScreen = entries[0].isIntersecting;
          if (onScreen) start(); else stop();
        }, { threshold: 0 });
        io.observe(host);
      }

      /* The theme swap changes the ground under the trails, so the fade
         colour has to change with it or the next second of animation
         lays down the wrong wash. */
      mo = new MutationObserver(function () {
        resolveColours();
        if (isReduced()) drawStatic();
      });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

      if (reduced && reduced.addEventListener) {
        mqHandler = function () {
          if (isReduced()) { stop(); drawStatic(); }
          else { start(); }
        };
        reduced.addEventListener("change", mqHandler);
      }
    }

    function update(next) {
      if (next) for (var k in next) if (next.hasOwnProperty.call(next, k)) cfg[k] = next[k];
      resolveColours();
      resize();
      if (isReduced()) drawStatic(); else start();
    }

    function destroy() {
      stop();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      if (ro) ro.disconnect(); else global.removeEventListener("resize", resize);
      if (io) io.disconnect();
      if (mo) mo.disconnect();
      if (reduced && mqHandler && reduced.removeEventListener) reduced.removeEventListener("change", mqHandler);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }

    resolveColours();
    resize();
    bind();
    if (isReduced()) drawStatic(); else start();

    /* advance(n) runs n frames synchronously, outside requestAnimationFrame.

       It exists because embedded preview surfaces -- the one in this
       project's own tooling included -- suspend rAF entirely: zero
       callbacks a second, so the scene paints its first frame and then
       sits there. Without this there is no way to see what the field
       actually looks like once its trails have built up, or to time a
       frame, anywhere but a real browser tab. It runs exactly the same
       step() the loop runs, so a cost measured through it is the real
       per-frame cost; only the scheduling differs. */
    function advance(n) {
      for (var i = 0; i < (n || 1); i++) step();
    }

    return { update: update, destroy: destroy, advance: advance, canvas: canvas };
  }

  global.mountFlowField = mountFlowField;
})(typeof window !== "undefined" ? window : this);
