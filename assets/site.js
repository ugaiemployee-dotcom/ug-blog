// Unique AI পত্রিকা: ফিল্টার, খোঁজা, শেয়ার, PWA, নোটিফিকেশন
(function () {
  "use strict";
  var D = document, B = D.body, W = window, R = B.getAttribute("data-root") || "/";
  var $ = function (s, c) { return (c || D).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || D).querySelectorAll(s)); };
  var reduced = W.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { if (v == null || v === "") localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} },
    sget: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    sset: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
  };
  var el = function (tag, cls, txt) { var n = D.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
  var bn = function (n) { try { return new Intl.NumberFormat("bn-IN").format(n); } catch (e) { return String(n); } };
  var INDIA = { available: "ভারতে চালু ✅", soon: "ভারতে শীঘ্রই", no: "ভারতে এখনও নেই" };
  var PRICE = { free: "ফ্রি", freemium: "আংশিক ফ্রি", paid: "পেইড" };
  var safe = function (s) { return /^[a-z0-9-]*$/.test(s || "") ? s : ""; };

  // ---- অ্যাপের ভেতরের পাতা: "অ্যাপে ফিরুন" আগের পাতাটা অ্যাপ হলে পেছনে যায় (অবস্থা হারায় না) ----
  var iab = $("[data-ia-back]");
  if (iab) iab.addEventListener("click", function (e) {
    try { if (D.referrer && new URL(D.referrer).origin === location.origin && history.length > 1) { e.preventDefault(); history.back(); } } catch (x) {}
  });

  // ---- আজকের তারিখ, ঘড়ি (ভারতীয় সময়), "৩ ঘণ্টা আগে", "নতুন" ছাপ ----
  var DAY = 864e5, IST = 198e5;
  var dl = $("[data-today]");
  if (dl) try {
    var parts = new Intl.DateTimeFormat("bn-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).formatToParts(new Date());
    var g = function (t) { for (var i = 0; i < parts.length; i++) if (parts[i].type === t) return parts[i].value; return ""; };
    dl.textContent = g("weekday") + ", " + g("day") + " " + g("month") + " " + g("year");
  } catch (e) {}
  var days = function (n) { return n <= 0 ? "আজ" : n === 1 ? "গতকাল" : n < 7 ? bn(n) + " দিন আগে" : null; };
  // পোস্টের শুধু তারিখ আছে, তাই দিনের হিসেব; ফ্ল্যাশের ঠিক সময় আছে, তাই মিনিট-ঘণ্টা
  var relD = function (iso, now) { var n = Math.floor((now + IST) / DAY) - Math.floor(Date.parse(iso) / DAY); return isNaN(n) ? null : days(n); };
  var relT = function (iso, now) {
    var s = (now - Date.parse(iso)) / 1e3;
    if (isNaN(s)) return null;
    return s < 90 ? "এইমাত্র" : s < 3600 ? bn(Math.floor(s / 60)) + " মিনিট আগে" : s < 86400 ? bn(Math.floor(s / 3600)) + " ঘণ্টা আগে" : days(Math.floor(s / 86400));
  };
  var stamp = function (root) {
    var now = Date.now();
    $$("time[data-rel]", root).forEach(function (t) {
      var iso = t.getAttribute("datetime"), exact = t.getAttribute("data-rel") === "t";
      var r = exact ? relT(iso, now) : relD(iso, now);
      if (t.getAttribute("data-base") == null) { t.setAttribute("data-base", t.textContent); t.title = t.textContent; }
      var base = t.getAttribute("data-base");
      t.textContent = r ? (t.hasAttribute("data-keep") ? base + " (" + r + ")" : r) : base;
      if (t.hasAttribute("data-nb")) {
        var fresh = exact ? now - Date.parse(iso) < 216e5 : r === "আজ";
        var nx = t.nextElementSibling, has = nx && /^new/.test(nx.className);
        if (fresh && !has) t.parentNode.insertBefore(el("b", exact ? "new hot" : "new", "নতুন"), t.nextSibling);
        else if (!fresh && has) nx.remove();
      }
    });
  };
  var ck = $("[data-clock]");
  var clock = function () {
    if (!ck) return;
    var d = new Date(Date.now() + IST), h = d.getUTCHours(), m = d.getUTCMinutes();
    ck.textContent = (h < 4 ? "রাত" : h < 12 ? "সকাল" : h < 16 ? "দুপুর" : h < 18 ? "বিকেল" : h < 20 ? "সন্ধ্যা" : "রাত") + " " + bn(h % 12 || 12) + ":" + (m < 10 ? bn(0) : "") + bn(m);
    ck.parentNode.hidden = false;
  };
  clock(); stamp();
  setInterval(function () { if (!D.hidden) { clock(); stamp(); } }, 3e4);

  // ---- চলমান শিরোনাম ----
  var tk = $("[data-ticker]"), tkBtn = $("[data-tk-pause]"), tkT;
  var tkSpeed = function () { if (tk && !reduced) tk.style.animationDuration = Math.max(24, Math.round(tk.scrollWidth / 2 / 48)) + "s"; };
  if (tk) {
    tkSpeed();
    tk.addEventListener("touchstart", function () { clearTimeout(tkT); tk.classList.add("hold"); }, { passive: true });
    tk.addEventListener("touchend", function () { tkT = setTimeout(function () { tk.classList.remove("hold"); }, 2500); }, { passive: true });
    if (tkBtn) tkBtn.addEventListener("click", function () {
      var on = tk.classList.toggle("stop");
      tkBtn.setAttribute("aria-pressed", on ? "true" : "false");
      tkBtn.setAttribute("aria-label", on ? "শিরোনাম আবার চালান" : "শিরোনামের চলা থামান");
    });
  }

  // ---- নোটিফিকেশনের সরু সারি ----
  var ps = $("[data-pstrip]");
  if (ps) {
    if (store.get("uap_topics") || +(store.get("uap_ps_x") || 0) > Date.now() - 14 * DAY) ps.hidden = true;
    $("[data-pstrip-x]", ps).addEventListener("click", function () { store.set("uap_ps_x", String(Date.now())); ps.hidden = true; });
  }

  // ---- ক্লিক গণনা, লিংক কপি ----
  var slug = (location.pathname.match(/\/posts\/([^/]+)/) || [])[1] || (location.pathname.replace(/\/+$/, "").split("/").pop() || "home");
  var SB = B.getAttribute("data-sb"), SBK = B.getAttribute("data-sbk"), FREE = B.getAttribute("data-free"), MAIN = B.getAttribute("data-main");
  D.addEventListener("click", function (ev) {
    var a = ev.target.closest && ev.target.closest("a[href]");
    if (a) {
      var h = a.getAttribute("href") || "";
      var target = FREE && h.indexOf(FREE) > -1 ? "free" : MAIN && h.indexOf(MAIN) > -1 ? "main" : null;
      if (target) {
        var box = a.closest(".mast,.secnav,.notice,.foot,.prose,.author,.own-tools,.page-head,.seo-block");
        var place = (h.match(/utm_medium=([\w-]+)/) || [])[1] || (box ? box.className.split(" ")[0] : "other");
        if (h.indexOf("mailto:") !== 0 && h.indexOf("utm_campaign") < 0) a.href = h + (h.indexOf("?") > -1 ? "&" : "?") + (h.indexOf("utm_source") < 0 ? "utm_source=patrika&utm_medium=" + place + "&" : "") + "utm_campaign=" + encodeURIComponent(slug);
        if (SB && SBK) try {
          fetch(SB + "/rest/v1/news_clicks", { method: "POST", keepalive: true, headers: { apikey: SBK, Authorization: "Bearer " + SBK, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ slug: slug.slice(0, 120), target: target, place: place.slice(0, 30) }) }).catch(function () {});
        } catch (e) {}
      }
    }
    var c = ev.target.closest && ev.target.closest("[data-copy]");
    if (c && navigator.clipboard) {
      navigator.clipboard.writeText(c.getAttribute("data-copy")).then(function () {
        if (c.getAttribute("data-label") == null) c.setAttribute("data-label", c.textContent);
        c.textContent = "কপি হয়েছে ✓"; c.classList.add("done");
        setTimeout(function () { c.textContent = c.getAttribute("data-label"); c.classList.remove("done"); }, 1800);
      }).catch(function () {});
    }
    var sh = ev.target.closest && ev.target.closest(".s-native");
    if (sh && navigator.share) navigator.share({ title: sh.getAttribute("data-share-title"), url: sh.getAttribute("data-share-url") }).catch(function () {});
  });
  if (navigator.share) $$(".s-native").forEach(function (b) { b.hidden = false; });

  // ---- খবরের ডেটা ----
  var dataP = null;
  var getData = function () {
    if (!dataP) dataP = fetch(R + "search.json").then(function (r) { if (!r.ok) throw 0; return r.json(); }).catch(function () { dataP = null; return []; });
    return dataP;
  };
  // search.json থেকে একটা খবরের সারি; সব লেখা textContent দিয়ে বসে, innerHTML নয়
  var storyEl = function (p) {
    var y = safe(p.y), art = el("article", "story" + (y === "scam-alert" ? " is-alert" : ""));
    var a = el("a"); a.href = R + "posts/" + safe(p.s) + "/";
    if (p.ph && /^assets\/[\w./-]+$/.test(p.ph)) {
      var f = el("div", "story-pic"), img = el("img");
      img.src = R + p.ph; img.alt = ""; img.loading = "lazy"; img.decoding = "async";
      if (p.w) { img.width = p.w; img.height = p.h; }
      f.appendChild(img); a.appendChild(f);
    } else {
      var lt = el("span", "lt"); lt.setAttribute("aria-hidden", "true");
      if (p.ic && /^assets\/[\w./-]+$/.test(p.ic)) { var ic = el("img"); ic.src = R + p.ic; ic.alt = ""; ic.width = ic.height = 28; ic.loading = "lazy"; lt.appendChild(ic); }
      else lt.appendChild(el("i", "", p.tn || "AI"));
      a.appendChild(lt);
    }
    var tx = el("div", "story-tx"), k = el("div", "kicker");
    k.appendChild(el("span", "tl t-" + y, p.l || ""));
    var tm = el("time", "", p.d || ""); tm.setAttribute("datetime", p.dt || ""); tm.setAttribute("data-rel", "d"); tm.setAttribute("data-nb", ""); k.appendChild(tm);
    tx.appendChild(k); tx.appendChild(el("h3", "", p.t)); tx.appendChild(el("p", "", p.e));
    if (INDIA[p.i] || PRICE[p.p]) {
      var ul = el("ul", "badges");
      if (INDIA[p.i]) ul.appendChild(el("li", "b-in b-" + p.i, INDIA[p.i]));
      if (PRICE[p.p]) ul.appendChild(el("li", "b-pr b-" + p.p, PRICE[p.p]));
      tx.appendChild(ul);
    }
    a.appendChild(tx);
    art.appendChild(a);
    return art;
  };

  // ---- খোঁজা ----
  var q = $("#q"), out = $("#results");
  if (q && out) {
    var form = q.form;
    if (form) form.addEventListener("submit", function (e) { e.preventDefault(); });
    var msg = function (t) { out.textContent = ""; out.appendChild(el("p", "empty", t)); };
    var run = function () {
      var term = q.value.trim().toLowerCase();
      if (!term) return msg("উপরে খোঁজার শব্দ লিখুন।");
      getData().then(function (data) {
        var words = term.split(/\s+/);
        var hits = data.filter(function (p) { var hay = (p.t + " " + p.e + " " + p.k + " " + p.c + " " + p.l).toLowerCase(); return words.every(function (w) { return hay.indexOf(w) > -1; }); });
        if (!hits.length) return msg("কিছু পাওয়া যায়নি। অন্য শব্দ দিয়ে চেষ্টা করুন।");
        out.textContent = "";
        hits.slice(0, 40).forEach(function (p) { out.appendChild(storyEl(p)); });
        stamp(out);
      });
    };
    var p0 = new URLSearchParams(location.search).get("q");
    if (p0) q.value = p0;
    run();
    q.addEventListener("input", run);
    if (!p0) q.focus();
  }

  // ---- পড়ার অগ্রগতি ----
  var bar = $(".progress i"), art = $(".article .prose");
  if (bar && art) {
    var tick = function () {
      var h = D.documentElement, max = h.scrollHeight - innerHeight;
      bar.style.transform = "scaleX(" + (max > 0 ? Math.min(1, (scrollY || h.scrollTop) / max) : 0) + ")";
    };
    addEventListener("scroll", tick, { passive: true }); tick();
    var reads = +(store.get("uap_reads") || 0);
    store.set("uap_reads", String(reads + 1));
  }

  // ---- শিট (ফিল্টার, নোটিফিকেশন) ----
  var lastFocus = null, openS = null;
  var focusables = function (s) { return $$("input:not([disabled]),button:not([disabled]):not([hidden]),a[href]", s).filter(function (n) { return n.offsetParent !== null; }); };
  var openSheet = function (id, opener) {
    var s = D.getElementById(id); if (!s) return;
    lastFocus = opener || D.activeElement; openS = s;
    s.hidden = false; D.documentElement.classList.add("noscroll");
    s.dispatchEvent(new CustomEvent("sheetopen"));
    requestAnimationFrame(function () { s.classList.add("open"); var f = focusables(s); if (f[1] || f[0]) (f[1] || f[0]).focus(); });
  };
  var closeSheet = function () {
    var s = openS; if (!s) return; openS = null;
    s.classList.remove("open"); D.documentElement.classList.remove("noscroll");
    setTimeout(function () { s.hidden = true; }, reduced ? 0 : 220);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };
  D.addEventListener("click", function (e) {
    var o = e.target.closest && e.target.closest("[data-sheet]");
    if (o) { e.preventDefault(); openSheet(o.getAttribute("data-sheet"), o); return; }
    if (e.target.closest && e.target.closest("[data-close]")) closeSheet();
  });
  D.addEventListener("keydown", function (e) {
    if (!openS) return;
    if (e.key === "Escape") { closeSheet(); return; }
    if (e.key === "Tab") {
      var f = focusables(openS); if (!f.length) return;
      if (e.shiftKey && D.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && D.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  // ---- ফিল্টার ("আপনি কে?" এখন ফিল্টারের শিটের ভেতরে) ----
  var feed = $("#feed"), fform = $("#fform");
  if (feed) {
    var home = B.classList.contains("k-home");
    var front = $("#front"), fwrap = $("#fwrap"), more = $("[data-more]"), title = $("#feed-title"), count = $("[data-feed-count]"), clear = $("[data-clear]"), fbadge = $("[data-fcount]"), who = $("[data-who]");
    var staticKids = Array.prototype.slice.call(feed.children);
    // প্রথম পাতায় আগের বাছাই নিজে থেকে চাপানো হয় না, নইলে নিউজরুমটাই ঢাকা পড়ে; শিট খুললে বাছাইটা টিক দেওয়া থাকে
    var S = { type: "", aud: home ? "" : store.get("uap_aud") || "", india: "", price: "" };
    if (home) S.type = safe(new URLSearchParams(location.search).get("type") || "");
    var setWho = function () {
      if (!who || !fform) return;
      var k = safe(store.get("uap_aud") || ""), r = k && $('input[name="aud"][value="' + k + '"]', fform);
      who.textContent = r ? r.parentNode.textContent.trim() : "আপনি কে?";
      who.classList.toggle("on", !!r);
    };
    var match = function (x) {
      if (S.type && x.y !== S.type) return false;
      if (S.aud && x.a.length && x.a.indexOf(S.aud) < 0) return false;
      if (S.india && x.i !== S.india) return false;
      if (S.price && x.p !== S.price) return false;
      return true;
    };
    var shown = 0, list = [];
    var renderMore = function () {
      list.slice(shown, shown + 20).forEach(function (p) { feed.appendChild(storyEl(p)); });
      shown = Math.min(list.length, shown + 20);
      if (more) more.hidden = shown >= list.length;
      stamp(feed);
    };
    var apply = function () {
      var explicit = S.type || S.india || S.price, any = explicit || S.aud;
      var n = (S.aud ? 1 : 0) + (S.india ? 1 : 0) + (S.price ? 1 : 0);
      if (fbadge) { fbadge.hidden = !n; fbadge.textContent = bn(n); }
      if (clear) clear.hidden = !any;
      setWho();
      if (home) {
        if (front) front.hidden = !!any;
        if (fwrap) fwrap.hidden = !any;
        if (!any) return;
        var tl = S.type && $('.sn.t-' + S.type);
        if (title) title.textContent = tl ? tl.textContent : explicit ? "বাছাই করা খবর" : "আপনার জন্য সাজানো খবর";
        getData().then(function (data) {
          var now = Date.now();
          list = data.filter(match);
          list.sort(function (a, b) {
            var pa = a.y === "scam-alert" && now - new Date(a.dt) < 2592e5 ? 0 : 1, pb = b.y === "scam-alert" && now - new Date(b.dt) < 2592e5 ? 0 : 1;
            return pa - pb;
          });
          feed.textContent = ""; shown = 0;
          if (!list.length) feed.appendChild(el("p", "empty", "এই ফিল্টারে কোনো খবর নেই। একটা ফিল্টার সরিয়ে দেখুন।"));
          renderMore();
          if (count) count.textContent = bn(list.length) + "টি খবর";
          scrollTo(0, 0);
        });
      } else {
        var c = 0;
        staticKids.forEach(function (k) {
          if (!k.classList.contains("story")) return;
          var ok = match({ y: k.getAttribute("data-t"), a: (k.getAttribute("data-a") || "").split(" ").filter(Boolean), i: k.getAttribute("data-i"), p: k.getAttribute("data-p") });
          k.hidden = !ok; if (ok) c++;
        });
        var none = $(".empty-f", feed);
        if (!c && !none) { none = el("p", "empty empty-f", "এই ফিল্টারে কোনো খবর নেই। একটা ফিল্টার সরিয়ে দেখুন।"); feed.appendChild(none); }
        if (none) none.hidden = !!c;
        if (count) count.textContent = any ? bn(c) + "টি খবর" : "";
      }
    };
    if (more) more.addEventListener("click", renderMore);
    if (clear) clear.addEventListener("click", function () {
      S = { type: "", aud: "", india: "", price: "" }; store.set("uap_aud", "");
      if (home && history.replaceState) history.replaceState(null, "", location.pathname);
      apply();
    });
    if (home) addEventListener("popstate", function () { S.type = safe(new URLSearchParams(location.search).get("type") || ""); apply(); });
    if (fform) {
      $("#fsheet").addEventListener("sheetopen", function () {
        ["aud", "india", "price"].forEach(function (k) {
          var v = k === "aud" ? S.aud || store.get("uap_aud") || "" : S[k];
          $$('input[name="' + k + '"]', fform).forEach(function (r) { r.checked = r.value === v; });
        });
      });
      fform.addEventListener("submit", function (e) {
        e.preventDefault();
        var fd = new FormData(fform);
        S.aud = safe(fd.get("aud") || ""); S.india = safe(fd.get("india") || ""); S.price = safe(fd.get("price") || "");
        store.set("uap_aud", S.aud);
        closeSheet(); apply();
      });
      fform.addEventListener("reset", function () { setTimeout(function () { $$('input[value=""]', fform).forEach(function (r) { r.checked = true; }); }, 0); });
    }
    setWho();
    if (S.type || S.aud) apply();
  }

  // ---- AI বাজার: বিভাগ বাছা আর সাজানো ----
  var bz = $("[data-bazar]"), rows = bz ? $$("tbody tr", bz) : [], bdraw = function () {}, bsort = bdraw;
  if (bz) {
    var tb = $("tbody", bz), lim = +bz.getAttribute("data-bazar") || 0, bcat = "", sk = "d", dir = -1, bempty = $(".bz-empty", bz);
    bdraw = function () {
      var c = 0;
      rows.forEach(function (r) {
        var ok = !bcat || r.getAttribute("data-c") === bcat;
        if (ok) { c++; if (lim && !bcat && c > lim) ok = false; }
        r.classList.remove("bz-x"); r.hidden = !ok;
      });
      if (bempty) bempty.hidden = !!c;
    };
    bsort = function () {
      rows.sort(function (a, b) {
        var x = a.getAttribute("data-" + sk), y = b.getAttribute("data-" + sk);
        if (sk === "n") { x = +x; y = +y; }
        return (x < y ? -1 : x > y ? 1 : 0) * dir;
      });
      rows.forEach(function (r) { tb.appendChild(r); });
      bdraw();
    };
    bz.addEventListener("click", function (e) {
      var t = e.target.closest("[data-bcat]"), s = e.target.closest("[data-sort]");
      if (t) {
        bcat = safe(t.getAttribute("data-bcat"));
        $$("[data-bcat]", bz).forEach(function (b) { b.setAttribute("aria-pressed", b === t ? "true" : "false"); });
        bdraw();
      } else if (s) {
        var k = s.getAttribute("data-sort");
        if (k === sk) dir = -dir; else { sk = k; dir = k === "name" ? 1 : -1; }
        $$("[data-sort]", bz).forEach(function (b) { b.classList.toggle("on", b === s); b.parentNode.setAttribute("aria-sort", b === s ? (dir > 0 ? "ascending" : "descending") : "none"); });
        bsort();
      }
    });
  }

  // ---- AI ফ্ল্যাশ: লোড হলে আর প্রতি ৫ মিনিটে তাজা। না পেলে পাতায় বসানো খবরই থাকে ----
  var FAPI = B.getAttribute("data-briefs"), fboxes = $$("[data-flash]"), TL = {};
  var INS = { available: "ভারতে চালু", soon: "ভারতে শীঘ্রই", no: "ভারতে নেই" };
  try { TL = JSON.parse(fboxes[0].getAttribute("data-tl")) || {}; } catch (e) {}
  var fid = function (v) { return String(v == null ? "" : v).replace(/[^\w-]/g, "").slice(0, 40); };
  var ftime = function (t) { try { return new Intl.DateTimeFormat("bn-IN", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(t)); } catch (e) { return ""; } };
  var clean = function (j) {
    var now = Date.now();
    return (j && Array.isArray(j.briefs) ? j.briefs : []).filter(function (b) {
      var t = b && Date.parse(b.time);
      return b && typeof b.title === "string" && b.title.trim() && fid(b.id) && !isNaN(t) && now - t < 48 * 36e5 && t < now + 6e5;
    }).sort(function (a, b) { return Date.parse(b.time) - Date.parse(a.time); }).slice(0, 60);
  };
  var timeEl = function (t) { var n = el("time", "", ftime(t)); n.setAttribute("datetime", new Date(t).toISOString()); n.setAttribute("data-rel", "t"); return n; };
  var flashEl = function (b, full) {
    var id = fid(b.id), brk = +b.importance >= 3, li = el("li", "fl" + (brk ? " fl-brk" : "")), a = el("a"), m = el("span", "fl-m"), y = safe(b.news_type), tm = timeEl(b.time);
    if (full) li.id = "f-" + id;
    a.href = (full ? "" : R + "flash/") + "#f-" + id;
    tm.setAttribute("data-nb", ""); m.appendChild(tm);
    if (brk) m.appendChild(el("b", "brk", "ব্রেকিং"));
    if (TL[y]) m.appendChild(el("span", "tl t-" + y, TL[y]));
    a.appendChild(m); a.appendChild(el("b", "fl-h", b.title.trim().slice(0, 160)));
    if (b.body) a.appendChild(el("p", "", String(b.body).slice(0, 500)));
    var chips = el("ul", "fl-c");
    if (b.tool) chips.appendChild(el("li", "c-tool", String(b.tool).slice(0, 40)));
    if (INS[b.india]) chips.appendChild(el("li", "b-" + b.india, INS[b.india]));
    if (PRICE[b.price]) chips.appendChild(el("li", "b-" + b.price, PRICE[b.price]));
    if (chips.firstChild) a.appendChild(chips);
    li.appendChild(a);
    return li;
  };
  var words = function (s) { var w = String(s).trim().split(/\s+/); return w.length > 8 ? w.slice(0, 8).join(" ") + "…" : w.join(" "); };
  var paint = function (j) {
    var list = clean(j);
    if (!list.length) return;
    fboxes.forEach(function (box) {
      var n = +box.getAttribute("data-flash") || 0, full = box.hasAttribute("data-full"), frag = D.createDocumentFragment(), live = n ? list.slice(0, n) : list;
      live.forEach(function (b) { frag.appendChild(flashEl(b, full)); });
      // ফ্ল্যাশ কম হলে পাতায় বসানো সর্বশেষ খবর (fl-p) দিয়ে বাকিটা ভরা থাকে
      if (!box.keep) box.keep = $$(".fl-p", box);
      box.keep.slice(0, Math.max(0, (n || 8) - live.length)).forEach(function (k) { frag.appendChild(k); });
      box.textContent = ""; box.appendChild(frag);
    });
    var up = Date.parse(j.updated_at) ? j.updated_at : list[0].time;
    $$("[data-flash-upd]").forEach(function (u) { u.textContent = "আপডেট "; u.appendChild(timeEl(up)); });
    // বড় খবর (importance 3) চলমান শিরোনামের সামনে
    if (tk) {
      $$(".tk-brk", tk).forEach(function (n) { n.remove(); });
      var uls = $$("ul", tk);
      list.filter(function (b) { return +b.importance >= 3 && Date.now() - Date.parse(b.time) < DAY; }).slice(0, 4).reverse().forEach(function (b) {
        uls.forEach(function (ul, i) {
          var li = el("li", "tk-brk"), a = el("a");
          a.href = R + "flash/#f-" + fid(b.id); if (i) a.tabIndex = -1;
          a.appendChild(el("b", "", "ব্রেকিং")); a.appendChild(D.createTextNode(b.title.trim().slice(0, 160)));
          li.appendChild(a); ul.insertBefore(li, ul.firstChild);
        });
      });
      tkSpeed();
    }
    // বোর্ডের টুলে আরও নতুন ফ্ল্যাশ থাকলে সারিটা তাজা হয়
    if (bz) {
      list.slice().reverse().forEach(function (b) {
        var name = String(b.tool || "").trim().toLowerCase(), tr = name && rows.filter(function (r) { return r.getAttribute("data-name") === name; })[0];
        if (!tr) return;
        var ist = new Date(Date.parse(b.time) + IST).toISOString().slice(0, 19);
        if (ist.slice(0, 10) < tr.getAttribute("data-d").slice(0, 10)) return;
        tr.setAttribute("data-d", ist);
        var ch = $(".bz-chg a", tr), wn = $(".bz-when", tr), nt = timeEl(b.time);
        ch.textContent = words(b.title); ch.href = R + "flash/#f-" + fid(b.id);
        nt.setAttribute("data-nb", ""); wn.textContent = ""; wn.appendChild(nt);
        var y = safe(b.news_type), ty = $(".bz-type", tr);
        if (TL[y]) { ty.textContent = ""; ty.appendChild(el("span", "tl t-" + y, TL[y])); }
        if (INS[b.india]) { $(".bz-in", tr).textContent = ""; $(".bz-in", tr).appendChild(el("span", "st st-" + b.india, INS[b.india].replace("ভারতে ", ""))); }
        if (PRICE[b.price]) { $(".bz-pr", tr).textContent = ""; $(".bz-pr", tr).appendChild(el("span", "st st-" + b.price, PRICE[b.price])); }
      });
      bsort();
    }
    stamp();
  };
  if (fboxes.length || tk || bz) {
    try { var old = JSON.parse(store.get("uap_briefs") || "null"); if (old) paint(old); } catch (e) {}
    var pulled = 0, pull = function () {
      if (!FAPI || D.hidden || Date.now() - pulled < 6e4) return;
      pulled = Date.now();
      fetch(FAPI, { headers: { Accept: "application/json" } }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
        var list = clean(j);
        if (!list.length) return;
        store.set("uap_briefs", JSON.stringify({ updated_at: j.updated_at, briefs: list.slice(0, 30) }));
        paint(j);
      }).catch(function () {});
    };
    pull(); setInterval(pull, 3e5);
    D.addEventListener("visibilitychange", pull);
  }

  // ---- PWA: service worker ----
  var hasSW = "serviceWorker" in navigator;
  if (hasSW) addEventListener("load", function () { navigator.serviceWorker.register(R + "sw.js").catch(function () {}); });

  // ---- ইনস্টল ----
  var inst = $("#install"), deferred = null;
  var standalone = (W.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone;
  var ua = navigator.userAgent, ios = /iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios|edgios|opios/i.test(ua);
  if (!store.sget("uap_t0")) store.sset("uap_t0", String(Date.now()));
  var t0 = +store.sget("uap_t0") || Date.now(), loadedAt = Date.now();
  var dismissed = +(store.get("uap_inst_x") || 0) > Date.now() - 14 * 864e5;
  var eligible = function () { return +(store.get("uap_reads") || 0) >= 2 || Date.now() - t0 >= 4e4; };
  var showInstall = function () {
    if (!inst || standalone || dismissed || !inst.hidden || (!deferred && !ios) || !eligible()) return;
    if (Date.now() - loadedAt < 4000) return setTimeout(showInstall, 4000);
    if (openS) return setTimeout(showInstall, 5000);
    if (ios) { $("[data-ios]", inst).hidden = false; $("[data-std]", inst).hidden = true; $("[data-install]", inst).hidden = true; $("[data-install-x]", inst).textContent = "ঠিক আছে"; }
    inst.hidden = false; B.classList.add("has-install"); requestAnimationFrame(function () { inst.classList.add("open"); });
  };
  var hideInstall = function () { if (!inst) return; B.classList.remove("has-install"); inst.classList.remove("open"); setTimeout(function () { inst.hidden = true; }, 220); };
  if (inst) {
    addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; showInstall(); });
    setTimeout(showInstall, Math.max(4000, 4e4 - (Date.now() - t0)));
    if (ios) showInstall();
    $("[data-install]", inst).addEventListener("click", function () {
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.then(function () { deferred = null; hideInstall(); }).catch(hideInstall);
    });
    $("[data-install-x]", inst).addEventListener("click", function () { store.set("uap_inst_x", String(Date.now())); dismissed = true; hideInstall(); });
    addEventListener("appinstalled", hideInstall);
  }

  // ---- নোটিফিকেশন (ব্যাকএন্ড চালু হলে site.config.json-এ pushEnabled: true) ----
  var API = B.getAttribute("data-push-api");
  var canPush = B.getAttribute("data-push") === "1" && API && hasSW && "PushManager" in W && "Notification" in W;
  var pform = $("#pform");
  // নোটিফিকেশনের বোতাম: push থাকলে শিট খোলে, না থাকলে Telegram চ্যানেলে যায়
  $$("[data-push-cta]").forEach(function (a) {
    if (canPush && pform) a.addEventListener("click", function (e) { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); openSheet("psheet", a); });
    else { var sp = $("span", a); if (sp) sp.textContent = a.getAttribute("data-alt"); var tg = a.parentNode.querySelector("[data-tg]"); if (tg) { tg.removeAttribute("target"); tg.href = R + "tools/"; $("span", tg).textContent = "সব AI টুল দেখুন"; } }
  });
  // খবরের নিচের ছোট বার (শেয়ার + নোটিফিকেশন)
  var abar = $("#abar");
  if (abar && !store.sget("uap_abar_x")) {
    var abarOn = false, abarCheck = function () {
      var on = (W.scrollY || 0) > 500 && !openS;
      if (on !== abarOn) { abarOn = on; if (on) { abar.hidden = false; requestAnimationFrame(function () { abar.classList.add("open"); }); } else abar.classList.remove("open"); }
    };
    addEventListener("scroll", abarCheck, { passive: true });
    $("[data-abar-x]", abar).addEventListener("click", function () { store.sset("uap_abar_x", "1"); abar.hidden = true; removeEventListener("scroll", abarCheck); });
  }
  if (canPush && pform) {
    $$("[data-push-open],[data-push-box]").forEach(function (n) { n.hidden = false; });
    var pmsg = $("[data-push-msg]", pform), on = $("[data-push-on]", pform), off = $("[data-push-off]", pform);
    var boxes = $$('input[name="topic"]', pform);
    var say = function (t) { pmsg.textContent = t; };
    var limit = function () { var n = boxes.filter(function (b) { return b.checked; }).length; boxes.forEach(function (b) { b.disabled = !b.checked && n >= 5; }); };
    boxes.forEach(function (b) { b.addEventListener("change", limit); });
    var saved = (store.get("uap_topics") || "").split(",").filter(Boolean);
    if (saved.length) boxes.forEach(function (b) { b.checked = saved.indexOf(b.value) > -1; });
    limit();
    var post = function (body) {
      return fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(function (r) { return r.json(); }).then(function (j) { if (!j || !j.ok) throw new Error("server"); return j; });
    };
    var key = function (b64) {
      var s = (b64 + "===".slice((b64.length + 3) % 4)).replace(/-/g, "+").replace(/_/g, "/"), raw = atob(s), a = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) a[i] = raw.charCodeAt(i);
      return a;
    };
    var current = function () { return navigator.serviceWorker.ready.then(function (r) { return r.pushManager.getSubscription(); }); };
    $("#psheet").addEventListener("sheetopen", function () {
      current().then(function (s) { off.hidden = !s; on.textContent = s ? "পছন্দ সেভ করুন" : "নোটিফিকেশন চালু করুন"; }).catch(function () {});
    });
    pform.addEventListener("submit", function (e) {
      e.preventDefault();
      var topics = boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; }).slice(0, 5);
      if (!topics.length) return say("অন্তত একটা ধরন বেছে নিন।");
      on.disabled = true; say("চালু করা হচ্ছে…");
      Notification.requestPermission().then(function (perm) {
        if (perm !== "granted") throw new Error("perm");
        return navigator.serviceWorker.ready;
      }).then(function (reg) {
        return reg.pushManager.getSubscription().then(function (s) {
          if (s) return s;
          return fetch(API + "?action=vapid").then(function (r) { return r.json(); }).then(function (j) {
            if (!j || !j.publicKey) throw new Error("server");
            return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(j.publicKey) });
          });
        });
      }).then(function (sub) {
        return post({ action: "subscribe", subscription: sub.toJSON(), topics: topics });
      }).then(function () {
        store.set("uap_topics", topics.join(",")); off.hidden = false; on.textContent = "পছন্দ সেভ করুন";
        say("নোটিফিকেশন চালু হয়েছে। বেছে নেওয়া ধরনের বড় খবর এলেই জানাব।");
      }).catch(function (err) {
        say(err && err.message === "perm" ? "অনুমতি পাওয়া যায়নি। ব্রাউজারের সাইট সেটিংস থেকে এই সাইটের নোটিফিকেশন চালু করে আবার চেষ্টা করুন।" : "এখন চালু করা গেল না। একটু পরে আবার চেষ্টা করুন।");
      }).then(function () { on.disabled = false; });
    });
    off.addEventListener("click", function () {
      off.disabled = true;
      current().then(function (s) {
        if (!s) return;
        return post({ action: "unsubscribe", endpoint: s.endpoint }).catch(function () {}).then(function () { return s.unsubscribe(); });
      }).then(function () {
        store.set("uap_topics", ""); off.hidden = true; on.textContent = "নোটিফিকেশন চালু করুন"; say("নোটিফিকেশন বন্ধ হয়েছে।");
      }).catch(function () { say("এখন বন্ধ করা গেল না। একটু পরে আবার চেষ্টা করুন।"); }).then(function () { off.disabled = false; });
    });
  }

  // ---- অফলাইন পাতা: ফোনে রাখা খবরের তালিকা ----
  var ol = $("#offline-list");
  var re = $("[data-reload]"); if (re) re.addEventListener("click", function () { location.reload(); });
  if (ol && W.caches) {
    caches.open("uap-pages").then(function (c) { return c.keys(); }).then(function (keys) {
      var slugs = keys.map(function (k) { return (new URL(k.url).pathname.match(/^\/posts\/([a-z0-9-]+)\/$/) || [])[1]; }).filter(Boolean);
      if (!slugs.length) return;
      return caches.match(new URL(R + "search.json", location.href).href).then(function (r) { return r ? r.json() : []; }).catch(function () { return []; }).then(function (data) {
        var map = {}; data.forEach(function (p) { map[p.s] = p; });
        ol.textContent = "";
        data.filter(function (p) { return slugs.indexOf(p.s) > -1; }).forEach(function (p) { var n = storyEl(p); var im = $("img", n); if (im) im.parentNode.remove(); ol.appendChild(n); });
        slugs.filter(function (s) { return !map[s]; }).forEach(function (s) { var a = el("a", "plain-link", s.replace(/-/g, " ")); a.href = R + "posts/" + s + "/"; ol.appendChild(a); });
      });
    }).catch(function () {});
  }
})();
