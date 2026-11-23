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

  // ---- আজকের তারিখ (বাংলায়) ----
  var dl = $("[data-today]");
  if (dl) try {
    var parts = new Intl.DateTimeFormat("bn-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).formatToParts(new Date());
    var g = function (t) { for (var i = 0; i < parts.length; i++) if (parts[i].type === t) return parts[i].value; return ""; };
    dl.textContent = g("weekday") + ", " + g("day") + " " + g("month") + " " + g("year");
  } catch (e) {}

  // ---- ক্লিক গণনা, লিংক কপি ----
  var slug = (location.pathname.match(/\/posts\/([^/]+)/) || [])[1] || (location.pathname.replace(/\/+$/, "").split("/").pop() || "home");
  var SB = B.getAttribute("data-sb"), SBK = B.getAttribute("data-sbk"), FREE = B.getAttribute("data-free"), MAIN = B.getAttribute("data-main");
  D.addEventListener("click", function (ev) {
    var a = ev.target.closest && ev.target.closest("a[href]");
    if (a) {
      var h = a.getAttribute("href") || "";
      var target = FREE && h.indexOf(FREE) > -1 ? "free" : MAIN && h.indexOf(MAIN) > -1 ? "main" : null;
      if (target) {
        var box = a.closest(".mast,.learn,.foot,.prose,.author,.own-tools,.page-head,.seo-block");
        var place = box ? box.className.split(" ")[0] : "other";
        if (h.indexOf("utm_source") < 0 && h.indexOf("mailto:") !== 0) a.href = h + (h.indexOf("?") > -1 ? "&" : "?") + "utm_source=patrika&utm_medium=" + place + "&utm_campaign=" + encodeURIComponent(slug);
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
    var tx = el("div", "story-tx"), k = el("div", "kicker");
    k.appendChild(el("span", "tl t-" + y, p.l || ""));
    var tm = el("time", "", p.d || ""); tm.setAttribute("datetime", p.dt || ""); k.appendChild(tm);
    tx.appendChild(k); tx.appendChild(el("h3", "", p.t)); tx.appendChild(el("p", "", p.e));
    if (INDIA[p.i] || PRICE[p.p]) {
      var ul = el("ul", "badges");
      if (INDIA[p.i]) ul.appendChild(el("li", "b-in b-" + p.i, INDIA[p.i]));
      if (PRICE[p.p]) ul.appendChild(el("li", "b-pr b-" + p.p, PRICE[p.p]));
      tx.appendChild(ul);
    }
    a.appendChild(tx);
    if (p.ph && /^assets\/[\w./-]+$/.test(p.ph)) {
      var f = el("div", "story-pic"), img = el("img");
      img.src = R + p.ph; img.alt = ""; img.loading = "lazy"; img.decoding = "async";
      if (p.w) { img.width = p.w; img.height = p.h; }
      f.appendChild(img); a.appendChild(f);
    }
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

  // ---- ফিল্টার ----
  var feed = $("#feed"), fform = $("#fform");
  if (feed) {
    var home = B.classList.contains("k-home");
    var front = $("#front"), more = $("[data-more]"), title = $("#feed-title"), count = $("[data-feed-count]"), clear = $("[data-clear]"), fbadge = $("[data-fcount]");
    var staticKids = Array.prototype.slice.call(feed.children);
    var S = { type: "", aud: store.get("uap_aud") || "", india: "", price: "" };
    if (home) S.type = safe(new URLSearchParams(location.search).get("type") || "");
    var chips = $$(".chips .chip");
    var match = function (x) {
      if (S.type && x.y !== S.type) return false;
      if (S.aud && x.a.length && x.a.indexOf(S.aud) < 0) return false;
      if (S.india && x.i !== S.india) return false;
      if (S.price && x.p !== S.price) return false;
      return true;
    };
    var setChips = function () {
      if (!home) return;
      chips.forEach(function (c) {
        var on = (c.getAttribute("data-type") || "") === S.type;
        c.classList.toggle("on", on);
        if (on) { c.setAttribute("aria-current", "page"); if (c.scrollIntoView && c.parentNode.scrollWidth > c.parentNode.clientWidth) c.parentNode.scrollLeft = c.offsetLeft - 16; } else c.removeAttribute("aria-current");
      });
    };
    var shown = 0, list = [];
    var renderMore = function () {
      list.slice(shown, shown + 20).forEach(function (p) { feed.appendChild(storyEl(p)); });
      shown = Math.min(list.length, shown + 20);
      if (more) more.hidden = shown >= list.length;
    };
    var apply = function () {
      var explicit = S.type || S.india || S.price, any = explicit || S.aud;
      var n = (S.aud ? 1 : 0) + (S.india ? 1 : 0) + (S.price ? 1 : 0);
      if (fbadge) { fbadge.hidden = !n; fbadge.textContent = bn(n); }
      if (clear) clear.hidden = !any;
      setChips();
      var chip = S.type && $('.chip[data-type="' + S.type + '"]');
      if (title) title.textContent = chip ? chip.textContent : explicit ? "বাছাই করা খবর" : S.aud ? "আপনার জন্য সাজানো খবর" : title.getAttribute("data-default");
      if (home) {
        if (front) front.hidden = !!explicit;
        $$(".pager").forEach(function (p) { p.hidden = !!any; });
        if (!any) { feed.textContent = ""; staticKids.forEach(function (k) { feed.appendChild(k); }); if (more) more.hidden = true; if (count) count.textContent = ""; return; }
        getData().then(function (data) {
          var skip = explicit ? 0 : 5, now = Date.now();
          list = data.slice(skip).filter(match);
          list.sort(function (a, b) {
            var pa = a.y === "scam-alert" && now - new Date(a.dt) < 2592e5 ? 0 : 1, pb = b.y === "scam-alert" && now - new Date(b.dt) < 2592e5 ? 0 : 1;
            return pa - pb;
          });
          feed.textContent = ""; shown = 0;
          if (!list.length) feed.appendChild(el("p", "empty", "এই ফিল্টারে কোনো খবর নেই। একটা ফিল্টার সরিয়ে দেখুন।"));
          renderMore();
          if (count) count.textContent = bn(list.length) + "টি খবর";
        });
      } else {
        var c = 0;
        staticKids.forEach(function (k) {
          if (!k.classList.contains("story")) return;
          var ok = match({ y: S.type || k.getAttribute("data-t"), a: (k.getAttribute("data-a") || "").split(" ").filter(Boolean), i: k.getAttribute("data-i"), p: k.getAttribute("data-p") });
          k.hidden = !ok; if (ok) c++;
        });
        var none = $(".empty-f", feed);
        if (!c && !none) { none = el("p", "empty empty-f", "এই ফিল্টারে কোনো খবর নেই। একটা ফিল্টার সরিয়ে দেখুন।"); feed.appendChild(none); }
        if (none) none.hidden = !!c;
        if (count) count.textContent = any ? bn(c) + "টি খবর" : "";
      }
    };
    if (more) more.addEventListener("click", renderMore);
    if (clear) clear.addEventListener("click", function () { S = { type: "", aud: "", india: "", price: "" }; store.set("uap_aud", ""); push(); apply(); });
    var push = function () { if (home && history.pushState) history.pushState(null, "", S.type ? "?type=" + S.type : location.pathname); };
    if (home) {
      chips.forEach(function (c) {
        c.addEventListener("click", function (e) {
          if (e.metaKey || e.ctrlKey || e.shiftKey) return;
          e.preventDefault();
          S.type = c.getAttribute("data-type") || ""; push(); apply();
          var m = $("#main"), bar = $(".secbar"), top = m ? m.offsetTop - (bar ? bar.offsetHeight : 0) : 0;
          if (scrollY > top) scrollTo({ top: top, behavior: reduced ? "auto" : "smooth" });
        });
      });
      addEventListener("popstate", function () { S.type = safe(new URLSearchParams(location.search).get("type") || ""); apply(); });
    }
    if (fform) {
      var sheet = $("#fsheet");
      sheet.addEventListener("sheetopen", function () { ["aud", "india", "price"].forEach(function (k) { $$('input[name="' + k + '"]', fform).forEach(function (r) { r.checked = r.value === S[k]; }); }); });
      fform.addEventListener("submit", function (e) {
        e.preventDefault();
        var fd = new FormData(fform);
        S.aud = safe(fd.get("aud") || ""); S.india = safe(fd.get("india") || ""); S.price = safe(fd.get("price") || "");
        store.set("uap_aud", S.aud); store.set("uap_aud_seen", "1");
        closeSheet(); apply();
      });
      fform.addEventListener("reset", function () { setTimeout(function () { $$('input[value=""]', fform).forEach(function (r) { r.checked = true; }); }, 0); });
    }
    if (S.type || S.aud) apply();

    // প্রথমবার: "আপনি কে?"
    var pick = $("#audpick");
    if (pick && !store.get("uap_aud") && !store.get("uap_aud_seen")) {
      pick.hidden = false;
      pick.addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b) return;
        store.set("uap_aud_seen", "1");
        var k = safe(b.getAttribute("data-aud") || "");
        if (k) { S.aud = k; store.set("uap_aud", k); apply(); }
        pick.hidden = true;
      });
    }
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
    inst.hidden = false; requestAnimationFrame(function () { inst.classList.add("open"); });
  };
  var hideInstall = function () { if (!inst) return; inst.classList.remove("open"); setTimeout(function () { inst.hidden = true; }, 220); };
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
