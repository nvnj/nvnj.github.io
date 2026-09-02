/* =============================================================================
   nvnj.github.io
   Two jobs: (1) draw Fig. 1, (2) hydrate the page from data/*.json.
   The HTML already contains complete, correct content. Hydration only REPLACES
   what it successfully loads — a failed fetch leaves the served markup intact,
   so the page is never blank, never a spinner, and is fully indexable.
   ========================================================================== */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var el = function (tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;   // textContent everywhere: all
    return n;                                  // JSON below is user-editable text
  };

  /* ------------------------------------------------------------ SCROLL SPY */
  var IDS = ["top", "experience", "work", "hackathons", "stack", "sources", "contact"];
  var navLinks = $$(".toc a, .topbar a");

  function markCurrent(id) {
    navLinks.forEach(function (a) {
      if (a.getAttribute("href") === "#" + id) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
  }
  markCurrent("top");

  if ("IntersectionObserver" in window) {
    var ratio = {};
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { ratio[e.target.id] = e.isIntersecting ? e.intersectionRatio : 0; });
      var best = null, bestV = 0;
      IDS.forEach(function (id) { if ((ratio[id] || 0) > bestV) { bestV = ratio[id]; best = id; } });
      if (best) markCurrent(best);
    }, { threshold: [0, .15, .4, .75], rootMargin: "-14% 0px -55% 0px" });
    IDS.forEach(function (id) { var n = document.getElementById(id); if (n) spy.observe(n); });
  }

  /* ---------------------------------------------------------------- FIG. 1
     A projected depth field. Points recede along a ruled ground plane and are
     shaded by range between two theme tokens; two objects carry a measured
     distance derived from the plot's own scale. */
  (function figure() {
    var cv = $("#plot");
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext("2d");
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    var W = 0, H = 0, dpr = 1, raf = null, last = 0;
    var NEAR = 2.4, FAR = 30, FH = 0.60, HORIZON = 0.60;
    var pts = [], objs = [];
    var C = {};

    function tokens() {
      var s = getComputedStyle(document.documentElement);
      var g = function (n, d) { return (s.getPropertyValue(n) || "").trim() || d; };
      C.bg   = g("--plot-bg", "#FAFAF8");
      C.rule = g("--plot-rule", "#D8D9D3");
      C.near = g("--plot-near", "#12333F");
      C.far  = g("--plot-far", "#9FBCC6");
      C.meta = g("--ink-3", "#7C8385");
      C.spot = g("--spot", "#1B4353");
    }

    function rgb(h) {
      h = h.replace("#", "");
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      var n = parseInt(h, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    function lerp(a, b, t) {
      var A = rgb(a), B = rgb(b);
      return [Math.round(A[0] + (B[0] - A[0]) * t),
              Math.round(A[1] + (B[1] - A[1]) * t),
              Math.round(A[2] + (B[2] - A[2]) * t)];
    }

    function seed() {
      pts.length = 0;
      for (var i = 0; i < 1060; i++) {
        var ground = Math.random() < 0.74;   // road returns vs vertical structure
        pts.push({
          x: (Math.random() - 0.5) * 15,
          y: ground ? Math.random() * 0.14 : Math.random() * 2.3,
          z: NEAR + Math.random() * (FAR - NEAR),
          j: Math.random()
        });
      }
      objs = [
        { x: -2.15, z: 9.4,  w: 1.55, h: 1.5,  tag: "VEHICLE" },
        { x:  2.45, z: 17.0, w: 0.8,  h: 1.75, tag: "PEDESTRIAN" }
      ];
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var r = cv.getBoundingClientRect();
      W = Math.max(260, r.width); H = Math.max(190, r.height);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* separate horizontal and vertical focal lengths so the ground plane opens
       up properly inside a wide, short panel */
    function proj(x, y, z) {
      var fh = (W * FH) / z, fv = (H * 1.45) / z;
      return { sx: W * 0.5 + x * fh, sy: H * HORIZON + (0.95 - y) * fv, fh: fh };
    }

    function draw() {
      tokens();
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
      ctx.lineWidth = 1;
      ctx.font = '10px "Azeret Mono", monospace';

      ctx.strokeStyle = C.rule; ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.moveTo(0, Math.round(H * HORIZON) + 0.5); ctx.lineTo(W, Math.round(H * HORIZON) + 0.5); ctx.stroke();

      [-6, -3, 0, 3, 6].forEach(function (gx) {          // converging rails
        var a = proj(gx, 0, NEAR), b = proj(gx, 0, FAR);
        ctx.globalAlpha = gx === 0 ? 0.95 : 0.52;
        ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
      });

      ctx.textAlign = "left";
      var lastY = 1e9;
      [5, 10, 15, 20, 25].forEach(function (d) {          // range rules
        var p = proj(0, 0, d), half = (W * FH) / d * 6.2;
        ctx.globalAlpha = 0.62; ctx.strokeStyle = C.rule;
        ctx.beginPath(); ctx.moveTo(p.sx - half, p.sy + 0.5); ctx.lineTo(p.sx + half, p.sy + 0.5); ctx.stroke();
        if (lastY - p.sy > 15) {                          // label only where it fits
          ctx.globalAlpha = 1; ctx.fillStyle = C.meta;
          ctx.fillText(d + " m", 9, p.sy - 3);
          lastY = p.sy;
        }
      });
      ctx.globalAlpha = 1;

      for (var i = 0; i < pts.length; i++) {              // returns, shaded by range
        var p = pts[i];
        if (p.z <= NEAR) continue;
        var q = proj(p.x, p.y, p.z);
        if (q.sx < -20 || q.sx > W + 20 || q.sy < -20 || q.sy > H + 20) continue;
        var t = Math.min(1, Math.max(0, (p.z - NEAR) / (FAR - NEAR)));
        var c = lerp(C.near, C.far, Math.pow(t, 0.62));
        var a = (1 - t) * 0.85 + 0.22;
        var r = Math.max(0.65, 2.3 * (1 - t) + 0.5);
        ctx.fillStyle = "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (a * (0.6 + p.j * 0.4)).toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(q.sx, q.sy, r, 0, 6.2832); ctx.fill();
      }

      objs.forEach(function (o) {                          // tracked objects
        if (o.z <= NEAR + 0.5) return;
        var base = proj(o.x, 0, o.z), top = proj(o.x, o.h, o.z);
        var w = o.w * base.fh, h = Math.max(6, base.sy - top.sy);
        var x = base.sx - w / 2, y = top.sy;
        if (x > W || x + w < 0) return;
        ctx.strokeStyle = C.spot; ctx.globalAlpha = 0.95;
        var cl = Math.min(9, w * 0.28);
        ctx.beginPath();
        ctx.moveTo(x, y + cl); ctx.lineTo(x, y); ctx.lineTo(x + cl, y);
        ctx.moveTo(x + w - cl, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cl);
        ctx.moveTo(x + w, y + h - cl); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - cl, y + h);
        ctx.moveTo(x + cl, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - cl);
        ctx.stroke();
        ctx.globalAlpha = 1; ctx.fillStyle = C.spot;
        ctx.fillText(o.tag + "  " + o.z.toFixed(1) + " m", x, y - 5);
      });
    }

    function frame(ts) {
      var dt = last ? Math.min((ts - last) / 1000, 0.05) : 0.016;
      last = ts;
      for (var i = 0; i < pts.length; i++) {
        pts[i].z -= 2.6 * dt;
        if (pts[i].z < NEAR) { pts[i].z = FAR; pts[i].x = (Math.random() - 0.5) * 15; }
      }
      objs.forEach(function (o) { o.z -= 2.13 * dt; if (o.z < NEAR + 1.2) o.z = FAR - 2; });
      draw();
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      last = 0;
      if (reduce.matches) draw(); else raf = requestAnimationFrame(frame);
    }

    seed(); resize(); start();

    var t = null;
    window.addEventListener("resize", function () {
      clearTimeout(t); t = setTimeout(function () { resize(); if (reduce.matches) draw(); }, 140);
    });
    if (reduce.addEventListener) reduce.addEventListener("change", start);
    var scheme = window.matchMedia("(prefers-color-scheme: dark)");
    if (scheme.addEventListener) scheme.addEventListener("change", function () { if (reduce.matches) draw(); });
    new MutationObserver(function () { if (reduce.matches) draw(); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    if ("IntersectionObserver" in window) {               // don't burn CPU off-screen
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { if (!reduce.matches && !raf) { last = 0; raf = requestAnimationFrame(frame); } }
          else if (raf) { cancelAnimationFrame(raf); raf = null; }
        });
      }, { threshold: 0 }).observe(cv);
    }
  })();

  /* -------------------------------------------------------------- HYDRATE */
  var MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  function fmtMonth(s) {
    if (!s) return "";
    var p = String(s).split("-");
    return MONTHS[(parseInt(p[1], 10) || 1) - 1] + " " + p[0];
  }
  function ago(iso) {
    if (!iso) return null;
    var ms = Date.now() - new Date(iso).getTime();
    if (isNaN(ms) || ms < 0) return null;
    var h = ms / 36e5;
    if (h < 1) return "JUST NOW";
    if (h < 24) return Math.round(h) + "H AGO";
    var d = Math.round(h / 24);
    if (d < 7) return d + "D AGO";
    return new Date(iso).toISOString().slice(0, 10).toUpperCase();
  }
  function tagRow(list) {
    var box = el("div", "tags");
    (list || []).forEach(function (s) { box.appendChild(el("span", "tag", s)); });
    return box;
  }

  function renderExperience(profile) {
    if (!profile || !Array.isArray(profile.experience) || !profile.experience.length) return;
    var host = $('[data-bind="experience"]');
    if (!host) return;
    var frag = document.createDocumentFragment();
    profile.experience.forEach(function (j) {
      var a = el("article", "entry");
      var when = el("div", "when");
      when.appendChild(document.createTextNode(fmtMonth(j.start) + " —"));
      when.appendChild(el("br"));
      if (j.end) when.appendChild(document.createTextNode(fmtMonth(j.end)));
      else when.appendChild(el("span", "now", "PRESENT"));
      a.appendChild(when);

      var body = el("div");
      body.appendChild(el("h3", null, j.title));
      body.appendChild(el("div", "org", [j.org, j.location].filter(Boolean).join(" · ")));
      var ul = el("ul", "bul");
      (j.bullets || []).forEach(function (b) {
        // a bullet may carry an optional `metric` that is spliced into {m}
        var text = typeof b === "string" ? b : (b.text || "");
        // `metric` is an optional COMPLETE clause. Every bullet already reads
        // correctly without it, so a missing number never leaves a dangling
        // "reduced by ." fragment on the page.
        if (b && typeof b === "object" && b.metric) {
          text = text.replace(/\.\s*$/, "") + ", " + b.metric + ".";
        }
        ul.appendChild(el("li", null, text));
      });
      body.appendChild(ul);
      if (j.stack && j.stack.length) body.appendChild(tagRow(j.stack));
      a.appendChild(body);
      frag.appendChild(a);
    });
    host.textContent = "";
    host.appendChild(frag);
  }

  function renderRepos(gh) {
    if (!gh || !Array.isArray(gh.repos) || !gh.repos.length) return;
    var lead = gh.repos.filter(function (r) { return r.featured; })[0];
    var rest = gh.repos.filter(function (r) { return r !== lead; });

    if (lead) {
      var host = $('[data-bind="lead-work"]');
      if (host) {
        var art = el("article", "lead-work");
        var left = el("div");
        left.appendChild(el("div", "kicker", "Current focus"));
        left.appendChild(el("h3", null, lead.title || lead.name));
        left.appendChild(el("p", null, lead.blurb || ""));
        if (lead.stack && lead.stack.length) left.appendChild(tagRow(lead.stack));
        art.appendChild(left);
        if (lead.facts && lead.facts.length) {
          var dl = el("dl", "facts");
          lead.facts.forEach(function (f) {
            var d = el("div", "fact");
            d.appendChild(el("dt", null, f.label));
            d.appendChild(el("dd", null, f.value));
            dl.appendChild(d);
          });
          art.appendChild(dl);
        }
        host.textContent = "";
        host.appendChild(art);
      }
    }

    var list = $('[data-bind="repos"]');
    if (!list || !rest.length) return;
    var frag = document.createDocumentFragment();
    rest.forEach(function (r) {
      var a = el("a", "work"); a.href = r.url; a.rel = "noopener";
      var L = el("div");
      var t = el("div", "work-t");
      t.appendChild(document.createTextNode(r.title || r.name));
      t.appendChild(el("span", "arw", "↗"));
      L.appendChild(t);
      L.appendChild(el("p", null, r.blurb || ""));
      a.appendChild(L);
      var m = el("div", "work-m");
      if (r.language) {
        var lg = el("span", "lang");
        var dot = el("i"); dot.style.background = r.languageColor || "#7C8385";
        lg.appendChild(dot); lg.appendChild(document.createTextNode(r.language));
        m.appendChild(lg);
      }
      if (r.stars > 0) m.appendChild(el("span", null, "★ " + r.stars));
      if (r.pushedAt) m.appendChild(el("span", null, fmtMonth(r.pushedAt.slice(0, 7))));
      a.appendChild(m);
      frag.appendChild(a);
    });
    list.textContent = "";
    list.appendChild(frag);
  }

  function renderHackathons(hk) {
    if (!hk || !Array.isArray(hk.projects) || !hk.projects.length) return;
    var host = $('[data-bind="hackathons"]');
    if (!host) return;
    var frag = document.createDocumentFragment();
    hk.projects.forEach(function (p) {
      var a = el("a", "hack"); a.href = p.url; a.rel = "noopener";
      var top = el("div", "hack-top");
      top.appendChild(el("h3", null, p.name));
      top.appendChild(el("span", p.won ? "prize" : "prize none", p.won ? (p.award || "Winner") : "Submitted"));
      a.appendChild(top);
      a.appendChild(el("p", null, p.tagline || ""));
      var m = el("div", "hack-m");
      if (p.hackathon) m.appendChild(el("span", null, p.hackathon.toUpperCase()));
      else if (p.year) m.appendChild(el("span", null, String(p.year)));
      if (p.stack && p.stack.length) m.appendChild(el("span", null, p.stack.join(" · ").toUpperCase()));
      if (p.likes) m.appendChild(el("span", null, "♥ " + p.likes));
      a.appendChild(m);
      frag.appendChild(a);
    });
    host.textContent = "";
    host.appendChild(frag);
  }

  function renderMeta(meta) {
    if (!meta) return;
    var g = $('[data-bind="gh-meta"]'), d = $('[data-bind="dp-meta"]');
    // show the last SUCCESSFUL sync — never a fake "just now" after a failure
    if (g && meta.github && meta.github.at) {
      var ga = ago(meta.github.at);
      g.textContent = "GITHUB.COM/NVNJ" + (ga ? " · SYNCED " + ga : "");
    }
    if (d && meta.devpost && meta.devpost.at) {
      var da = ago(meta.devpost.at);
      d.textContent = "DEVPOST.COM/NVNJ" + (da ? " · SYNCED " + da : "");
    }
  }

  function grab(name) {
    return fetch("data/" + name + ".json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  Promise.all([grab("profile"), grab("github"), grab("hackathons"), grab("meta")])
    .then(function (res) {
      try { renderExperience(res[0]); } catch (e) { console.warn("profile:", e); }
      try { renderRepos(res[1]); }      catch (e) { console.warn("github:", e); }
      try { renderHackathons(res[2]); } catch (e) { console.warn("hackathons:", e); }
      try { renderMeta(res[3]); }       catch (e) { console.warn("meta:", e); }
    });
})();
