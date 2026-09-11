/* ==================================================================
   orbital.js — the hero scene.

   A plain-JS port of the supplied OrbitalHeroSection React component.
   The maths is unchanged: same orbital elements, same Kepler solver,
   same camera, same defaults, same drawing order, so it renders the
   same picture. Only the shell differs — React's effect and props ref
   become mountOrbital() and a config object.

   Two deliberate differences from the original, both needed here:

     1. starCount is honoured by update(). In the original it was only
        read when the canvas resized, so switching to the phone layout
        would not have thinned the star field.
     2. The canvas is prepended to a host you own, rather than the
        component owning the DOM. Copy goes in .orbital-content, which
        CSS lifts above the canvas.

   ------------------------------------------------------------------
   What this draws

   The Sun does not sit still. Relative to the stars around it, it moves
   at 19.4 km/s toward the solar apex in Hercules. The planets keep
   running their Kepler ellipses around it, so the path each planet
   actually cuts through space is an ellipse plus a straight drift: a
   helix.

   The camera travels with the Sun. That is why the Sun stays put, the
   background stars slide past with real depth parallax, and every
   planet leaves a spiral behind it as it chases the Sun.

   One thing is drawn for looks rather than for truth. By default the
   orbits are swung square to the Sun's course, which makes every wake a
   helix about one shared axis and lays the coils out parallel. The real
   ecliptic leans 53 degrees to the course, so the real helices lean
   too. alignToCourse: 0 gives you that instead.
   ================================================================== */

(function (global) {
  "use strict";

  var TAU = Math.PI * 2;
  var RAD = Math.PI / 180;

  /* ---- real orbital elements, J2000, referred to the ecliptic ------- */
  var SOLAR_SYSTEM = [
    { name: "Mercury", a: 0.38710, e: 0.20563, i: 7.005, node: 48.331,  peri: 29.125,  M0: 174.796, color: "#fff0d0", size: 2.2 },
    { name: "Venus",   a: 0.72333, e: 0.00677, i: 3.395, node: 76.680,  peri: 54.853,  M0: 50.115,  color: "#ffc65a", size: 3.4 },
    { name: "Earth",   a: 1.00000, e: 0.01671, i: 0.000, node: 348.739, peri: 114.208, M0: 357.517, color: "#5fd8ff", size: 3.8, glow: 1.1 },
    { name: "Mars",    a: 1.52371, e: 0.09339, i: 1.850, node: 49.558,  peri: 286.483, M0: 19.373,  color: "#ff4a32", size: 2.9 },
    { name: "Jupiter", a: 5.20290, e: 0.04839, i: 1.303, node: 100.464, peri: 273.867, M0: 20.020,  color: "#ffa62e", size: 5.4 },
    { name: "Saturn",  a: 9.53700, e: 0.05386, i: 2.485, node: 113.665, peri: 339.392, M0: 317.020, color: "#ffd884", size: 4.8 },
    { name: "Uranus",  a: 19.1913, e: 0.04726, i: 0.773, node: 74.006,  peri: 98.999,  M0: 142.238, color: "#7fe6ff", size: 4.2 },
    { name: "Neptune", a: 30.0690, e: 0.00859, i: 1.770, node: 131.784, peri: 276.336, M0: 256.228, color: "#3f7dff", size: 4.4 }
  ];

  /** Just the four rocky ones, for a tighter frame. */
  var INNER_PLANETS = SOLAR_SYSTEM.slice(0, 4);

  /* Extra tilt and swing added to each orbit plane at planeSpread 1, in
     degrees. Fixed rather than random, so the rosette is the same every
     load. */
  var PLANE_FAN = [
    [58, 35], [27, 145], [71, 250], [40, 80],
    [84, 190], [33, 310], [62, 120], [15, 20]
  ];

  /** Eccentricity each orbit is pulled toward at eccentricity 1. */
  var ECC_FAN = [0.52, 0.34, 0.63, 0.44, 0.3, 0.58, 0.4, 0.68];

  var DEFAULTS = {
    planets: SOLAR_SYSTEM,
    yearSeconds: 16,
    trailYears: 2.6,
    compress: 0.42,
    maxTurns: 3,
    planeSpread: 1,
    eccentricity: 0.25,
    alignToCourse: 1,
    driftSpeed: 1.5,
    apex: [272, 53],
    viewRadius: 3.4,
    /* Pitch and yaw are picked together so the Sun's track leaves the
       frame at about 38 degrees below the horizon, running up and to
       the right. */
    tilt: 45,
    spin: 252,
    roll: 13.5,
    lead: 0.12,
    focus: [0.5, 0.5],
    scrim: "none",
    scrimStrength: 0.88,
    starCount: 1500,
    glow: 1,
    showOrbits: false,
    showSunTrack: true,
    interactive: true,
    paused: false,
    sunColor: "#FFF2CC"
  };

  /* ---- maths -------------------------------------------------------- */

  /**
   * Kepler's equation M = E - e*sin E, solved for the eccentric anomaly.
   * Newton's method; at solar-system eccentricities three passes are
   * plenty.
   */
  function eccentricAnomaly(M, e) {
    var m = M % TAU;
    if (m < 0) m += TAU;
    var E = m + e * Math.sin(m) * (1 + e * Math.cos(m));
    for (var k = 0; k < 8; k++) {
      var step = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
      E -= step;
      if (Math.abs(step) < 1e-10) break;
    }
    return E;
  }

  function parseRGB(color) {
    var c = String(color).trim();
    if (c[0] === "#") {
      var hex = c.slice(1);
      var full = hex.length === 3
        ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
        : hex.slice(0, 6);
      var n = parseInt(full, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    var m = c.match(/(\d+(?:\.\d+)?)/g);
    if (m && m.length >= 3) return [+m[0], +m[1], +m[2]];
    return [255, 255, 255];
  }

  function mulberry32(seed) {
    var t = seed >>> 0;
    return function () {
      t += 0x6d2b79f5;
      var x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---- mount -------------------------------------------------------- */

  function mountOrbital(host, options) {
    if (!host) return { update: function () {}, destroy: function () {} };

    var C = {};
    var key;
    for (key in DEFAULTS) if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) C[key] = DEFAULTS[key];
    if (options) for (key in options) if (options[key] !== undefined) C[key] = options[key];

    /* The host owns its own layout; the canvas only needs to fill it and
       sit underneath whatever copy the page put inside. */
    if (getComputedStyle(host).position === "static") host.style.position = "relative";

    var canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.className = "orbital-canvas";
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    host.prepend(canvas);

    var ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) {
      canvas.remove();
      return { update: function () {}, destroy: function () {} };
    }

    var reduced = typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var width = 0;
    var height = 0;
    var dpr = 1;
    /** Simulation clock, in Earth years since J2000. */
    var years = reduced ? 1.7 : 0;
    var lastFrame = 0;
    var running = true;
    var visible = true;
    var raf = 0;

    /* --- camera ----------------------------------------------------- */
    /* World axes: x, y span the ecliptic, z points to the ecliptic north
       pole. Screen basis is built from yaw about z, then pitch about the
       new x. */
    var pxPerAU = 1;
    var cx = 0;
    var cy = 0;
    var camDist = 1;
    var RIGHT = { x: 1, y: 0, z: 0 };
    var UP = { x: 0, y: 1, z: 0 };
    var FWD = { x: 0, y: 0, z: 1 };

    function setCamera(yawDeg, pitchDeg, rollDeg) {
      var A = yawDeg * RAD;
      var B = pitchDeg * RAD;
      var ca = Math.cos(A), sa = Math.sin(A);
      var cb = Math.cos(B), sb = Math.sin(B);
      var rx = ca, ry = sa, rz = 0;
      var ux = -sa * cb, uy = ca * cb, uz = sb;
      FWD.x = sa * sb; FWD.y = -ca * sb; FWD.z = cb;
      /* Roll turns the picture about the line of sight. It changes
         nothing in space — it only decides which way the helix runs
         across the screen. */
      var Cc = rollDeg * RAD;
      var cr = Math.cos(Cc), sr = Math.sin(Cc);
      RIGHT.x = rx * cr + ux * sr;
      RIGHT.y = ry * cr + uy * sr;
      RIGHT.z = rz * cr + uz * sr;
      UP.x = -rx * sr + ux * cr;
      UP.y = -ry * sr + uy * cr;
      UP.z = -rz * sr + uz * cr;
    }

    /* Scratch output for project(); reused to keep the hot loop
       allocation-free. */
    var P = { x: 0, y: 0, depth: 0, s: 0, ok: false };

    /** World offset from the Sun -> screen. */
    function project(dx, dy, dz) {
      var vx = dx * RIGHT.x + dy * RIGHT.y + dz * RIGHT.z;
      var vy = dx * UP.x + dy * UP.y + dz * UP.z;
      var vz = dx * FWD.x + dy * FWD.y + dz * FWD.z;
      var depth = camDist - vz;
      if (depth < 0.6) { P.ok = false; return; }
      var s = camDist / depth;
      P.x = cx + vx * pxPerAU * s;
      P.y = cy - vy * pxPerAU * s;
      P.depth = depth;
      P.s = s;
      P.ok = true;
    }

    /* --- the Sun's own velocity ------------------------------------- */
    var DIR = { x: 0, y: 0, z: 0 };
    function setApex(lonDeg, latDeg) {
      var l = lonDeg * RAD;
      var b = latDeg * RAD;
      DIR.x = Math.cos(b) * Math.cos(l);
      DIR.y = Math.cos(b) * Math.sin(l);
      DIR.z = Math.sin(b);
    }

    /** Distance the Sun has travelled, in AU. */
    var dist = 0;

    /* --- heliocentric position from orbital elements ---------------- */

    /**
     * Builds the rotation that swings an orbit plane toward the one
     * standing square to the Sun's course. At align 1 the normal ends up
     * along the course, so every wake is a helix about it.
     */
    function swingToCourse(nx, ny, nz, align) {
      /* Aim at whichever end of the course the plane already leans
         toward, so an orbit is never turned inside out. */
      var s = nx * DIR.x + ny * DIR.y + nz * DIR.z >= 0 ? 1 : -1;
      var tx = nx + align * (s * DIR.x - nx);
      var ty = ny + align * (s * DIR.y - ny);
      var tz = nz + align * (s * DIR.z - nz);
      var tl = Math.hypot(tx, ty, tz);
      if (tl < 1e-9) return null;
      tx /= tl; ty /= tl; tz /= tl;
      /* Rodrigues: rotate n onto the blended normal, about their cross
         product. */
      var ax = ny * tz - nz * ty;
      var ay = nz * tx - nx * tz;
      var az = nx * ty - ny * tx;
      var al = Math.hypot(ax, ay, az);
      if (al < 1e-9) return null;
      ax /= al; ay /= al; az /= al;
      var c = Math.max(-1, Math.min(1, nx * tx + ny * ty + nz * tz));
      var sA = al > 1 ? 1 : al;
      var k = 1 - c;
      return [
        c + ax * ax * k, ax * ay * k - az * sA, ax * az * k + ay * sA,
        ay * ax * k + az * sA, c + ay * ay * k, ay * az * k - ax * sA,
        az * ax * k - ay * sA, az * ay * k + ax * sA, c + az * az * k
      ];
    }

    function elementsOf(p, index, gamma, spread, ecc, align) {
      var aDraw = Math.pow(p.a, gamma);
      /* Kepler's third law: P^2 is proportional to a^3, so P = a^1.5
         years and n = 2*pi/P. */
      var period = Math.pow(aDraw, 1.5);
      var fan = PLANE_FAN[index % PLANE_FAN.length];
      var inc = (p.i + spread * fan[0]) * RAD;
      var node = (p.node + spread * fan[1]) * RAD;
      var target = ECC_FAN[index % ECC_FAN.length];
      var ci = Math.cos(inc), si = Math.sin(inc);
      var cn = Math.cos(node), sn = Math.sin(node);
      return {
        p: p,
        rgb: parseRGB(p.color),
        e: Math.min(0.85, p.e + ecc * (target - p.e)),
        aDraw: aDraw,
        period: period,
        n: TAU / period,
        cw: Math.cos(p.peri * RAD), sw: Math.sin(p.peri * RAD),
        ci: ci, si: si, cn: cn, sn: sn,
        M0: p.M0 * RAD,
        swing: align > 0 ? swingToCourse(si * sn, -si * cn, ci, align) : null
      };
    }

    var R3 = { x: 0, y: 0, z: 0 };
    /** Heliocentric position at mean anomaly M, already squeezed. */
    function helio(el, M, gamma) {
      var e = el.e;
      var E = eccentricAnomaly(M, e);
      var xo = el.p.a * (Math.cos(E) - e);
      var yo = el.p.a * Math.sqrt(1 - e * e) * Math.sin(E);
      /* turn by the argument of perihelion, inside the orbit plane */
      var x1 = xo * el.cw - yo * el.sw;
      var y1 = xo * el.sw + yo * el.cw;
      /* tip the plane by the inclination */
      var y2 = y1 * el.ci;
      var z2 = y1 * el.si;
      /* swing round by the ascending node */
      var x = x1 * el.cn - y2 * el.sn;
      var y = x1 * el.sn + y2 * el.cn;
      var z = z2;
      /* swing the whole plane toward the Sun's course */
      var S = el.swing;
      if (S) {
        var rx = S[0] * x + S[1] * y + S[2] * z;
        var ry = S[3] * x + S[4] * y + S[5] * z;
        var rz = S[6] * x + S[7] * y + S[8] * z;
        x = rx; y = ry; z = rz;
      }
      /* Squeeze along the radius. Angles are untouched, so the tilt of
         every orbit plane and the offset of the Sun from the ellipse
         centre survive. */
      if (gamma !== 1) {
        var r = Math.sqrt(x * x + y * y + z * z);
        if (r > 1e-9) {
          var sc = Math.pow(r, gamma - 1);
          x *= sc; y *= sc; z *= sc;
        }
      }
      R3.x = x; R3.y = y; R3.z = z;
    }

    var elems = [];
    var elemsKey = "";
    function syncElements() {
      var k = C.compress + "/" + C.planeSpread + "/" + C.eccentricity + "/" +
        C.alignToCourse + "/" + C.apex[0] + "," + C.apex[1] + "/" +
        C.planets.map(function (p) { return p.name + p.a + p.e + p.color; }).join("|");
      if (k === elemsKey) return;
      elemsKey = k;
      elems = C.planets.map(function (p, idx) {
        return elementsOf(p, idx, C.compress, C.planeSpread, C.eccentricity, C.alignToCourse);
      });
    }

    /* --- background stars ------------------------------------------- */
    /* Kept in world coords, so turning the camera does not drag them
       along. Depth parallax is real: near stars slide, far ones barely
       stir. Distances are compressed — the true nearest star is 270,000
       AU away and would not shift by a pixel in a lifetime of watching. */
    var D_NEAR = 60;
    var D_FAR = 1400;
    var EMPTY = new Float64Array(0);
    var sx = EMPTY, sy = EMPTY, sz = EMPTY, sMag = EMPTY, sPhase = EMPTY;
    var sTint = new Uint8Array(0);
    var starN = 0;
    var builtStarCount = -1;
    var rand = mulberry32(0xc0ffee);

    /** Place one star at a random spot in the frustum. */
    function seedStar(k, depth, edge) {
      var d = depth === undefined
        ? D_NEAR * Math.pow(D_FAR / D_NEAR, Math.pow(rand(), 0.55))
        : depth;
      var halfW = (width * 0.5) * 1.15;
      var halfH = (height * 0.5) * 1.15;
      var ox, oy;
      if (edge === 0) { ox = -halfW; oy = (rand() * 2 - 1) * halfH; }
      else if (edge === 1) { ox = halfW; oy = (rand() * 2 - 1) * halfH; }
      else if (edge === 2) { ox = (rand() * 2 - 1) * halfW; oy = -halfH; }
      else if (edge === 3) { ox = (rand() * 2 - 1) * halfW; oy = halfH; }
      else { ox = (rand() * 2 - 1) * halfW; oy = (rand() * 2 - 1) * halfH; }
      var scale = d / (camDist * pxPerAU);
      var vx = ox * scale;
      var vy = -oy * scale;
      var vz = camDist - d;
      /* view basis -> world, then offset by where the Sun is right now */
      sx[k] = vx * RIGHT.x + vy * UP.x + vz * FWD.x + DIR.x * dist;
      sy[k] = vx * RIGHT.y + vy * UP.y + vz * FWD.y + DIR.y * dist;
      sz[k] = vx * RIGHT.z + vy * UP.z + vz * FWD.z + DIR.z * dist;
      sMag[k] = Math.pow(rand(), 2.4);
      sPhase[k] = rand() * TAU;
      var t = rand();
      sTint[k] = t > 0.9 ? 1 : t < 0.08 ? 2 : 0;
    }

    function buildStars() {
      starN = Math.max(60, Math.round(C.starCount * Math.min(2, (width * height) / (1440 * 900))));
      builtStarCount = C.starCount;
      sx = new Float64Array(starN);
      sy = new Float64Array(starN);
      sz = new Float64Array(starN);
      sMag = new Float64Array(starN);
      sPhase = new Float64Array(starN);
      sTint = new Uint8Array(starN);
      rand = mulberry32(0xc0ffee);
      for (var k = 0; k < starN; k++) seedStar(k);
    }

    /* --- sprites ----------------------------------------------------- */
    var glowCache = new Map();
    function glowSprite(color) {
      var hit = glowCache.get(color);
      if (hit) return hit;
      var R = 64;
      var c = document.createElement("canvas");
      c.width = c.height = R * 2;
      var g2 = c.getContext("2d");
      var rgb = parseRGB(color);
      var r = rgb[0], g = rgb[1], b = rgb[2];
      var grad = g2.createRadialGradient(R, R, 0, R, R, R);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.15, "rgba(" + r + "," + g + "," + b + ",0.95)");
      grad.addColorStop(0.36, "rgba(" + r + "," + g + "," + b + ",0.26)");
      grad.addColorStop(0.66, "rgba(" + r + "," + g + "," + b + ",0.05)");
      grad.addColorStop(1, "rgba(" + r + "," + g + "," + b + ",0)");
      g2.fillStyle = grad;
      g2.fillRect(0, 0, R * 2, R * 2);
      glowCache.set(color, c);
      return c;
    }

    /* --- sizing ------------------------------------------------------ */
    function layout() {
      pxPerAU = (Math.min(width, height) * 0.5) / C.viewRadius;
      camDist = C.viewRadius * 3.1;
      D_NEAR = camDist * 5;
      D_FAR = camDist * 120;
      setApex(C.apex[0], C.apex[1]);
      setCamera(C.spin, C.tilt, C.roll);
    }

    function resize() {
      var rect = host.getBoundingClientRect();
      var w = Math.max(1, rect.width);
      var h = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (w === width && h === height) return;
      width = w;
      height = h;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layout();
      buildStars();
    }

    /* --- pointer ----------------------------------------------------- */
    var pointerX = 0, pointerY = 0, camX = 0, camY = 0;
    function onPointer(ev) {
      if (!C.interactive) return;
      var rect = host.getBoundingClientRect();
      pointerX = ((ev.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerY = ((ev.clientY - rect.top) / rect.height - 0.5) * 2;
    }
    function onLeave() { pointerX = 0; pointerY = 0; }

    /* --- the star at the centre -------------------------------------- */
    function drawSun(k, t) {
      var rgb = parseRGB(C.sunColor);
      var r = rgb[0], g = rgb[1], b = rgb[2];
      var pulse = 1 + Math.sin(t * 2.1) * 0.02;
      /* The real Sun is 0.0093 AU across — a fifth of a pixel here. What
         you actually see at this range is its glare, so that is what we
         draw. */
      var R = Math.max(5, Math.min(width, height) * 0.013) * pulse;

      var haze = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 14);
      haze.addColorStop(0, "rgba(" + r + "," + g + "," + b + "," + (0.05 * k) + ")");
      haze.addColorStop(0.4, "rgba(255,190,110," + (0.014 * k) + ")");
      haze.addColorStop(1, "rgba(255,160,80,0)");
      ctx.fillStyle = haze;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 14, 0, TAU);
      ctx.fill();

      var outer = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 4.6);
      outer.addColorStop(0, "rgba(" + r + "," + g + "," + b + "," + (0.34 * k) + ")");
      outer.addColorStop(0.3, "rgba(255,222,160," + (0.1 * k) + ")");
      outer.addColorStop(0.62, "rgba(255,196,110," + (0.025 * k) + ")");
      outer.addColorStop(1, "rgba(255,180,90,0)");
      ctx.fillStyle = outer;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 4.6, 0, TAU);
      ctx.fill();

      var bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 2.3);
      bloom.addColorStop(0, "rgba(255,255,255," + k + ")");
      bloom.addColorStop(0.42, "rgba(255,252,240," + (0.7 * k) + ")");
      bloom.addColorStop(0.72, "rgba(" + r + "," + g + "," + b + "," + (0.22 * k) + ")");
      bloom.addColorStop(1, "rgba(255,210,140,0)");
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 2.3, 0, TAU);
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,1)";
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TAU);
      ctx.fill();
    }

    /* --- one frame ---------------------------------------------------- */
    function render(t) {
      var k = C.glow;
      /* layout first: it sets the course, which the element maths needs */
      layout();
      syncElements();

      /* ease the camera toward the pointer */
      camX += (pointerX - camX) * 0.04;
      camY += (pointerY - camY) * 0.04;
      setCamera(C.spin + camX * 7, C.tilt + camY * 5, C.roll);

      dist = C.driftSpeed * t;

      cx = width * C.focus[0];
      cy = height * C.focus[1];
      /* Put the Sun a little ahead of centre so the spirals have room
         behind it. */
      project(DIR.x, DIR.y, DIR.z);
      if (P.ok) {
        var dxs = P.x - cx;
        var dys = P.y - cy;
        var len = Math.hypot(dxs, dys) || 1;
        var push = Math.min(width, height) * C.lead;
        cx += (dxs / len) * push;
        cy += (dys / len) * push;
      }

      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";

      /* stars --------------------------------------------------------- */
      var dRef = D_NEAR * 3.3;
      var left = -width * 0.12;
      var right = width * 1.12;
      var top = -height * 0.12;
      var bottom = height * 1.12;
      for (var s = 0; s < starN; s++) {
        project(sx[s] - DIR.x * dist, sy[s] - DIR.y * dist, sz[s] - DIR.z * dist);
        if (!P.ok || P.depth > D_FAR * 1.25) { seedStar(s); continue; }
        if (P.x < left || P.x > right || P.y < top || P.y > bottom) {
          /* gone off an edge: bring it back in on the opposite side */
          seedStar(s, undefined, P.x < left ? 1 : P.x > right ? 0 : P.y < top ? 3 : 2);
          continue;
        }
        if (P.depth < D_NEAR * 0.75) continue;

        var near = Math.min(1, (P.depth - D_NEAR * 0.75) / (D_NEAR * 0.6));
        var far = 1 - Math.max(0, (P.depth - D_FAR * 0.78) / (D_FAR * 0.32));
        var a = (0.2 + sMag[s] * 1.05) * Math.pow(dRef / P.depth, 0.8) * near * far;
        if (a <= 0.012) continue;
        a *= 0.82 + 0.18 * Math.sin(t * 9 + sPhase[s]);
        var col = sTint[s] === 1 ? "175,205,255" : sTint[s] === 2 ? "255,214,170" : "255,255,255";
        var size = Math.min(2.3, 0.55 + sMag[s] * 1.5 * Math.pow(dRef / P.depth, 0.5));
        ctx.fillStyle = "rgba(" + col + "," + Math.min(1, a).toFixed(3) + ")";
        if (size < 1.05) {
          ctx.fillRect(P.x, P.y, size, size);
        } else {
          ctx.beginPath();
          ctx.arc(P.x, P.y, size * 0.5, 0, TAU);
          ctx.fill();
        }
      }

      /* the Sun's own track through space ------------------------------ */
      if (C.showSunTrack) {
        /* The planets' wakes are clipped for legibility; the Sun's is a
           straight line, so it can run much further back with no clutter. */
        var back = C.driftSpeed * C.trailYears * 1.1;
        project(0, 0, 0);
        var hx = P.x, hy = P.y;
        project(-DIR.x * back, -DIR.y * back, -DIR.z * back);
        if (P.ok) {
          var grad = ctx.createLinearGradient(hx, hy, P.x, P.y);
          grad.addColorStop(0, "rgba(255,246,214," + k + ")");
          grad.addColorStop(0.45, "rgba(255,206,110," + (0.55 * k) + ")");
          grad.addColorStop(1, "rgba(255,180,80,0)");
          ctx.strokeStyle = grad;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(hx, hy);
          ctx.lineTo(P.x, P.y);
          ctx.lineWidth = 11;
          ctx.globalAlpha = 0.16;
          ctx.stroke();
          ctx.lineWidth = 4;
          ctx.globalAlpha = 0.3;
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.lineWidth = 1.8;
          ctx.stroke();
        }
      }

      /* orbit guides ---------------------------------------------------- */
      if (C.showOrbits) {
        for (var gi = 0; gi < elems.length; gi++) {
          var gel = elems[gi];
          var grgb = gel.rgb;
          var steps = 160;
          ctx.beginPath();
          var gstarted = false;
          for (var q = 0; q <= steps; q++) {
            /* step in eccentric anomaly, then back out the mean anomaly */
            var E = (q / steps) * TAU;
            var Mg = E - gel.e * Math.sin(E);
            helio(gel, Mg, C.compress);
            project(R3.x, R3.y, R3.z);
            if (!P.ok) { gstarted = false; continue; }
            if (!gstarted) { ctx.moveTo(P.x, P.y); gstarted = true; }
            else ctx.lineTo(P.x, P.y);
          }
          /* a soft wide pass under a thin bright one, so the line glows */
          ctx.strokeStyle = "rgba(" + grgb[0] + "," + grgb[1] + "," + grgb[2] + "," + (0.045 * k) + ")";
          ctx.lineWidth = 4;
          ctx.stroke();
          ctx.strokeStyle = "rgba(" + grgb[0] + "," + grgb[1] + "," + grgb[2] + "," + (0.3 * k) + ")";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      /* planets and their helical wakes --------------------------------- */
      var shots = [];

      for (var ei = 0; ei < elems.length; ei++) {
        var el = elems[ei];
        var rgb = el.rgb;
        var r = rgb[0], g = rgb[1], b = rgb[2];
        var bright = (el.p.glow === undefined ? 1 : el.p.glow) * k;
        /* A wake is a window on the past, the same window for every
           planet — except that Mercury would wind 5 coils into a
           scribble, so fast planets get theirs clipped to a few turns. */
        var span = Math.min(C.trailYears, C.maxTurns * el.period);
        var turns = span / el.period;
        /* Enough samples to keep the tight coils smooth. A stretched
           orbit needs more: sampling runs on even steps of time, and a
           planet covers far more ground per step near perihelion. */
        var N = Math.max(48, Math.min(360, Math.ceil(turns * 46 * (1 + 2.2 * el.e)) + 48));

        var xs = new Float64Array(N + 1);
        var ys = new Float64Array(N + 1);
        var okArr = new Uint8Array(N + 1);
        for (var qq = 0; qq <= N; qq++) {
          var age = (1 - qq / N) * span;
          var M = el.M0 + el.n * (t - age);
          helio(el, M, C.compress);
          /* where the planet really was: its place around the Sun at
             that moment, minus how far the Sun has moved since. Ellipse
             plus drift is a helix, which is the track a planet actually
             cuts in space. */
          var backAge = C.driftSpeed * age;
          project(R3.x - DIR.x * backAge, R3.y - DIR.y * backAge, R3.z - DIR.z * backAge);
          xs[qq] = P.x; ys[qq] = P.y; okArr[qq] = P.ok ? 1 : 0;
          if (qq === N && P.ok) {
            shots.push({ el: el, x: P.x, y: P.y, depth: P.depth, s: P.s });
          }
        }

        var stroke = function (from, to, alpha, wide) {
          ctx.strokeStyle = "rgba(" + r + "," + g + "," + b + "," + alpha.toFixed(3) + ")";
          ctx.lineWidth = wide;
          ctx.beginPath();
          var started = false;
          for (var q2 = from; q2 <= to; q2++) {
            if (!okArr[q2]) { started = false; continue; }
            if (!started) { ctx.moveTo(xs[q2], ys[q2]); started = true; }
            else ctx.lineTo(xs[q2], ys[q2]);
          }
          ctx.stroke();
        };

        /* The soft halo first, as two unbroken paths near the head. */
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        stroke(Math.floor(N * 0.72), N, 0.05 * bright, 6.5);
        stroke(Math.floor(N * 0.86), N, 0.05 * bright, 3);

        /* Then the line itself, one segment at a time, each with its own
           alpha. That gives as many steps in the fade as there are
           samples — hundreds — instead of the handful you get from
           stroking the whole path a few times over, where the steps land
           unevenly and read as breaks. Butt ends are what keeps it
           seamless: two round ends meeting at a joint would overlap and
           light up as a bead. */
        ctx.lineCap = "butt";
        ctx.lineWidth = 1.3;
        for (var q3 = 0; q3 < N; q3++) {
          if (!okArr[q3] || !okArr[q3 + 1]) continue;
          var f = (q3 + 1) / N;
          var aa = Math.pow(f, 2.6) * 0.95 * bright;
          if (aa < 0.005) continue;
          ctx.strokeStyle = "rgba(" + r + "," + g + "," + b + "," + aa.toFixed(3) + ")";
          ctx.beginPath();
          ctx.moveTo(xs[q3], ys[q3]);
          ctx.lineTo(xs[q3 + 1], ys[q3 + 1]);
          ctx.stroke();
        }
      }

      /* bodies, back to front around the Sun ---------------------------- */
      shots.sort(function (p, q) { return q.depth - p.depth; });
      var sizeScale = Math.min(width, height) / 660;
      var drawShot = function (o) {
        var depth = Math.min(1.3, Math.max(0.5, o.s));
        var size = o.el.p.size * depth * sizeScale;
        var bright2 = (o.el.p.glow === undefined ? 1 : o.el.p.glow) * k;
        var R = size * 3.3;
        ctx.globalAlpha = Math.min(1, 0.9 * bright2);
        ctx.drawImage(glowSprite(o.el.p.color), o.x - R, o.y - R, R * 2, R * 2);
        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.beginPath();
        ctx.arc(o.x, o.y, size * 0.5, 0, TAU);
        ctx.fill();
      };

      var idx = 0;
      while (idx < shots.length && shots[idx].depth > camDist) drawShot(shots[idx++]);
      drawSun(k, t);
      while (idx < shots.length) drawShot(shots[idx++]);

      ctx.globalCompositeOperation = "source-over";

      /* the veil that copy sits on -------------------------------------- */
      if (C.scrim !== "none") {
        var sv = Math.max(0, Math.min(1, C.scrimStrength));
        var gg = C.scrim === "left" ? ctx.createLinearGradient(0, 0, width, 0)
          : C.scrim === "right" ? ctx.createLinearGradient(width, 0, 0, 0)
          : C.scrim === "top" ? ctx.createLinearGradient(0, 0, 0, height)
          : ctx.createLinearGradient(0, height, 0, 0);
        /* Heavy at the edge, then off quickly — a straight ramp would
           grey the whole frame and flatten the picture. Sampled at
           twelve stops rather than three: with only a few, the slope
           changes at each one and the eye picks the kink out as a faint
           vertical band. */
        for (var q4 = 0; q4 <= 12; q4++) {
          var xq = q4 / 12;
          gg.addColorStop(xq, "rgba(0,0,0," + (sv * Math.pow(1 - xq, 2.4)).toFixed(4) + ")");
        }
        ctx.fillStyle = gg;
        ctx.fillRect(0, 0, width, height);
      }
    }

    /* --- loop --------------------------------------------------------- */
    function tick(now) {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      if (!visible) { lastFrame = now; return; }
      var dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0;
      lastFrame = now;
      if (!C.paused && !reduced) {
        years += dt / Math.max(0.1, C.yearSeconds);
      }
      render(years);
    }

    resize();
    render(years);
    if (!reduced) raf = requestAnimationFrame(tick);

    var ro = new ResizeObserver(function () {
      resize();
      if (reduced || C.paused) render(years);
    });
    ro.observe(host);

    /* Stops drawing the moment the hero leaves the screen. */
    var io = new IntersectionObserver(function (entries) {
      visible = entries[0] ? entries[0].isIntersecting : true;
    }, { threshold: 0 });
    io.observe(host);

    function onVisibility() { visible = !document.hidden; lastFrame = 0; }
    document.addEventListener("visibilitychange", onVisibility);
    host.addEventListener("pointermove", onPointer);
    host.addEventListener("pointerleave", onLeave);

    return {
      /**
       * Merge new options in. Star count is the one setting that needs a
       * rebuild rather than just being read on the next frame.
       */
      update: function (next) {
        if (!next) return;
        for (var n in next) if (next[n] !== undefined) C[n] = next[n];
        if (C.starCount !== builtStarCount) {
          layout();
          buildStars();
        }
        if (reduced || C.paused) render(years);
      },
      destroy: function () {
        running = false;
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
        host.removeEventListener("pointermove", onPointer);
        host.removeEventListener("pointerleave", onLeave);
        canvas.remove();
      }
    };
  }

  global.mountOrbital = mountOrbital;
  global.SOLAR_SYSTEM = SOLAR_SYSTEM;
  global.INNER_PLANETS = INNER_PLANETS;
})(window);
