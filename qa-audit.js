/* QA only. Not referenced by any page; loaded by hand during contrast checks. */
(function () {
  function px(s) {
    var m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null;
    var p = m[1].split(/[,\/]+/).map(parseFloat);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function lin(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function L(c) { return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b); }
  function over(f, b) {
    return { r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 };
  }
  function ratio(a, b) { var x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

  /* The effective background under a run of text. Walks up compositing every
     translucent layer, and where an ancestor is position:fixed it resolves
     against what is actually BEHIND it in the viewport rather than its DOM
     parent -- the nav floats over the hero, not over <body>. */
  function bgOf(el) {
    var stack = [], n = el;
    function flatten(base) { for (var i = stack.length - 1; i >= 0; i--) base = over(stack[i], base); return base; }
    while (n && n.nodeType === 1) {
      var cs = getComputedStyle(n), c = px(cs.backgroundColor);
      if (c && c.a > 0) { stack.push(c); if (c.a === 1) return flatten({ r: 255, g: 255, b: 255, a: 1 }); }
      if (cs.position === 'fixed') {
        var r = n.getBoundingClientRect();
        var x = Math.max(2, Math.min(innerWidth - 2, r.left + r.width / 2));
        var y = Math.max(2, Math.min(innerHeight - 2, r.top + r.height / 2));
        var under = document.elementsFromPoint(x, y);
        for (var i = 0; i < under.length; i++) {
          var q = under[i]; if (q === n || n.contains(q)) continue;
          var c2 = px(getComputedStyle(q).backgroundColor);
          if (c2 && c2.a === 1) return flatten(c2);
        }
      }
      n = n.parentElement;
    }
    return flatten({ r: 255, g: 255, b: 255, a: 1 });
  }

  window.__audit = function () {
    var out = [];
    document.querySelectorAll('body *').forEach(function (el) {
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      var r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
      var txt = Array.prototype.filter.call(el.childNodes, function (n) { return n.nodeType === 3; })
        .map(function (n) { return n.textContent.trim(); }).join(' ').trim();
      if (!txt) return;
      /* Text sitting on a photograph is not a token question. */
      /* Text that sits ON a photograph is not a token question -- but only
         where a photograph is actually there. A caption over a card with no
         render has nothing behind it but a swatch, and that IS one. */
      var onArt = el.closest('.modal-swatch, .gcard-media, .example-media, .example-frame, .tile-media, .card-media');
      /* A card caption is painted over whatever the card shows -- a render,
         or the swatch plus its foot gradient. Neither is reachable by
         walking ANCESTORS (the scrim is a sibling, and a gradient has no
         numeric colour), so these are reported separately and checked by
         eye rather than counted as token failures. */
      var cap = el.closest('.gcard-meta, .trend-card');
      if (cap && cap.querySelector('.gcard-scrim, .trend-scrim') ||
          (cap && cap.closest('.gcard') && cap.closest('.gcard').querySelector('.gcard-scrim'))) {
        window.__onArt = (window.__onArt || 0) + 1;
        return;
      }
      if (onArt) return;
      var fg = px(cs.color); if (!fg) return;
      var bg = bgOf(el);
      var cr = ratio(fg.a < 1 ? over(fg, bg) : fg, bg);
      var sz = parseFloat(cs.fontSize), wt = parseInt(cs.fontWeight) || 400;
      var need = (sz >= 24 || (sz >= 18.66 && wt >= 700)) ? 3 : 4.5;
      if (cr < need) out.push({
        sel: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : ''),
        text: txt.slice(0, 34), cr: +cr.toFixed(2), need: need, fg: cs.color,
        bg: 'rgb(' + Math.round(bg.r) + ',' + Math.round(bg.g) + ',' + Math.round(bg.b) + ')'
      });
    });
    return out;
  };

  window.__run = function (theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var s = document.getElementById('qa');
    if (!s) { s = document.createElement('style'); s.id = 'qa'; document.head.appendChild(s); }
    /* The pane freezes IntersectionObserver, so reveal targets never get
       .in-view and sit at opacity 0. Force them visible or the audit only
       ever sees the hero. Dialogs are opened the same way. */
    s.textContent = '.js [data-reveal]>*,.js [data-reveal-items]>*,.js .reveal{opacity:1!important;animation:none!important}'
      + '.modal-backdrop{opacity:1!important;pointer-events:auto!important}';
    return new Promise(function (res) { setTimeout(function () { res(window.__audit()); }, 350); });
  };
  window.__ready = true;
})();
