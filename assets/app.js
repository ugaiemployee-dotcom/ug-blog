// Unique AI পত্রিকা: কার্ড ফিড (/app/)। এক স্ক্রিনে এক খবর, উল্টো পিঠে "আজই করুন"।
// site.js (শিট, নোটিফিকেশন, service worker) আর daily.js (স্ট্রিক, কপি, মাপজোখ)-এর পরে চলে। কিছু না পেলে কার্ডগুলো যেমন আছে তেমনই পড়া যায়।
(function () {
  "use strict";
  var D = document, B = D.body, W = window, H = D.documentElement;
  var $ = function (s, c) { return (c || D).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || D).querySelectorAll(s)); };
  var feed = $("#feed");
  if (!feed) return;
  var U = W.UAPD || null;
  var ls = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} },
    json: function (k) { try { var v = JSON.parse(localStorage.getItem(k) || "null"); return v && typeof v === "object" ? v : null; } catch (e) { return null; } },
    put: function (k, o) { try { localStorage.setItem(k, JSON.stringify(o)); } catch (e) {} },
  };
  var bn = function (n) { try { return new Intl.NumberFormat("bn-IN", { useGrouping: false }).format(n); } catch (e) { return String(n); } };
  var ist = function (off) { return new Date(Date.now() + 198e5 + (off || 0) * 864e5).toISOString().slice(0, 10); };
  var reduced = W.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var el = function (tag, cls, txt) { var n = D.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };

  // ---- টোস্ট ----
  var toastEl = $("#atoast"), toastT;
  var toast = function (msg) {
    if (!toastEl) return;
    toastEl.textContent = msg; toastEl.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 2600);
  };

  // ---- লেখার মাপ ----
  var fs = ls.get("uap_app_fs"); if (!/^[sml]$/.test(fs || "")) fs = "m";
  var setFs = function (v) { fs = v; H.setAttribute("data-fs", v); ls.set("uap_app_fs", v); fitAll(); };
  H.setAttribute("data-fs", fs);

  // ---- সারাংশ: কার্ডে যতটা ধরে ততটাই (আগে বাড়তি পয়েন্ট বাদ, তারপর লাইন ছাঁটা) ----
  var fit = function (s) {
    var sum = $(".c-sum", s); if (!sum || !sum.clientHeight) return;
    var p = $("p", sum), lis = $$("li", sum);
    lis.forEach(function (li) { li.hidden = false; });
    if (p) { p.classList.remove("cl"); p.style.webkitLineClamp = ""; }
    for (var i = lis.length - 1; i >= 0 && sum.scrollHeight > sum.clientHeight + 1; i--) lis[i].hidden = true;
    if (p && sum.scrollHeight > sum.clientHeight + 1) {
      var lh = parseFloat(getComputedStyle(p).lineHeight) || 26;
      p.classList.add("cl"); p.style.webkitLineClamp = String(Math.max(2, Math.floor(sum.clientHeight / lh)));
    }
  };
  var fitAll = function () { $$(".slide", feed).forEach(fit); };

  // ---- অবস্থা: কোন কার্ডে আছি, কোনগুলো পড়া ----
  var slides = [], cur = 0;
  var read = ls.json("uap_app_read") || {};
  Object.keys(read).forEach(function (k) { if (!(read[k] >= ist(-14))) delete read[k]; });
  var curEl = $("[data-cur]"), totEl = $("[data-total]"), unEl = $("[data-unread]"), prog = $("[data-prog]");
  var news = function () { return slides.filter(function (s) { return s.getAttribute("data-kind") !== "end"; }); };
  var lastShown = -1;
  var paint = function () {
    var n = news(), total = n.length, unread = n.filter(function (s) { return !read[s.getAttribute("data-id")]; }).length;
    var pos = Math.min(cur + 1, total);
    if (totEl) totEl.textContent = bn(total);
    if (curEl && pos !== lastShown) {
      curEl.textContent = bn(pos); lastShown = pos;
      if (!reduced) { curEl.classList.remove("tick"); void curEl.offsetWidth; curEl.classList.add("tick"); }
    }
    if (unEl) { unEl.textContent = unread ? bn(unread) + "টা না-পড়া" : "সব পড়া হয়েছে"; unEl.classList.toggle("done", !unread); }
    if (prog) {
      if (prog.children.length !== slides.length) { prog.textContent = ""; slides.forEach(function (s) { prog.appendChild(el("i", s.getAttribute("data-kind") === "end" ? "end" : "")); }); }
      slides.forEach(function (s, i) { var c = prog.children[i]; c.classList.toggle("on", i === cur); c.classList.toggle("rd", i !== cur && !!read[s.getAttribute("data-id")]); });
    }
  };
  var readT;
  var arrive = function (i) {
    if (i === cur && slides[i] && slides[i].classList.contains("on")) return;
    var prev = slides[cur];
    if (prev && prev !== slides[i]) { prev.classList.remove("on"); unflip(prev); }
    cur = i; var s = slides[i]; if (!s) return;
    s.classList.add("on"); stopSpeak();
    clearTimeout(readT);
    var id = s.getAttribute("data-id");
    if (s.getAttribute("data-kind") === "end") { fillEnd(); ls.set("uap_app_end", ist()); }
    else if (id && !read[id]) readT = setTimeout(function () { read[id] = ist(); ls.put("uap_app_read", read); paint(); }, 1200);
    // পরের দুটো ছবি আগে থেকে এনে রাখা, যাতে টানলে ফাঁকা না দেখায়
    [1, 2].forEach(function (d) { var im = slides[i + d] && $(".c-pic img", slides[i + d]); if (im && im.loading === "lazy") im.loading = "eager"; });
    paint(); maybeInstall();
  };
  var io = "IntersectionObserver" in W ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting && e.intersectionRatio >= 0.6) arrive(slides.indexOf(e.target)); });
  }, { root: feed, threshold: [0.6] }) : null;
  var collect = function () {
    slides = $$(".slide", feed);
    if (io) { io.disconnect(); slides.forEach(function (s) { io.observe(s); }); }
    paint();
  };
  var go = function (i) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    var top = slides[i].offsetTop;
    if (feed.scrollTo) feed.scrollTo({ top: top, behavior: reduced ? "auto" : "smooth" }); else feed.scrollTop = top;
    if (!io) arrive(i);
  };

  // ---- কিবোর্ড আর মাউসের চাকা: এক ধাপে এক কার্ড ----
  D.addEventListener("keydown", function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey || $(".sheet.open") || coachOn) return;
    var t = e.target, tag = t && t.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    var k = e.key;
    if (k === "ArrowDown" || k === "PageDown" || k === "j") { e.preventDefault(); go(cur + 1); }
    else if (k === "ArrowUp" || k === "PageUp" || k === "k") { e.preventDefault(); go(cur - 1); }
    else if (k === "Home") { e.preventDefault(); go(0); }
    else if (k === "End") { e.preventDefault(); go(slides.length - 1); }
    else if ((k === "ArrowRight" || k === "ArrowLeft") && slides[cur]) { var f = $("[data-flip]", slides[cur]); if (f) { e.preventDefault(); flip(slides[cur]); } }
  });
  var wheelLock = 0;
  feed.addEventListener("wheel", function (e) {
    if (e.ctrlKey) return;
    var sc = e.target.closest && e.target.closest(".b-body,.endc");
    if (sc && sc.scrollHeight > sc.clientHeight + 1) {
      var up = e.deltaY < 0;
      if ((up && sc.scrollTop > 0) || (!up && sc.scrollTop + sc.clientHeight < sc.scrollHeight - 1)) return;
    }
    e.preventDefault();
    var now = Date.now();
    if (Math.abs(e.deltaY) < 12 || now < wheelLock) return;
    wheelLock = now + 520; go(cur + (e.deltaY > 0 ? 1 : -1));
  }, { passive: false });

  // ---- কার্ড উল্টানো ----
  var faces = function (s, back) {
    var f = $(".c-front", s), b = $(".c-back", s);
    if (!f || !b) return;
    f.inert = back; b.inert = !back;
    f.setAttribute("aria-hidden", back ? "true" : "false"); b.setAttribute("aria-hidden", back ? "false" : "true");
  };
  var unflip = function (s) { var c = $(".card", s); if (c && c.classList.contains("flipped")) { c.classList.remove("flipped"); faces(s, false); } };
  var flip = function (s) {
    var c = $(".card", s); if (!c || !$(".c-back", s)) return;
    var back = !c.classList.contains("flipped");
    c.classList.toggle("flipped", back); faces(s, back); stopSpeak();
    var focus = back ? $(".b-x", s) : $(".ab-go", s);
    if (focus) setTimeout(function () { try { focus.focus({ preventScroll: true }); } catch (e) {} }, reduced ? 0 : 320);
    if (back) { ls.set("uap_app_flipped", "1"); var bb = $(".b-body", s); if (bb) bb.scrollTop = 0; }
  };

  // ---- সেভ ----
  var saved = ls.json("uap_app_saved"); if (!Array.isArray(saved)) saved = [];
  var isSaved = function (id) { return saved.some(function (x) { return x.id === id; }); };
  var markSaved = function () {
    $$("[data-save]", feed).forEach(function (b) {
      var on = isSaved(b.closest(".slide").getAttribute("data-id"));
      b.setAttribute("aria-pressed", on ? "true" : "false"); $("span", b).textContent = on ? "সেভড" : "সেভ";
    });
  };
  var savedList = function () {
    var box = $("[data-saved]"); if (!box) return;
    box.textContent = "";
    if (!saved.length) { box.appendChild(el("p", "saved-0", "এখনও কিছু সেভ করেননি। কার্ডের নিচে \"সেভ\" বোতামে ট্যাপ করলে খবরটা এখানে থাকবে।")); return; }
    var ul = el("ul", "saved");
    saved.forEach(function (x) {
      var li = el("li"), a = el("a", "", x.t); a.href = x.u;
      var rm = el("button", "", "×"); rm.type = "button"; rm.setAttribute("aria-label", "সেভ থেকে সরান: " + x.t);
      rm.addEventListener("click", function () { saved = saved.filter(function (y) { return y.id !== x.id; }); ls.put("uap_app_saved", saved); markSaved(); savedList(); });
      li.appendChild(a); li.appendChild(rm); ul.appendChild(li);
    });
    box.appendChild(ul);
  };
  var toggleSave = function (b) {
    var s = b.closest(".slide"), id = s.getAttribute("data-id");
    if (isSaved(id)) { saved = saved.filter(function (x) { return x.id !== id; }); toast("সেভ থেকে সরানো হল"); }
    else {
      var u = b.getAttribute("data-url") || "";
      if (!/^(\.\.\/|\/)[\w\-\/#.]*$/.test(u)) return;
      saved.unshift({ id: id, t: String(b.getAttribute("data-title") || "").slice(0, 160), u: u }); saved = saved.slice(0, 50);
      toast("সেভ হয়েছে। সেটিংসে \"সেভ করা খবর\"-এ পাবেন।");
    }
    ls.put("uap_app_saved", saved); markSaved();
  };

  // ---- শুনুন: ফোনে বাংলা কণ্ঠ থাকলে তবেই বোতাম দেখায় ----
  var synth = W.speechSynthesis, voice = null, speaking = null;
  var stopSpeak = function () {
    if (!speaking) return;
    var b = speaking; speaking = null;
    try { synth.cancel(); } catch (e) {}
    b.classList.remove("playing"); $("span", b).textContent = "শুনুন";
  };
  var findVoice = function () {
    if (!synth || !W.SpeechSynthesisUtterance) return;
    var vs = []; try { vs = synth.getVoices() || []; } catch (e) {}
    var pick = function (re) { for (var i = 0; i < vs.length; i++) if (re.test(vs[i].lang || "")) return vs[i]; return null; };
    voice = pick(/^bn[-_]IN$/i) || pick(/^bn/i);
    $$("[data-listen]", feed).forEach(function (b) { b.hidden = !voice; });
  };
  var speak = function (b) {
    if (speaking === b) return stopSpeak();
    stopSpeak();
    var s = b.closest(".slide"), h = $(".c-h", s), sum = $(".c-sum", s), ben = $(".c-ben span", s);
    var txt = [h && h.textContent, sum && $$("p,li:not([hidden])", sum).map(function (n) { return n.textContent; }).join(" "), ben && "আপনার লাভ: " + ben.textContent].filter(Boolean).join("। ");
    if (!txt || !voice) return;
    var u = new SpeechSynthesisUtterance(txt.slice(0, 900));
    u.voice = voice; u.lang = voice.lang || "bn-IN"; u.rate = 0.95;
    u.onend = u.onerror = function () { if (speaking === b) { speaking = null; b.classList.remove("playing"); $("span", b).textContent = "শুনুন"; } };
    speaking = b; b.classList.add("playing"); $("span", b).textContent = "থামান";
    try { synth.speak(u); } catch (e) { stopSpeak(); }
  };
  if (synth) { findVoice(); try { synth.addEventListener("voiceschanged", findVoice); } catch (e) { synth.onvoiceschanged = findVoice; } addEventListener("pagehide", stopSpeak); }

  // ---- কপি (প্রম্পট) ----
  var copy = function (b) {
    var src = $("[data-copytext]", b.closest(".b-prompt")), txt = src ? src.textContent.trim() : "";
    if (!txt) return;
    var done = function (ok) {
      toast(ok ? "প্রম্পট কপি হয়েছে। এবার আপনার AI অ্যাপে পেস্ট করুন।" : "কপি হল না। লেখাটা চেপে ধরে কপি করুন।");
      if (!ok) return;
      var sp = $("span", b), old = sp.textContent; sp.textContent = "কপি হয়েছে"; b.classList.add("done");
      setTimeout(function () { sp.textContent = old; b.classList.remove("done"); }, 2000);
    };
    var p = U && U.copy ? U.copy(txt) : navigator.clipboard && W.isSecureContext ? navigator.clipboard.writeText(txt) : Promise.reject();
    Promise.resolve(p).then(function () { done(true); }, function () { done(false); });
  };

  // ---- ট্যাপ ----
  feed.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-flip],[data-save],[data-listen],[data-acopy],[data-top]");
    if (!t) return;
    if (t.hasAttribute("data-flip")) flip(t.closest(".slide"));
    else if (t.hasAttribute("data-save")) toggleSave(t);
    else if (t.hasAttribute("data-listen")) speak(t);
    else if (t.hasAttribute("data-acopy")) copy(t);
    else if (t.hasAttribute("data-top")) go(0);
  });

  // ---- দিনের শেষ কার্ড: স্ট্রিক (daily.js-এর uap_qs), ৭ দিনে সার্টিফিকেট ----
  var fillEnd = function () {
    var box = $("[data-streak-box]"); if (!box) return;
    var qs = ls.json("uap_qs"), n = qs && qs.streak > 0 && qs.date >= ist(-2) ? Math.floor(qs.streak) : 0;
    var played = qs && qs.date === ist();
    var t = $("[data-streak-t]", box);
    t.textContent = "";
    if (n) { t.appendChild(el("b", "", bn(n) + " দিনের স্ট্রিক")); t.appendChild(D.createTextNode(n >= 7 ? " · সার্টিফিকেট তৈরি" : played ? " · কাল আবার খেললে বাড়বে" : " · আজকের প্রশ্ন খেললে বাড়বে")); }
    else { t.appendChild(el("b", "", "স্ট্রিক শুরু করুন")); t.appendChild(D.createTextNode(" · টানা ৭ দিন আজকের AI প্রশ্ন খেললে সার্টিফিকেট")); }
    $$(".e-dots li", box).forEach(function (li, i) { li.classList.toggle("on", i < Math.min(n, 7)); });
    var c = $("[data-cert]", box); if (c) c.hidden = n < 7;
  };

  // ---- AI ফ্ল্যাশ: পোস্টের পরে ছোট খবরের কার্ড (না পেলে কিছুই বদলায় না) ----
  var FAPI = B.getAttribute("data-briefs"), tpl = $("#brief-tpl"), endS = $('.slide[data-kind="end"]', feed);
  var INDIA = { available: "ভারতে চালু" }, PRICE = { free: "ফ্রি", paid: "পেইড" };
  var TL = {}; try { TL = JSON.parse(B.getAttribute("data-tl") || "{}") || {}; } catch (e) {}
  var cleanBriefs = function (j) {
    var now = Date.now();
    return (j && Array.isArray(j.briefs) ? j.briefs : []).map(function (b) {
      if (!b || typeof b.title !== "string" || !b.title.trim()) return null;
      var t = Date.parse(b.time); if (isNaN(t) || now - t > 36 * 36e5 || t > now + 6e5) return null;
      var id = String(b.id == null ? "" : b.id).replace(/[^\w-]/g, "").slice(0, 40); if (!id) return null;
      return { id: id, title: b.title.trim().slice(0, 160), body: String(b.body || "").trim().slice(0, 500), type: /^[a-z0-9-]{1,30}$/.test(b.news_type || "") ? b.news_type : "", india: b.india, price: b.price, time: new Date(t).toISOString(), t: t };
    }).filter(Boolean).sort(function (a, b) { return b.t - a.t; }).slice(0, 6);
  };
  var briefCards = function (list) {
    if (!tpl || !tpl.content || !endS || !list.length) return;
    if (slides[cur] && slides[cur].getAttribute("data-kind") === "brief") return;
    var atEnd = slides[cur] === endS;
    $$('.slide[data-kind="brief"]', feed).forEach(function (s) { s.remove(); });
    var site = B.getAttribute("data-site") || "";
    list.forEach(function (b) {
      var s = tpl.content.firstElementChild.cloneNode(true), id = "f-" + b.id;
      s.setAttribute("data-id", id); s.id = "c-" + id;
      var tm = $("time", s); tm.setAttribute("datetime", b.time); tm.textContent = new Intl.DateTimeFormat("bn-IN", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(b.t));
      var chip = $("[data-b-chip]", s); if (TL[b.type]) { chip.textContent = TL[b.type]; chip.className = "tl t-" + b.type; } else chip.remove();
      $("[data-b-h]", s).textContent = b.title; $("[data-b-body]", s).textContent = b.body;
      var bd = $("[data-b-badges]", s);
      [PRICE[b.price], INDIA[b.india]].filter(Boolean).forEach(function (x) { bd.appendChild(el("li", "", x)); });
      if (!bd.children.length) bd.remove();
      var url = site + "/flash/?utm_source=whatsapp&utm_medium=card-share#" + id;
      $("[data-b-wa]", s).href = "https://wa.me/?text=" + encodeURIComponent(b.title + "\n\nপড়ুন: " + url);
      $$("[data-b-full]", s).forEach(function (a) { a.href = a.getAttribute("href") + "#" + id; });
      feed.insertBefore(s, endS);
    });
    collect(); fitAll(); findVoice();
    if (atEnd) { feed.scrollTop = endS.offsetTop; }
  };
  var cached = ls.json("uap_briefs");
  if (cached) briefCards(cleanBriefs(cached));
  if (FAPI && W.fetch) {
    var pullBriefs = function () {
      fetch(FAPI, { headers: { Accept: "application/json" } }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
        var list = cleanBriefs(j);
        if (!list.length) return;
        ls.put("uap_briefs", { updated_at: j.updated_at, briefs: j.briefs.slice(0, 30) });
        briefCards(list);
      }).catch(function () {});
    };
    if (W.requestIdleCallback) requestIdleCallback(pullBriefs, { timeout: 2500 }); else setTimeout(pullBriefs, 1200);
  }

  // ---- ইনস্টল: Android-এ এক ট্যাপ, iPhone-এ Add to Home Screen-এর পথ ----
  var deferred = null, inst = $("#ainst");
  var standalone = (W.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  var ua = navigator.userAgent, ios = /iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios|edgios|opios/i.test(ua);
  var instShown = false;
  var canInstall = function () { return !standalone && (!!deferred || ios); };
  var instButtons = function () {
    var ok = canInstall();
    $$("[data-app-install]").forEach(function (b) { b.hidden = !ok; });
    $$("[data-ios-hint]").forEach(function (n) { n.hidden = !(ok && ios && (n.closest("#ainst") || n.hasAttribute("data-open"))); });
    if (inst) { var g = $("[data-ainst-go]", inst); if (g) g.hidden = ios; }
  };
  var hideInst = function () { if (!inst || inst.hidden) return; inst.classList.remove("open"); setTimeout(function () { inst.hidden = true; }, 240); };
  var showInst = function (force) {
    if (!inst || !canInstall() || coachOn || $(".sheet.open")) return;
    if (!force && (instShown || +(ls.get("uap_inst_x") || 0) > Date.now() - 14 * 864e5)) return;
    instShown = true; instButtons();
    inst.hidden = false; requestAnimationFrame(function () { inst.classList.add("open"); });
  };
  var maybeInstall = function () { if (cur >= 2 && slides[cur] && slides[cur].getAttribute("data-kind") !== "end") showInst(false); };
  var doInstall = function () {
    if (deferred) {
      var d = deferred; deferred = null;
      try { d.prompt(); d.userChoice.then(function () { hideInst(); instButtons(); }, function () {}); } catch (e) {}
    } else if (ios) {
      $$("[data-ios-hint]").forEach(function (n) { n.setAttribute("data-open", ""); });
      instButtons();
      if (!$(".sheet.open")) showInst(true);
    }
  };
  addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; instButtons(); maybeInstall(); });
  addEventListener("appinstalled", function () { deferred = null; standalone = true; hideInst(); instButtons(); toast("অ্যাপ ইনস্টল হয়েছে। হোম স্ক্রিন থেকে এক ট্যাপে খুলুন।"); });
  D.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-app-install],[data-ainst-go],[data-ainst-x]");
    if (!t) return;
    if (t.hasAttribute("data-ainst-x")) { ls.set("uap_inst_x", String(Date.now())); hideInst(); }
    else doInstall();
  });
  instButtons();

  // ---- সেটিংস শিট ----
  var sheet = $("#asheet");
  if (sheet) {
    $$('input[name="fs"]', sheet).forEach(function (r) { r.checked = r.value === fs; r.addEventListener("change", function () { if (r.checked) setFs(r.value); }); });
    sheet.addEventListener("sheetopen", function () { savedList(); hideInst(); instButtons(); });
    // নোটিফিকেশনের শিট খোলার আগে সেটিংস শিট সরে যায় (একটার ওপর আরেকটা না পড়ে)
    $$("[data-push-cta]", sheet).forEach(function (a) { a.addEventListener("click", function () { sheet.classList.remove("open"); sheet.hidden = true; }, true); });
  }

  // ---- প্রথমবারের তিনটে টিপ ----
  var coach = $("#coach"), coachOn = false, step = 0;
  var STEPS = [
    { h: "উপরে টানুন", p: "পরের খবর দেখতে কার্ডটা আঙুল দিয়ে উপরে টানুন। এক স্ক্রিনে একটাই খবর।", t: null },
    { h: "আজই করুন", p: "এই বোতামে ট্যাপ করলে কার্ড উল্টে যাবে। পেছনে থাকে খবরটা কাজে লাগানোর সহজ উপায়।", t: ".ab-go" },
    { h: "শেয়ার", p: "খবরটা কাজের মনে হলে এক ট্যাপে WhatsApp-এ বন্ধু বা পরিবারকে পাঠান।", t: ".ab-wa" },
  ];
  var coachPaint = function () {
    var st = STEPS[step], s = slides[cur] || slides[0], spot = $(".coach-spot", coach), card = $(".coach-card", coach);
    var target = st.t && s ? $(st.t, s) : null, vh = W.innerHeight;
    coach.setAttribute("data-step", String(step));
    $(".coach-n", coach).textContent = "টিপ " + bn(step + 1) + " / " + bn(STEPS.length);
    $("h2", coach).textContent = st.h; $("p:not(.coach-n)", coach).textContent = st.p;
    $$(".coach-dots i", coach).forEach(function (d, i) { d.classList.toggle("on", i === step); });
    $(".coach-next", coach).textContent = step === STEPS.length - 1 ? "শুরু করুন" : "পরের টিপ";
    if (target) {
      var r = target.getBoundingClientRect();
      spot.style.left = r.left - 5 + "px"; spot.style.top = r.top - 5 + "px"; spot.style.width = r.width + 10 + "px"; spot.style.height = r.height + 10 + "px";
      card.style.top = Math.max(16, r.top - card.offsetHeight - 22) + "px";
    } else {
      spot.style.left = "50%"; spot.style.top = "-20px"; spot.style.width = "0px"; spot.style.height = "0px";
      card.style.top = Math.max(16, Math.round(vh * 0.5 - card.offsetHeight / 2)) + "px";
    }
  };
  var coachEnd = function () {
    coachOn = false; ls.set("uap_app_coach", "1");
    coach.classList.remove("open"); setTimeout(function () { coach.hidden = true; }, 260);
    removeEventListener("resize", coachPaint);
    feed.focus({ preventScroll: true });
  };
  var coachStart = function () {
    if (!coach || coachOn || !slides.length || $(".sheet.open")) return;
    coachOn = true; step = 0; coach.hidden = false; coachPaint();
    requestAnimationFrame(function () { coach.classList.add("open"); $(".coach-next", coach).focus(); });
    addEventListener("resize", coachPaint);
  };
  if (coach) {
    $(".coach-next", coach).addEventListener("click", function () { if (step < STEPS.length - 1) { step++; coachPaint(); } else coachEnd(); });
    $(".coach-skip", coach).addEventListener("click", coachEnd);
    coach.addEventListener("keydown", function (e) { if (e.key === "Escape") coachEnd(); });
    if (!ls.get("uap_app_coach")) setTimeout(coachStart, 900);
  }

  // ---- শুরু ----
  collect(); markSaved(); fillEnd();
  var hashS = location.hash.length > 1 ? D.getElementById("c-" + location.hash.slice(1).replace(/[^\w-]/g, "")) : null;
  if (hashS && slides.indexOf(hashS) > 0) feed.scrollTop = hashS.offsetTop;
  if (!io) arrive(0);
  fitAll();
  if (D.fonts && D.fonts.ready) D.fonts.ready.then(fitAll);
  var rt; addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { fitAll(); if (slides[cur]) feed.scrollTop = slides[cur].offsetTop; }, 150); });
  D.addEventListener("visibilitychange", function () { if (D.hidden) stopSpeak(); else fillEnd(); });
  H.classList.add("app-ready");
})();
