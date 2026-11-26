// Unique AI পত্রিকা: অ্যাপ (/app/)। খবর · খুঁজুন · AI-কে বলুন · আজ · আমার।
// site.js (নোটিফিকেশন শিট, service worker) আর daily.js (ডিভাইস আইডি, স্ট্রিক, কপি, লিড ফর্ম)-এর পরে চলে।
// নেট বা API না পেলেও খবর পড়া, সেভ, শেয়ার আর তৈরি প্রশ্ন-উত্তর চলে।
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
  var buzz = function (p) { try { if (!reduced && navigator.vibrate) navigator.vibrate(p || 10); } catch (e) {} };
  var ROOT = B.getAttribute("data-root") || "../";
  var standalone = (W.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;

  // ---- টোস্ট ----
  var toastEl = $("#atoast"), toastT;
  var toast = function (msg) {
    if (!toastEl) return;
    toastEl.textContent = msg; toastEl.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 2600);
  };

  // ---- লেখার মাপ ----
  var fs = ls.get("uap_app_fs"); if (!/^[sml]$/.test(fs || "")) fs = "m";
  H.setAttribute("data-fs", fs);
  $$('input[name="fs"]').forEach(function (r) {
    r.checked = r.value === fs;
    r.addEventListener("change", function () { if (!r.checked) return; fs = r.value; H.setAttribute("data-fs", fs); ls.set("uap_app_fs", fs); fitAll(); buzz(); });
  });

  // ---- ফুটারের খাঁজ: আসল চওড়া মেপে বাঁকটা ঠিক মাঝখানে ----
  var edge = $("[data-edge]");
  var shapeDock = function () {
    if (!edge) return;
    var w = Math.round(edge.getBoundingClientRect().width) || 390, c = w / 2;
    var d = "M0 14Q0 2 12 2H" + (c - 44) + "A44 44 0 0 0 " + (c + 44) + " 2H" + (w - 12) + "Q" + w + " 2 " + w + " 14";
    edge.setAttribute("viewBox", "0 0 " + w + " 50");
    $$("path", edge).forEach(function (p) { p.setAttribute("d", d); });
  };

  // ---- সারাংশ: কার্ডে যতটা ধরে ততটাই ----
  var fit = function (s) {
    var sum = $(".c-sum", s); if (!sum) return;
    s.classList.remove("tight0", "tight1", "tight2");
    if (!sum.clientHeight && !s.offsetParent) return;
    var p = $("p", sum), lis = $$("li", sum);
    lis.forEach(function (li) { li.hidden = false; });
    if (p) { p.classList.remove("cl"); p.style.webkitLineClamp = ""; }
    var lh = p ? parseFloat(getComputedStyle(p).lineHeight) || 28 : 28;
    // ছোট স্ক্রিনে আগে "আপনার লাভ", তারপর প্রশ্নের কার্ড সরে খবরকে অন্তত দু'লাইন জায়গা দেয়
    if (sum.clientHeight < lh * 3.2) s.classList.add("tight0");
    if (sum.clientHeight < lh * 2.2) s.classList.add("tight2");
    if (sum.clientHeight < lh * 2.2) s.classList.add("tight1");
    for (var i = lis.length - 1; i >= 0 && sum.scrollHeight > sum.clientHeight + 1; i--) lis[i].hidden = true;
    if (p && sum.scrollHeight > sum.clientHeight + 1) {
      p.classList.add("cl"); p.style.webkitLineClamp = String(Math.max(1, Math.floor(sum.clientHeight / lh)));
    }
  };
  var fitAll = function () { $$(".slide", feed).forEach(fit); };

  // ---- পড়ার অবস্থা ----
  var slides = [], cur = 0;
  var read = ls.json("uap_app_read") || {};
  Object.keys(read).forEach(function (k) { if (!(read[k] >= ist(-30))) delete read[k]; });
  var news = function () { return slides.filter(function (s) { return s.getAttribute("data-kind") !== "end"; }); };
  var paint = function () {
    var n = news(), total = n.length;
    n.forEach(function (s, i) { var pos = $("[data-pos]", s); if (pos) pos.textContent = bn(i + 1) + " / " + bn(total); });
    var unread = n.filter(function (s) { return !read[s.getAttribute("data-id")]; }).length;
    var th = $("[data-today-sub]");
    if (th) th.textContent = unread ? bn(total) + "টা খবরের " + bn(total - unread) + "টা পড়া হয়েছে" : "আজকের " + bn(total) + "টা খবরই পড়া শেষ";
    var th2 = $("[data-today-h]"); if (th2) th2.textContent = unread ? "আজকের পত্রিকা" : "আজকের খবর শেষ";
  };
  var readT;
  var arrive = function (i) {
    if (i === cur && slides[i] && slides[i].classList.contains("on")) return;
    var prev = slides[cur]; if (prev && prev !== slides[i]) prev.classList.remove("on");
    cur = i; var s = slides[i]; if (!s) return;
    s.classList.add("on"); stopSpeak();
    clearTimeout(readT);
    var id = s.getAttribute("data-id");
    if (s.getAttribute("data-kind") === "end") ls.set("uap_app_end", ist());
    else if (id && !read[id]) readT = setTimeout(function () { read[id] = ist(); ls.put("uap_app_read", read); paint(); meStats(); }, 1500);
    [1, 2].forEach(function (d) { var im = slides[i + d] && $(".cd-pic img", slides[i + d]); if (im && im.loading === "lazy") im.loading = "eager"; });
    chipsFor(s);
    if (i > 0) hideSwipeHint();
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

  // ---- ট্যাব ----
  var view = "feed";
  var showView = function (v, push) {
    if (!D.getElementById("v-" + v)) v = "feed";
    if (v === view) { if (v === "feed") go(cur); return; }
    $$(".view").forEach(function (x) { var on = x.getAttribute("data-view") === v; x.hidden = !on; x.classList.toggle("on", on); if (on && !reduced) { x.classList.remove("enter"); void x.offsetWidth; x.classList.add("enter"); } });
    $$(".tab[data-tab]").forEach(function (t) { var on = t.getAttribute("data-tab") === v; t.classList.toggle("on", on); if (on) t.setAttribute("aria-current", "page"); else t.removeAttribute("aria-current"); });
    view = v; stopSpeak(); buzz(8);
    if (v === "find") findRender();
    if (v === "today") fillToday();
    if (v === "me") meStats();
    if (push !== false) { try {
      if (v === "feed") { if (history.state && history.state.tab) history.back(); else history.replaceState(null, "", location.pathname + location.search); }
      else if (history.state && history.state.tab) history.replaceState({ tab: v }, "", "#" + v);
      else history.pushState({ tab: v }, "", "#" + v);
    } catch (e) {} }
  };
  D.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-tab]");
    if (t) { e.preventDefault(); showView(t.getAttribute("data-tab")); }
  });

  // ---- কিবোর্ড আর মাউসের চাকা ----
  D.addEventListener("keydown", function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey || openBs || $(".sheet.open") || view !== "feed") return;
    var t = e.target, tag = t && t.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    var k = e.key;
    if (k === "ArrowDown" || k === "PageDown" || k === "j") { e.preventDefault(); go(cur + 1); }
    else if (k === "ArrowUp" || k === "PageUp" || k === "k") { e.preventDefault(); go(cur - 1); }
    else if (k === "Home") { e.preventDefault(); go(0); }
    else if (k === "End") { e.preventDefault(); go(slides.length - 1); }
  });
  var wheelLock = 0;
  feed.addEventListener("wheel", function (e) {
    if (e.ctrlKey) return;
    var sc = e.target.closest && e.target.closest(".chips");
    if (sc && Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    var now = Date.now();
    if (Math.abs(e.deltaY) < 12 || now < wheelLock) return;
    wheelLock = now + 520; go(cur + (e.deltaY > 0 ? 1 : -1));
  }, { passive: false });

  // ---- নিচ থেকে ওঠা শিট ----
  var openBs = null, bsFocus = null;
  var openSheetEl = function (id, opener) {
    var s = D.getElementById(id); if (!s) return;
    if (openBs) closeBs(true);
    bsFocus = opener || D.activeElement; openBs = s;
    s.hidden = false; requestAnimationFrame(function () { requestAnimationFrame(function () { s.classList.add("open"); }); });
    try { history.pushState({ bs: id }, ""); } catch (e) {}
  };
  var closeBs = function (silent) {
    var s = openBs; if (!s) return; openBs = null;
    s.classList.remove("open"); stopListen();
    setTimeout(function () { if (!s.classList.contains("open")) s.hidden = true; }, reduced ? 0 : 320);
    if (!silent && history.state && history.state.bs) { try { history.back(); } catch (e) {} }
    if (bsFocus && bsFocus.focus) try { bsFocus.focus({ preventScroll: true }); } catch (e) {}
  };
  addEventListener("popstate", function () {
    if (openBs) { closeBs(true); return; }
    var h = location.hash.slice(1); showView(/^(find|today|me)$/.test(h) ? h : "feed", false);
  });
  D.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("[data-bs-close]")) closeBs(); });
  D.addEventListener("keydown", function (e) { if (e.key === "Escape" && openBs) closeBs(); });
  // নিচে টেনে শিট বন্ধ
  $$(".bs-p").forEach(function (p) {
    var y0 = null, dy = 0;
    p.addEventListener("touchstart", function (e) { var t = e.target; if (t.closest(".ask-log,.bs-c,.chips,input,button,a") && !t.closest(".ask-h,.bs-grab")) { y0 = null; return; } y0 = e.touches[0].clientY; dy = 0; p.style.transition = "none"; }, { passive: true });
    p.addEventListener("touchmove", function (e) { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); p.style.transform = "translateY(" + dy + "px)"; }, { passive: true });
    p.addEventListener("touchend", function () { if (y0 == null) return; p.style.transition = ""; p.style.transform = ""; if (dy > 90) closeBs(); y0 = null; });
  });

  // ---- আজই করুন ----
  var actC = $("[data-act-c]");
  var openAct = function (s, opener) {
    var tpl = s && $("template[data-acttpl]", s); if (!tpl || !actC) return;
    actC.textContent = ""; actC.appendChild(tpl.content.cloneNode(true)); actC.scrollTop = 0;
    var hd = $(".as-head b", actC); $("#act-h").textContent = hd ? hd.textContent : "আজই করুন";
    openSheetEl("act", opener); buzz(10);
    if (s.getAttribute("data-kind") === "post") ls.set("uap_app_acted", "1");
  };
  var copy = function (b) {
    var src = $("[data-copytext]", b.closest("[data-copyroot]")), txt = src ? src.textContent.trim() : "";
    if (!txt) return;
    var done = function (ok) {
      toast(ok ? "প্রম্পট কপি হয়েছে। এবার আপনার AI অ্যাপে পেস্ট করুন।" : "কপি হল না। লেখাটা চেপে ধরে কপি করুন।");
      if (!ok) return;
      buzz([8, 40, 8]);
      var sp = $("span", b), old = sp.textContent; sp.textContent = "কপি হয়েছে ✓"; b.classList.add("done");
      setTimeout(function () { sp.textContent = old; b.classList.remove("done"); }, 1800);
    };
    var p = U && U.copy ? U.copy(txt) : navigator.clipboard && W.isSecureContext ? navigator.clipboard.writeText(txt) : Promise.reject();
    Promise.resolve(p).then(function () { done(true); }, function () { done(false); });
  };
  if (actC) actC.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-acopy]"); if (b) copy(b); });

  // ---- সেভ ----
  var saved = ls.json("uap_app_saved"); if (!Array.isArray(saved)) saved = [];
  var isSaved = function (id) { return saved.some(function (x) { return x.id === id; }); };
  var markSaved = function () {
    $$("[data-save]", feed).forEach(function (b) {
      var on = isSaved(b.closest(".slide").getAttribute("data-id"));
      b.setAttribute("aria-pressed", on ? "true" : "false"); b.setAttribute("aria-label", on ? "সেভ করা আছে, সরাতে ট্যাপ করুন" : "সেভ করুন");
    });
    var n = $("[data-saved-n]"); if (n) n.textContent = saved.length ? bn(saved.length) + "টা" : "";
  };
  var savedList = function () {
    var box = $("[data-saved]"); if (!box) return;
    box.textContent = "";
    if (!saved.length) { box.appendChild(el("p", "saved-0", "এখনও কিছু সেভ করেননি। খবরের নিচে বুকমার্ক বোতামে ট্যাপ করলে খবরটা এখানে থাকবে।")); return; }
    var ul = el("ul", "saved");
    saved.forEach(function (x) {
      var li = el("li"), a = el("a", "", x.t); a.href = x.u;
      var rm = el("button", "", "×"); rm.type = "button"; rm.setAttribute("aria-label", "সেভ থেকে সরান: " + x.t);
      rm.addEventListener("click", function () { saved = saved.filter(function (y) { return y.id !== x.id; }); ls.put("uap_app_saved", saved); markSaved(); savedList(); meStats(); });
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
      toast("সেভ হয়েছে। \"আমার\" পাতায় পাবেন।"); buzz(12);
    }
    ls.put("uap_app_saved", saved); markSaved(); savedList(); meStats();
  };

  // ---- শুনুন: ফোনের বাংলা কণ্ঠ (ফ্রি) ----
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
    var s = b.closest(".slide"), h = $(".c-h", s), sum = $(".c-sum", s), ben = $(".cd-ben span", s);
    var txt = [h && h.textContent, sum && $$("p,li:not([hidden])", sum).map(function (n) { return n.textContent; }).join(" "), ben && "আপনার লাভ: " + ben.textContent].filter(Boolean).join("। ");
    if (!txt || !voice) return;
    var u = new SpeechSynthesisUtterance(txt.slice(0, 900));
    u.voice = voice; u.lang = voice.lang || "bn-IN"; u.rate = 0.95;
    u.onend = u.onerror = function () { if (speaking === b) { speaking = null; b.classList.remove("playing"); $("span", b).textContent = "শুনুন"; } };
    speaking = b; b.classList.add("playing"); $("span", b).textContent = "থামান";
    try { synth.speak(u); } catch (e) { stopSpeak(); }
  };
  if (synth) { findVoice(); try { synth.addEventListener("voiceschanged", findVoice); } catch (e) { synth.onvoiceschanged = findVoice; } addEventListener("pagehide", stopSpeak); }

  // ---- AI-কে বলুন ----
  var ASK = B.getAttribute("data-ask") || "";
  var askEl = $("#ask"), logEl = $("[data-ask-log]"), askChips = $("[data-ask-chips]"), askForm = $("[data-ask-form]");
  var askInput = askForm ? askForm.elements.q : null, askSend = askForm ? $(".ask-send", askForm) : null;
  var did = function () { return (U && U.did) || ls.get("uap_did") || ""; };
  var QA = {}, qaLoading = {};
  try { var qac = ls.json("uap_qa_cache"); if (qac && qac.d >= ist(-3)) QA = qac.m || {}; } catch (e) {}
  var saveQa = function () { var keys = Object.keys(QA).slice(-40), m = {}; keys.forEach(function (k) { m[k] = QA[k]; }); ls.put("uap_qa_cache", { d: ist(), m: m }); };
  // নেট ছাড়াই তৈরি উত্তর: খবরের নিজের তথ্য থেকে
  var localQa = function (s) {
    var out = [], ben = s.getAttribute("data-ben"), india = s.getAttribute("data-india"), price = s.getAttribute("data-price");
    var sum = $(".c-sum p", s), h = $(".c-h", s);
    if (ben) out.push({ q: "এতে আমার কী লাভ?", a: ben });
    if (india) out.push({ q: "ভারতে পাওয়া যাবে?", a: india });
    if (price) out.push({ q: "টাকা লাগবে?", a: price === "ফ্রি" ? "না, এটা ফ্রিতে ব্যবহার করা যায়।" : price === "পেইড" ? "হ্যাঁ, এটা টাকা দিয়ে ব্যবহার করতে হয়।" : "কিছু অংশ ফ্রি, বাকিটার জন্য টাকা লাগে।" });
    if (out.length < 3 && sum) out.push({ q: "সংক্ষেপে খবরটা কী?", a: sum.textContent });
    if (out.length < 2 && h) out.push({ q: "এটা নিয়ে আর কী জানা দরকার?", a: "নিচের \"আজই করুন\" বোতামে এই খবর কাজে লাগানোর উপায় আছে। নিজের প্রশ্নও লিখে পাঠাতে পারেন।" });
    return out.slice(0, 3);
  };
  var qaFor = function (s) { var id = s.getAttribute("data-id"); return QA[id] || localQa(s); };
  var loadQa = function (s) {
    var id = s && s.getAttribute("data-id");
    if (!ASK || !W.fetch || !id || s.getAttribute("data-kind") !== "post" || QA[id] || qaLoading[id] || !navigator.onLine) return Promise.resolve(null);
    qaLoading[id] = 1;
    var getQa = function (n) { return fetch(ASK + "?action=qa&slug=" + encodeURIComponent(id), { headers: { Accept: "application/json" } }).then(function (r) { if (r.ok) return r.json(); if (n && r.status >= 500) return new Promise(function (ok) { setTimeout(ok, 3500); }).then(function () { return getQa(0); }); return null; }); };
    return getQa(1).then(function (j) {
      var qa = j && Array.isArray(j.qa) ? j.qa.filter(function (x) { return x && typeof x.q === "string" && typeof x.a === "string"; }).slice(0, 3).map(function (x) { return { q: x.q.slice(0, 70), a: x.a.slice(0, 600) }; }) : null;
      if (qa && qa.length) { QA[id] = qa; saveQa(); if (slides[cur] === s) chipsFor(s); if (askSlide === s && openBs === askEl) askChipsRender(); }
      return qa;
    }).catch(function () { return null; }).then(function (x) { delete qaLoading[id]; return x; });
  };
  var chipsFor = function (s, local) {
    var box = s && $("[data-chips]", s); if (!box) return;
    box.textContent = "";
    qaFor(s).slice(0, 2).forEach(function (x) { var c = el("button", "qchip", x.q); c.type = "button"; c.setAttribute("data-q", x.q); box.appendChild(c); });
    fit(s);
    if (!local && s.getAttribute("data-kind") === "post") { if (W.requestIdleCallback) requestIdleCallback(function () { loadQa(s); }, { timeout: 2000 }); else setTimeout(function () { loadQa(s); }, 800); }
  };
  var askSlide = null, asked = {}, left = null, perDay = 3;
  var quotaPaint = function () {
    var q = $("[data-quota]"); if (!q) return;
    var n = left == null ? perDay : left;
    $("[data-quota-n]", q).textContent = bn(n) + "টা বাকি";
    $$("i", q).forEach(function (d, i) { d.classList.toggle("off", i >= n); });
    q.setAttribute("aria-label", "আজ আরও " + bn(n) + "টা নিজের প্রশ্ন বাকি");
  };
  var scrollLog = function () { if (logEl) logEl.scrollTop = logEl.scrollHeight; };
  var aiMsg = function (text) {
    var w = el("div", "msg msg-ai"), o = el("i", "mini-orb"); o.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z"/></svg>';
    var b = el("div"); if (text == null) { var t = el("span", "typing"); t.setAttribute("aria-label", "উত্তর লেখা হচ্ছে"); t.appendChild(el("i")); t.appendChild(el("i")); t.appendChild(el("i")); b.appendChild(t); } else b.textContent = text;
    w.appendChild(o); w.appendChild(b); logEl.appendChild(w); scrollLog(); return b;
  };
  var meMsg = function (text) { logEl.appendChild(el("div", "msg msg-me", text)); scrollLog(); };
  var sysMsg = function (text) { logEl.appendChild(el("div", "msg msg-sys", text)); scrollLog(); };
  var leadNudge = function () {
    if (ls.json("uap_lead")) return;
    var w = el("div", "msg ask-lead"); w.appendChild(el("span", "", "রোজ এমন কাজের প্রম্পট আর ফ্রি ক্লাসের খবর পেতে চান?"));
    var a = el("a", "", "৫০টা কাজের প্রম্পট ফ্রিতে খুলুন →"); a.href = ROOT + "prompts-50/"; w.appendChild(a); logEl.appendChild(w); scrollLog();
  };
  var askChipsRender = function () {
    if (!askChips || !askSlide) return;
    askChips.textContent = "";
    qaFor(askSlide).forEach(function (x) { if (asked[x.q]) return; var c = el("button", "qchip", x.q); c.type = "button"; c.setAttribute("data-q", x.q); askChips.appendChild(c); });
  };
  var answerChip = function (q) {
    var x = qaFor(askSlide).filter(function (y) { return y.q === q; })[0]; if (!x) return;
    asked[q] = 1; meMsg(x.q);
    var b = aiMsg(null);
    setTimeout(function () { b.textContent = x.a; scrollLog(); }, reduced ? 0 : 420);
    askChipsRender(); buzz(8);
  };
  var dockEl = $(".dock");
  var sendAsk = function (q) {
    q = String(q || "").replace(/\s+/g, " ").trim();
    if (q.length < 3) { toast("প্রশ্নটা একটু বড় করে লিখুন।"); return; }
    if (/(?:\+?91[\s-]?)?[6-9]\d{9}\b|[\w.+-]+@[\w-]+\.[\w.]+|otp|password|পাসওয়ার্ড|আধার|aadhaar|cvv/i.test(q)) { sysMsg("ব্যক্তিগত তথ্য (ফোন নম্বর, ইমেল, OTP, আধার) প্রশ্নে লিখবেন না। ওটা বাদ দিয়ে আবার লিখুন।"); return; }
    if (left === 0) { sysMsg("আজকের ৩টা নিজের প্রশ্ন শেষ। কাল সকালে আবার করতে পারবেন। তৈরি প্রশ্নগুলোর উত্তর এখনও দেখা যাবে।"); leadNudge(); return; }
    if (!navigator.onLine) { sysMsg("নেট নেই। নেট চালু করে আবার পাঠান। তৈরি প্রশ্নগুলোর উত্তর নেট ছাড়াও দেখা যাবে।"); return; }
    var id = askSlide && askSlide.getAttribute("data-id");
    if (!ASK || !id || askSlide.getAttribute("data-kind") !== "post") { sysMsg("এই কার্ডে নিজের প্রশ্ন করা যায় না। কোনো বড় খবরের কার্ডে গিয়ে AI-কে জিজ্ঞেস করুন।"); return; }
    meMsg(q); askInput.value = ""; askSend.disabled = true;
    var b = aiMsg(null); if (dockEl) dockEl.classList.add("busy");
    fetch(ASK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "ask", slug: id, q: q, device_id: did() }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (r) {
        var j = r.j || {};
        if (r.s === 200 && typeof j.answer === "string") {
          b.textContent = j.answer; if (typeof j.left === "number") { left = j.left; quotaPaint(); }
          buzz(10); if (left === 0) leadNudge();
        } else if (j.error === "daily_limit") { left = 0; quotaPaint(); b.textContent = "আজকের ৩টা নিজের প্রশ্ন শেষ। কাল সকালে আবার করতে পারবেন।"; leadNudge(); }
        else if (j.error === "personal_info") b.textContent = "প্রশ্নে ব্যক্তিগত তথ্য আছে মনে হচ্ছে। ওটা বাদ দিয়ে আবার লিখুন।";
        else if (j.error === "busy") b.textContent = "এখন খুব ভিড়, একটু পরে আবার চেষ্টা করুন। আপনার প্রশ্ন গোনা হয়নি।";
        else b.textContent = "উত্তর আনা গেল না। একটু পরে আবার চেষ্টা করুন।";
        scrollLog();
      })
      .catch(function () { b.textContent = "নেটের সমস্যায় উত্তর আনা গেল না। আবার চেষ্টা করুন।"; })
      .then(function () { askSend.disabled = false; if (dockEl) dockEl.classList.remove("busy"); });
  };
  var openAsk = function (s, opener, firstQ) {
    if (!askEl || !logEl) return;
    if (!s || !s.classList.contains("slide") || s.getAttribute("data-kind") === "end") s = slides[Math.max(0, Math.min(cur, news().length - 1))] || slides[0];
    if (askSlide !== s) {
      askSlide = s; asked = {}; logEl.textContent = "";
      var h = $(".c-h", s); $("[data-ask-of]").textContent = h ? h.textContent : "";
      aiMsg("নমস্কার! এই খবর নিয়ে যা জানতে চান জিজ্ঞেস করুন। নিচের প্রশ্নে ট্যাপ করলেই উত্তর পাবেন, নিজের প্রশ্নও লিখতে পারেন।");
    }
    askChipsRender(); loadQa(s); quotaPaint();
    openSheetEl("ask", opener);
    ls.set("uap_orb_used", "1"); hideOrbTip();
    if (firstQ) setTimeout(function () { answerChip(firstQ); }, reduced ? 0 : 300);
    if (ASK && W.fetch && navigator.onLine && did()) fetch(ASK + "?action=quota&device_id=" + encodeURIComponent(did())).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && typeof j.left === "number") { left = j.left; perDay = j.per_day || 3; quotaPaint(); } }).catch(function () {});
  };
  if (askChips) askChips.addEventListener("click", function (e) { var c = e.target.closest && e.target.closest("[data-q]"); if (c) answerChip(c.getAttribute("data-q")); });
  if (askForm) askForm.addEventListener("submit", function (e) { e.preventDefault(); sendAsk(askInput.value); });
  // বলে প্রশ্ন (Android Chrome-এ বাংলা স্বীকৃতি; না থাকলে বোতামই দেখায় না)
  var SR = W.SpeechRecognition || W.webkitSpeechRecognition, rec = null, mic = $("[data-ask-mic]");
  var stopListen = function () { if (rec) { try { rec.stop(); } catch (e) {} } };
  if (SR && mic) {
    mic.hidden = false;
    mic.addEventListener("click", function () {
      if (rec) { stopListen(); return; }
      try {
        rec = new SR(); rec.lang = "bn-IN"; rec.interimResults = true; rec.maxAlternatives = 1;
        rec.onresult = function (ev) { var t = ""; for (var i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript; askInput.value = t; };
        rec.onend = rec.onerror = function () { mic.classList.remove("on"); rec = null; };
        mic.classList.add("on"); buzz(10); rec.start();
      } catch (e) { mic.classList.remove("on"); rec = null; }
    });
  }

  // ---- অর্ব ----
  var orb = $("[data-orb]");
  var hideOrbTip = function () { if (orb) orb.classList.remove("hint"); };
  if (orb) orb.addEventListener("click", function () {
    buzz(12); if (!reduced) { orb.classList.remove("ping"); void orb.offsetWidth; orb.classList.add("ping"); }
    if (view !== "feed") showView("feed");
    openAsk(slides[cur], orb);
  });
  // প্রথম ক'বার: অর্বের চারপাশে তিনবার আলোর ঢেউ, যাতে চোখ পড়ে
  var maybeOrbTip = function () {
    if (!orb || reduced || ls.get("uap_orb_used")) return;
    var n = +(ls.get("uap_orb_tip") || 0); if (n >= 3) return;
    ls.set("uap_orb_tip", String(n + 1));
    setTimeout(function () { orb.classList.add("hint"); setTimeout(hideOrbTip, 4000); }, 1600);
  };

  // ---- ফিডের ট্যাপ ----
  feed.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-save],[data-listen],[data-act],[data-top],[data-q],[data-askcard]");
    if (!t) return;
    var s = t.closest(".slide");
    if (t.hasAttribute("data-save")) toggleSave(t);
    else if (t.hasAttribute("data-listen")) speak(t);
    else if (t.hasAttribute("data-act")) openAct(s, t);
    else if (t.hasAttribute("data-top")) go(0);
    else if (t.hasAttribute("data-q")) openAsk(s, t, t.getAttribute("data-q"));
    else openAsk(s, t);
  });

  // ---- খুঁজুন ----
  var FD = []; try { FD = JSON.parse(($("#find-data") || {}).textContent || "[]"); } catch (e) {}
  var TL = {}; try { TL = JSON.parse(B.getAttribute("data-tl") || "{}") || {}; } catch (e) {}
  var fq = $("[data-find-q]"), fx = $("[data-find-x]"), flist = $("[data-find-list]"), fempty = $("[data-find-empty]"), fh = $("[data-find-h]"), fall = $("[data-find-all]"), fk = "";
  var norm = function (s) { return String(s || "").toLowerCase().normalize("NFC"); };
  var findRender = function () {
    if (!flist) return;
    var q = norm(fq && fq.value).trim(), out = FD;
    if (fk) out = out.filter(function (x) { return x.k === fk; });
    if (q) { var ws = q.split(/\s+/).filter(Boolean); out = out.filter(function (x) { var t = norm(x.t + " " + x.x); return ws.every(function (w) { return t.indexOf(w) >= 0; }); }); }
    var limit = q || fk ? 40 : 12;
    flist.textContent = "";
    out.slice(0, limit).forEach(function (x) {
      var li = el("li"), a = el("a"); a.href = ROOT + "posts/" + x.s + "/"; a.setAttribute("data-slug", x.s);
      if (x.i) { var im = el("img"); im.src = x.i; im.alt = ""; im.loading = "lazy"; im.decoding = "async"; im.width = 76; im.height = 76; a.appendChild(im); }
      else { var f = el("span", "fi-f"); f.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z"/></svg>'; a.appendChild(f); }
      var t = el("span", "fi-t"), k = el("span", "fi-k" + (x.k === "scam-alert" ? " warn" : ""), (TL[x.k] || "খবর")); t.appendChild(k); t.appendChild(el("span", "fi-h", x.t)); a.appendChild(t);
      li.appendChild(a); flist.appendChild(li);
    });
    if (fempty) fempty.hidden = !!out.length;
    if (fh) fh.textContent = q ? "খোঁজের ফল" : fk ? (TL[fk] || "খবর") : "নতুন খবর";
    if (fall) fall.hidden = !(q || fk);
    if (fx) fx.hidden = !(fq && fq.value);
  };
  if (fq) { var ft; fq.addEventListener("input", function () { clearTimeout(ft); ft = setTimeout(findRender, 120); }); fq.addEventListener("keydown", function (e) { if (e.key === "Enter") fq.blur(); }); }
  if (fx) fx.addEventListener("click", function () { fq.value = ""; findRender(); fq.focus(); });
  if (fall) fall.addEventListener("click", function () { fk = ""; if (fq) fq.value = ""; $$("[data-find-k]").forEach(function (b) { b.setAttribute("aria-pressed", "false"); }); findRender(); });
  $$("[data-find-k]").forEach(function (b) {
    b.addEventListener("click", function () {
      var k = b.getAttribute("data-find-k"); fk = fk === k ? "" : k; buzz(8);
      $$("[data-find-k]").forEach(function (x) { x.setAttribute("aria-pressed", x.getAttribute("data-find-k") === fk ? "true" : "false"); });
      findRender();
    });
  });
  // আজকের ফিডে থাকা খবর হলে কার্ডেই নিয়ে যাওয়া
  if (flist) flist.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[data-slug]"); if (!a) return;
    var s = D.getElementById("c-" + a.getAttribute("data-slug")); if (!s || slides.indexOf(s) < 0) return;
    e.preventDefault(); showView("feed"); var i = slides.indexOf(s); feed.scrollTop = s.offsetTop; arrive(i);
  });

  // ---- আজ: স্ট্রিক (daily.js-এর uap_qs) ----
  var fillToday = function () {
    var box = $("[data-streak-box]"); if (!box) return;
    var qs = ls.json("uap_qs"), n = qs && qs.streak > 0 && qs.date >= ist(-2) ? Math.floor(qs.streak) : 0;
    var played = qs && qs.date === ist();
    $("[data-streak-t]", box).textContent = n ? "টানা " + bn(n) + " দিন খেলছেন" : "আজ থেকেই শুরু করুন";
    $("[data-streak-s]", box).textContent = n >= 7 ? "সার্টিফিকেট তৈরি" : n ? "আর " + bn(7 - n) + " দিনে সার্টিফিকেট" : played ? "কাল আবার খেললে বাড়বে" : "টানা ৭ দিন কুইজে সার্টিফিকেট";
    $$(".st-dots li", box).forEach(function (li, i) { li.classList.toggle("on", i < Math.min(n, 7)); });
    var c = $("[data-cert]", box); if (c) c.hidden = n < 7;
    paint();
  };

  // ---- আমার ----
  var meStats = function () {
    var qs = ls.json("uap_qs"), n = qs && qs.streak > 0 && qs.date >= ist(-2) ? Math.floor(qs.streak) : 0;
    var set = function (sel, v) { var x = $(sel); if (x) x.textContent = bn(v); };
    set("[data-st-streak]", n); set("[data-st-read]", Object.keys(read).length); set("[data-st-saved]", saved.length);
    var lead = ls.json("uap_lead"), nm = $("[data-me-name]"), av = $("[data-me-av]"), tag = $("[data-me-tag]"), lf = $("[data-me-lead]");
    if (lead && lead.name) {
      if (nm) nm.textContent = "নমস্কার, " + String(lead.name).split(" ")[0];
      if (av) av.textContent = Array.from(String(lead.name).trim())[0] || "";
      if (tag) tag.textContent = n >= 7 ? "AI শিক্ষার্থী · সার্টিফিকেট তৈরি" : "AI শিক্ষার্থী";
      if (lf) lf.hidden = true;
    }
  };
  D.addEventListener("uap:lead", function (e) { if (e.detail && e.detail.ok) { toast("ধন্যবাদ! আপনার নাম জমা হয়েছে।"); meStats(); } }, true);

  // ---- AI ফ্ল্যাশ: পোস্টের পরে ছোট খবরের কার্ড ----
  var FAPI = B.getAttribute("data-briefs"), tpl = $("#brief-tpl"), endS = $('.slide[data-kind="end"]', feed);
  var INDIA = { available: "ভারতে চালু" }, PRICE = { free: "ফ্রি", paid: "পেইড" };
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
      if (INDIA[b.india]) s.setAttribute("data-india", "হ্যাঁ, ভারতে এখন চালু আছে।");
      if (PRICE[b.price]) s.setAttribute("data-price", PRICE[b.price]);
      var tm = $("time", s), ago = (Date.now() - b.t) / 6e4; tm.setAttribute("datetime", b.time);
      tm.textContent = ago < 2 ? "এইমাত্র" : ago < 60 ? bn(Math.floor(ago)) + " মিনিট আগে" : ago < 1440 ? bn(Math.floor(ago / 60)) + " ঘণ্টা আগে" : "গতকাল";
      var chip = $("[data-b-chip]", s); if (TL[b.type]) { chip.textContent = TL[b.type]; chip.className = "tl t-" + b.type; } else chip.remove();
      $("[data-b-h]", s).textContent = b.title; $("[data-b-body]", s).textContent = b.body;
      var url = site + "/flash/?utm_source=whatsapp&utm_medium=card-share#" + id;
      $("[data-b-wa]", s).href = "https://wa.me/?text=" + encodeURIComponent(b.title + "\n\nপড়ুন Unique AI পত্রিকায়: " + url);
      $$("[data-b-full]", s).forEach(function (a) { a.href = a.getAttribute("href") + "#" + id; });
      feed.insertBefore(s, endS);
    });
    collect(); $$('.slide[data-kind="brief"]', feed).forEach(function (s) { chipsFor(s, true); }); fitAll(); findVoice();
    if (atEnd) feed.scrollTop = endS.offsetTop;
  };
  var cached = ls.json("uap_briefs");
  if (cached) briefCards(cleanBriefs(cached));
  if (FAPI && W.fetch) {
    var pullBriefs = function () {
      fetch(FAPI, { headers: { Accept: "application/json" } }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
        var list = cleanBriefs(j); if (!list.length) return;
        ls.put("uap_briefs", { updated_at: j.updated_at, briefs: j.briefs.slice(0, 30) });
        briefCards(list);
      }).catch(function () {});
    };
    if (W.requestIdleCallback) requestIdleCallback(pullBriefs, { timeout: 2500 }); else setTimeout(pullBriefs, 1200);
  }

  // ---- শেয়ার: ফোনে থাকলে নিজের শেয়ার শিট, নইলে WhatsApp লিংক ----
  D.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[data-share]"); if (!a || !navigator.share || !standalone) return;
    var m = /[?&]text=([^&]*)/.exec(a.getAttribute("href") || ""); if (!m) return;
    e.preventDefault(); buzz(8);
    var txt = decodeURIComponent(m[1]);
    navigator.share({ text: txt }).catch(function (err) { if (err && err.name !== "AbortError") location.href = a.href; });
  });

  // ---- ইনস্টল (ব্রাউজারে খুললে; অ্যাপে থাকলে কিছুই দেখায় না) ----
  var deferred = null, inst = $("#ainst");
  var ua = navigator.userAgent, ios = /iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios|edgios|opios/i.test(ua);
  var instShown = false;
  var canInstall = function () { return !standalone && (!!deferred || ios); };
  var instButtons = function () {
    var ok = canInstall();
    $$("[data-app-install]").forEach(function (b) { b.hidden = !ok; });
    $$("[data-ios-hint]").forEach(function (n) { n.hidden = !(ok && ios); });
    if (inst) { var g = $("[data-ainst-go]", inst); if (g) g.hidden = ios; }
  };
  var hideInst = function () { if (!inst || inst.hidden) return; inst.classList.remove("open"); setTimeout(function () { inst.hidden = true; }, 240); };
  var showInst = function () {
    if (!inst || !canInstall() || openBs || $(".sheet.open")) return;
    if (instShown || +(ls.get("uap_inst_x") || 0) > Date.now() - 14 * 864e5) return;
    instShown = true; instButtons();
    inst.hidden = false; requestAnimationFrame(function () { inst.classList.add("open"); });
  };
  var maybeInstall = function () { if (cur >= 3 && slides[cur] && slides[cur].getAttribute("data-kind") !== "end") showInst(); };
  var doInstall = function () {
    if (deferred) { var d = deferred; deferred = null; try { d.prompt(); d.userChoice.then(function () { hideInst(); instButtons(); }, function () {}); } catch (e) {} }
    else if (ios) { instButtons(); showInst(); }
  };
  addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; instButtons(); });
  addEventListener("appinstalled", function () { deferred = null; standalone = true; hideInst(); instButtons(); toast("অ্যাপ ইনস্টল হয়েছে। হোম স্ক্রিন থেকে এক ট্যাপে খুলুন।"); });
  D.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-app-install],[data-ainst-go],[data-ainst-x]");
    if (!t) return;
    if (t.hasAttribute("data-ainst-x")) { ls.set("uap_inst_x", String(Date.now())); hideInst(); }
    else doInstall();
  });
  instButtons();

  // ---- প্রথমবারের টিপ: উপরে টানুন ----
  var hint = $("[data-swipehint]"), hintT;
  var hideSwipeHint = function () { if (hint && !hint.hidden) { hint.hidden = true; ls.set("uap_app_swiped", "1"); } clearTimeout(hintT); };
  if (hint && !ls.get("uap_app_swiped")) hintT = setTimeout(function () { if (cur === 0 && view === "feed" && !openBs) { hint.hidden = false; hintT = setTimeout(hideSwipeHint, 7000); } }, 1800);

  // ---- শুরু ----
  collect(); slides.forEach(function (s) { chipsFor(s, true); }); markSaved(); savedList(); fillToday(); meStats(); shapeDock();
  var h0 = location.hash.slice(1);
  if (/^(find|today|me)$/.test(h0)) showView(h0, false);
  else {
    var hashS = h0 ? D.getElementById("c-" + h0.replace(/[^\w-]/g, "")) : null;
    if (hashS && slides.indexOf(hashS) > 0) feed.scrollTop = hashS.offsetTop;
  }
  if (!io) arrive(0);
  chipsFor(slides[0]);
  fitAll(); maybeOrbTip();
  if (D.fonts && D.fonts.ready) D.fonts.ready.then(function () { fitAll(); shapeDock(); });
  var rt; addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { fitAll(); shapeDock(); if (slides[cur] && view === "feed") feed.scrollTop = slides[cur].offsetTop; }, 150); });
  D.addEventListener("visibilitychange", function () { if (D.hidden) stopSpeak(); else { fillToday(); meStats(); } });
  if ("serviceWorker" in navigator && !navigator.serviceWorker.controller && W.caches) navigator.serviceWorker.ready.then(function () {
    setTimeout(function () { caches.open("uap-img").then(function (c) { slides.slice(0, 4).forEach(function (s) { var im = $(".cd-pic img", s); if (im && im.complete && im.currentSrc) c.add(im.currentSrc).catch(function () {}); }); }).catch(function () {}); }, 1500);
  }).catch(function () {});
})();
