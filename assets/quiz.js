// Unique AI পত্রিকা: আজকের AI প্রশ্ন (কুইজ, স্ট্রিক, শেয়ার কার্ড, সার্টিফিকেট, সাপ্তাহিক সেরা)
// শুধু /quiz/ আর /certificate/ পাতায় চলে। daily.js আগে চলে window.UAPD দেয়।
(function () {
  "use strict";
  var U = window.UAPD;
  if (!U) return;
  var D = document, W = window, bn = U.bn, ls = U.ls, str = U.str;
  var $ = function (s, c) { return (c || D).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || D).querySelectorAll(s)); };
  var el = function (tag, cls, txt) { var n = D.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
  var LET = ["ক", "খ", "গ", "ঘ", "ঙ", "চ"];
  var C = { v: "#5D16E9", vi: "#4A0FC2", ink: "#17122B", ink2: "#3A3550", mut: "#5F5872", rule: "#E7E1F3", rule2: "#CFC6E6", wash: "#F7F4FF", g: "#C9922A", gl: "#F0BE5C", gi: "#7E5410", gw: "#FFF9EC" };
  var FO = "M12 2.5c.6 3.2 3 4.9 4.6 7.3 1.2 1.8 1.9 3.6 1.9 5.4A6.5 6.5 0 0 1 12 21.7a6.5 6.5 0 0 1-6.5-6.5c0-2.6 1.3-4.6 3-6.2.1 1.8.9 3.1 2.2 3.8C10.3 9.4 10.7 5.6 12 2.5z";
  var FI = "M12 12.6c1.4 1.3 2.7 2.6 2.7 4.4a2.7 2.7 0 0 1-5.4 0c0-1.4.8-2.4 1.6-3.1.1.7.4 1.2.9 1.5.2-1 .2-1.9.2-2.8z";
  var flame = function (cls) {
    var ns = "http://www.w3.org/2000/svg", s = D.createElementNS(ns, "svg");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("class", "flame " + (cls || "")); s.setAttribute("aria-hidden", "true");
    [["fm-o", FO], ["fm-i", FI]].forEach(function (p) { var e = D.createElementNS(ns, "path"); e.setAttribute("class", p[0]); e.setAttribute("d", p[1]); s.appendChild(e); });
    return s;
  };
  var bdate = function (iso, wd) {
    try { return new Intl.DateTimeFormat("bn-IN", { day: "numeric", month: "long", year: "numeric", weekday: wd ? "long" : undefined, timeZone: "UTC" }).format(new Date(iso + "T00:00:00Z")); } catch (e) { return iso; }
  };
  var SITE = (function () { var c = $('link[rel="canonical"]'); try { return new URL(U.root + "quiz/", c ? c.href : location.href).href; } catch (e) { return location.href; } })();
  var SHARE_URL = SITE + "?utm_source=share&utm_medium=quiz-result";
  var hostPath = SITE.replace(/^https?:\/\//, "").replace(/\/$/, "");

  // ---- ফন্ট তৈরি না হলে ক্যানভাসে বাংলা যুক্তাক্ষর ভাঙে, তাই আগে লোড ----
  var fontsP;
  var fonts = function () {
    if (!fontsP) fontsP = !D.fonts || !D.fonts.load ? Promise.resolve() : Promise.race([
      Promise.all(['800 60px "Anek Bangla"', '400 30px "Hind Siliguri"', '600 30px "Hind Siliguri"', '700 30px "Hind Siliguri"'].map(function (f) { return D.fonts.load(f, "আজকের প্রশ্ন স্ট্রিক্ত Ab1"); })),
      new Promise(function (r) { setTimeout(r, 3500); }),
    ]).catch(function () {});
    return fontsP;
  };
  var AF = '"Anek Bangla","Hind Siliguri",sans-serif', HF = '"Hind Siliguri",sans-serif';
  var txt = function (x, s, font, color, X, Y, align, max) {
    x.font = font; x.fillStyle = color; x.textAlign = align || "center"; x.textBaseline = "alphabetic";
    if (max) { var size = parseInt(font.match(/(\d+)px/)[1], 10); while (x.measureText(s).width > max && size > 20) { size -= 2; x.font = font.replace(/\d+px/, size + "px"); } }
    x.fillText(s, X, Y);
  };
  var rrect = function (x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); };
  var drawFlame = function (x, X, Y, size, outer, inner) {
    if (!W.Path2D) return;
    x.save(); x.translate(X, Y); x.scale(size / 24, size / 24);
    x.fillStyle = outer; x.fill(new Path2D(FO)); x.fillStyle = inner; x.fill(new Path2D(FI)); x.restore();
  };
  var icon = function () {
    return new Promise(function (res) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = U.root + "assets/app/icon-192.png"; });
  };

  // ---- শেয়ার কার্ড ১০৮০×১০৮০: উত্তর দেখায় না, শুধু ঠিক/ভুলের ঘর ----
  var shareCard = function (r) {
    return Promise.all([fonts(), icon()]).then(function (a) {
      var cv = el("canvas"); cv.width = 1080; cv.height = 1080; var x = cv.getContext("2d");
      x.fillStyle = "#fff"; x.fillRect(0, 0, 1080, 1080);
      x.fillStyle = C.v; x.fillRect(0, 0, 1080, 156);
      x.fillStyle = C.gl; x.fillRect(0, 156, 1080, 8);
      if (a[1]) { x.save(); rrect(x, 60, 40, 76, 76, 16); x.clip(); x.drawImage(a[1], 60, 40, 76, 76); x.restore(); }
      txt(x, "Unique AI পত্রিকা", "800 46px " + AF, "#fff", 158, 96, "left");
      txt(x, bdate(r.date), "600 30px " + HF, C.gl, 1020, 92, "right");
      txt(x, "আজকের AI প্রশ্ন", "800 70px " + AF, C.ink, 540, 290);
      txt(x, bn(r.score) + "/" + bn(r.total), "800 210px " + AF, C.v, 540, 520);
      var n = r.marks.length, sz = 128, gap = 22, X0 = (1080 - (n * sz + (n - 1) * gap)) / 2, Y0 = 580;
      r.marks.forEach(function (ok, i) {
        var X = X0 + i * (sz + gap);
        rrect(x, X, Y0, sz, sz, 18);
        if (ok) { x.fillStyle = C.v; x.fill(); } else { x.fillStyle = "#fff"; x.fill(); x.lineWidth = 6; x.strokeStyle = C.rule2; x.stroke(); }
        x.lineWidth = 13; x.lineCap = "round"; x.lineJoin = "round"; x.beginPath();
        if (ok) { x.strokeStyle = "#fff"; x.moveTo(X + 34, Y0 + 66); x.lineTo(X + 56, Y0 + 88); x.lineTo(X + 96, Y0 + 42); }
        else { x.strokeStyle = C.g; x.moveTo(X + 42, Y0 + 42); x.lineTo(X + 86, Y0 + 86); x.moveTo(X + 86, Y0 + 42); x.lineTo(X + 42, Y0 + 86); }
        x.stroke();
      });
      var line = bn(r.streak) + " দিনের স্ট্রিক";
      x.font = "800 58px " + AF; var w = x.measureText(line).width + 76, sx = (1080 - w) / 2;
      drawFlame(x, sx - 10, 772, 84, C.g, C.gl);
      txt(x, line, "800 58px " + AF, C.ink, sx + 76, 842, "left");
      txt(x, "আজকের AI প্রশ্ন · " + bn(r.score) + "/" + bn(r.total) + " · " + line, "600 30px " + HF, C.mut, 540, 900);
      x.fillStyle = C.gw; x.fillRect(0, 950, 1080, 130); x.fillStyle = C.gl; x.fillRect(0, 950, 1080, 4);
      txt(x, "আপনিও খেলুন, রোজ সকাল ৮টায় নতুন ৫টা প্রশ্ন", "600 30px " + HF, C.gi, 540, 1000);
      txt(x, hostPath, "700 38px " + HF, C.vi, 540, 1050);
      return cv;
    });
  };

  // ---- সার্টিফিকেট ১৬০০×১১৩১ ----
  var certCard = function (c) {
    return Promise.all([fonts(), icon()]).then(function (a) {
      var cv = el("canvas"); cv.width = 1600; cv.height = 1131; var x = cv.getContext("2d");
      x.fillStyle = "#fff"; x.fillRect(0, 0, 1600, 1131);
      x.fillStyle = C.v; x.fillRect(28, 28, 1544, 1075); x.fillStyle = "#FDFCFF"; x.fillRect(50, 50, 1500, 1031);
      x.strokeStyle = C.g; x.lineWidth = 3; x.strokeRect(74, 74, 1452, 983); x.lineWidth = 1.5; x.strokeRect(84, 84, 1432, 963);
      [[84, 84], [1516, 84], [84, 1047], [1516, 1047]].forEach(function (p) {
        x.save(); x.translate(p[0], p[1]); x.rotate(Math.PI / 4); x.fillStyle = C.gl; x.fillRect(-13, -13, 26, 26); x.fillStyle = C.v; x.fillRect(-6, -6, 12, 12); x.restore();
      });
      if (a[1]) { x.save(); rrect(x, 758, 122, 84, 84, 18); x.clip(); x.drawImage(a[1], 758, 122, 84, 84); x.restore(); }
      txt(x, "Unique AI পত্রিকা", "800 42px " + AF, C.v, 800, 262);
      txt(x, "AI সচেতন", "800 112px " + AF, C.ink, 800, 392);
      var sub = bn(c.streak) + " দিনের সার্টিফিকেট";
      x.font = "600 38px " + HF; var sw = x.measureText(sub).width;
      txt(x, sub, "600 38px " + HF, C.gi, 800, 456);
      x.fillStyle = C.gl; x.fillRect(800 - sw / 2 - 150, 442, 120, 3); x.fillRect(800 + sw / 2 + 30, 442, 120, 3);
      txt(x, "এই সার্টিফিকেট দেওয়া হল", "400 31px " + HF, C.mut, 800, 540);
      txt(x, c.name, "800 96px " + AF, C.v, 800, 656, "center", 1100);
      x.fillStyle = C.g; x.fillRect(370, 690, 860, 3);
      txt(x, "টানা " + bn(c.streak) + " দিন আজকের AI প্রশ্ন সম্পূর্ণ করেছেন", "600 40px " + HF, C.ink, 800, 770, "center", 1300);
      txt(x, bdate(c.from) + " থেকে " + bdate(c.to), "400 32px " + HF, C.ink2, 800, 830);
      x.beginPath(); x.arc(800, 958, 78, 0, Math.PI * 2); x.fillStyle = C.gl; x.fill();
      x.beginPath(); x.arc(800, 958, 66, 0, Math.PI * 2); x.fillStyle = C.v; x.fill();
      drawFlame(x, 768, 896, 64, C.gl, "#fff");
      txt(x, bn(c.streak) + " দিন", "800 28px " + AF, "#fff", 800, 1002);
      txt(x, "সার্টিফিকেট নম্বর", "400 24px " + HF, C.mut, 150, 940, "left");
      txt(x, c.cert_id, "700 32px " + HF, C.ink, 150, 984, "left");
      txt(x, "Unique Gurukul-এর উদ্যোগ", "600 28px " + HF, C.ink, 1450, 944, "right");
      txt(x, hostPath.replace(/\/quiz$/, ""), "400 24px " + HF, C.mut, 1450, 984, "right");
      return cv;
    });
  };

  // ---- শেয়ার: ফাইল সহ Web Share, না হলে ডাউনলোড আর WhatsApp লিংক ----
  var blobOf = function (cv) { return new Promise(function (res) { if (cv.toBlob) cv.toBlob(function (b) { res(b); }, "image/png"); else res(null); }); };
  var download = function (blob, name) {
    if (!blob) return false;
    try { var u = URL.createObjectURL(blob), a = el("a"); a.href = u; a.download = name; D.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000); return true; } catch (e) { return false; }
  };
  var waLink = function (text) { return "https://wa.me/?text=" + encodeURIComponent(text); };
  var shareOut = function (cv, name, text, note) {
    return blobOf(cv).then(function (blob) {
      var file = null;
      try { file = blob && W.File ? new File([blob], name, { type: "image/png" }) : null; } catch (e) {}
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], text: text }).then(function () { return "shared"; }, function (e) { return e && e.name === "AbortError" ? "cancel" : fb(); });
      }
      return fb();
      function fb() { var ok = download(blob, name); if (note) { note.hidden = false; $("[data-note-t]", note).textContent = ok ? "ছবিটা ফোনে নামানো হয়েছে। এবার WhatsApp-এ পাঠান:" : "ছবিটা চেপে ধরে সেভ করুন, তারপর WhatsApp-এ পাঠান:"; } return "fallback"; }
    });
  };

  // ---- কাউন্টডাউন: পরের সকাল ৮টা (ভারতীয় সময়) ----
  var next8 = function () { var now = Date.now(), d = new Date(now + 198e5), t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 8) - 198e5; return t > now ? t : t + 864e5; };
  var left = function (t) { var m = Math.max(0, Math.ceil((t - Date.now()) / 6e4)), h = Math.floor(m / 60); return (h ? bn(h) + " ঘণ্টা " : "") + bn(m % 60) + " মিনিট"; };

  // ---- কুইজ ----
  var app = $("[data-quiz]");
  var stage = app && $("[data-qstage]", app);
  var FREE = app ? app.getAttribute("data-freeurl") : "";
  var Q = null, ans = [], cur = 0;
  var show = function (nodes, focus) {
    stage.textContent = ""; nodes.forEach(function (n) { if (n) stage.appendChild(n); });
    stage.setAttribute("aria-busy", "false");
    if (focus) { var f = $(focus, stage); if (f) { f.setAttribute("tabindex", "-1"); f.focus({ preventScroll: true }); } }
    if (app.getBoundingClientRect().top < 0) app.scrollIntoView({ block: "start" });
  };
  var msgBox = function (title, text, btn, fn, cls) {
    var m = el("div", "qz-msg " + (cls || "")); m.appendChild(el("h2", "qz-msg-h", title)); m.appendChild(el("p", "", text));
    if (btn) { var b = el("button", "btn", btn); b.type = "button"; b.addEventListener("click", fn); m.appendChild(b); }
    var a = el("a", "btn-text", "ততক্ষণ আজকের খবর পড়ুন"); a.href = U.root; m.appendChild(a);
    return m;
  };
  var valid = function (t) {
    var q = t && t.quiz;
    if (!q || typeof q.id !== "string" || !Array.isArray(q.questions) || q.questions.length < 1) return null;
    var qs = q.questions.slice(0, 5).map(function (x) { return { q: str(x && x.q, 400), kind: x && x.kind === "gk" ? "gk" : "news", options: Array.isArray(x && x.options) ? x.options.map(function (o) { return str(o, 200); }).slice(0, 6) : [] }; });
    if (qs.some(function (x) { return !x.q || x.options.length < 2 || x.options.some(function (o) { return !o; }); })) return null;
    return { id: q.id.slice(0, 40), date: str(t.date, 10), qs: qs };
  };
  var load = function () {
    stage.setAttribute("aria-busy", "true");
    if (navigator.onLine === false) {
      var r0 = ls.json("uap_qr"); if (r0 && r0.res) return result(r0);
      return show([msgBox("অনলাইনে এলে খেলুন", "আজকের প্রশ্ন আনতে আর উত্তর মেলাতে নেট লাগে। নেট ফিরলে এই পাতা নিজেই প্রশ্ন দেখাবে।", null, null, "qz-off")]);
    }
    U.today().then(function (t) {
      Q = valid(t);
      if (!Q) return show([msgBox("আজকের প্রশ্ন এখন আনা যাচ্ছে না", "একটু পরে আবার চেষ্টা করুন। আপনার স্ট্রিক নিরাপদে আছে।", "আবার চেষ্টা করুন", load)]);
      var d = $("[data-qdate]"); if (d && Q.date) d.textContent = bdate(Q.date, true);
      var r = ls.json("uap_qr");
      if (r && r.id === Q.id && r.res) return result(r);
      var pend = ls.json("uap_qp");
      if (pend && pend.id === Q.id && Array.isArray(pend.ans) && pend.ans.length === Q.qs.length) { ans = pend.ans; return submit(); }
      ans = []; cur = 0; ask();
    });
  };
  W.addEventListener("online", function () { if ($(".qz-off", stage)) load(); });
  var ask = function () {
    var q = Q.qs[cur], n = Q.qs.length, wrap = el("div", "qz-ask");
    var prog = el("div", "qz-prog"); prog.setAttribute("aria-hidden", "true");
    for (var i = 0; i < n; i++) prog.appendChild(el("i", i < cur ? "on" : i === cur ? "now" : ""));
    wrap.appendChild(prog);
    var meta = el("p", "qz-n"); meta.appendChild(el("b", "", "প্রশ্ন " + bn(cur + 1) + "/" + bn(n))); meta.appendChild(el("span", "qz-kind", q.kind === "gk" ? "সাধারণ জ্ঞান" : "আজকের খবর থেকে"));
    wrap.appendChild(meta);
    var h = el("h2", "qz-q", q.q); h.id = "qz-q"; wrap.appendChild(h);
    var fs = el("div", "qz-opts"); fs.setAttribute("role", "radiogroup"); fs.setAttribute("aria-labelledby", "qz-q");
    var go = el("button", "btn qz-go", cur === n - 1 ? "উত্তর জমা দিন" : "পরের প্রশ্ন"); go.type = "button"; go.disabled = ans[cur] == null;
    q.options.forEach(function (o, k) {
      var lab = el("label", "qz-o"), inp = el("input"); inp.type = "radio"; inp.name = "qz-o"; inp.value = k; inp.checked = ans[cur] === k;
      lab.classList.toggle("sel", inp.checked);
      inp.addEventListener("change", function () { ans[cur] = k; $$(".qz-o", fs).forEach(function (l) { l.classList.toggle("sel", $("input", l).checked); }); go.disabled = false; });
      lab.appendChild(inp); lab.appendChild(el("b", "", LET[k])); lab.appendChild(el("span", "", o)); fs.appendChild(lab);
    });
    wrap.appendChild(fs);
    var nav = el("div", "qz-nav");
    if (cur > 0) { var bk = el("button", "btn-text", "আগের প্রশ্ন"); bk.type = "button"; bk.addEventListener("click", function () { cur--; ask(); }); nav.appendChild(bk); }
    go.addEventListener("click", function () { if (ans[cur] == null) return; if (cur < n - 1) { cur++; ask(); } else submit(); });
    nav.appendChild(go); wrap.appendChild(nav);
    show([wrap], ".qz-q");
  };
  var num = function (v, d) { v = +v; return isFinite(v) && v >= 0 ? Math.floor(v) : d; };
  var submit = function () {
    ls.put("uap_qp", { id: Q.id, ans: ans });
    show([msgBox("উত্তর মেলানো হচ্ছে…", "এক মুহূর্ত।", null, null, "qz-wait")]);
    U.call("", { action: "answer", quiz_id: Q.id, answers: ans, device_id: U.did }, 12000).then(function (j) {
      if (!j || !Array.isArray(j.correct)) return show([msgBox("উত্তর জমা হল না", "আপনার বাছাই করা উত্তর এই ফোনে রাখা আছে। নেট চালু আছে কি না দেখে আবার পাঠান।", "আবার পাঠান", submit)]);
      var res = { score: num(j.score, 0), total: num(j.total, Q.qs.length), correct: j.correct.slice(0, Q.qs.length).map(function (c) { return num(c, -1); }),
        explanations: Array.isArray(j.explanations) ? j.explanations.map(function (e) { return str(e, 500); }) : [], streak: num(j.streak, 1), best: num(j.best, 1),
        days_played: num(j.days_played, 1), week: Array.isArray(j.week) ? j.week.filter(function (w) { return /^\d{4}-\d\d-\d\d$/.test(w); }) : [], certificate_ready: j.certificate_ready === true };
      var r = { id: Q.id, date: Q.date, qs: Q.qs, ans: ans, res: res, first: !ls.get("uap_q1") };
      ls.put("uap_qr", r); ls.set("uap_qp", null); ls.set("uap_q1", "1");
      U.saveStreak({ streak: res.streak, best: res.best, days: res.days_played, date: U.ist(), week: res.week });
      result(r, true);
    });
  };
  var WD = ["র", "সো", "ম", "বু", "বৃ", "শু", "শ"];
  var result = function (r, fresh) {
    var s = r.res, marks = r.ans.map(function (a, i) { return a === s.correct[i]; });
    var out = [], top = el("section", "qz-res");
    var sc = el("div", "qz-score"); sc.appendChild(el("span", "qz-score-k", fresh ? "আজকের ফল" : "আজ আপনি খেলেছেন"));
    var big = el("p", "qz-big", bn(s.score) + "/" + bn(s.total)); big.id = "qz-big"; sc.appendChild(big);
    var grid = el("p", "qz-grid"); grid.setAttribute("aria-label", bn(s.score) + "টা ঠিক, " + bn(s.total - s.score) + "টা ভুল");
    marks.forEach(function (m) { grid.appendChild(el("i", m ? "ok" : "no")); }); sc.appendChild(grid); top.appendChild(sc);
    var st = el("div", "qz-streak"), sl = el("p", "qz-st-n"); sl.appendChild(flame()); sl.appendChild(el("b", "", bn(s.streak))); sl.appendChild(el("span", "", "দিনের স্ট্রিক"));
    st.appendChild(sl); st.appendChild(el("p", "qz-best", "সবচেয়ে বেশি: " + bn(Math.max(s.best, s.streak)) + " দিন · মোট খেলেছেন " + bn(s.days_played) + " দিন"));
    var wk = el("ol", "qz-week"); wk.setAttribute("aria-label", "গত ৭ দিন");
    var base = Date.parse((r.date || U.ist()) + "T00:00:00Z");
    for (var i = 6; i >= 0; i--) {
      var iso = new Date(base - i * 864e5).toISOString().slice(0, 10), on = s.week.indexOf(iso) > -1 || (i === 0);
      var li = el("li", (on ? "on" : "") + (i === 0 ? " today" : "")); li.appendChild(el("i")); li.appendChild(el("span", "", WD[new Date(iso + "T00:00:00Z").getUTCDay()]));
      li.setAttribute("aria-label", bdate(iso) + (on ? ": খেলেছেন" : ": খেলেননি")); wk.appendChild(li);
    }
    st.appendChild(wk); top.appendChild(st);
    var text = "আজকের AI প্রশ্ন · " + bn(s.score) + "/" + bn(s.total) + " · " + bn(s.streak) + " দিনের স্ট্রিক\n" + marks.map(function (m) { return m ? "✅" : "❌"; }).join("") + "\nআপনিও খেলুন: " + SHARE_URL;
    var act = el("div", "qz-act"), sb = el("button", "btn", "ফলাফল শেয়ার করুন"), wa = el("a", "btn-line", "WhatsApp-এ পাঠান");
    sb.type = "button"; wa.href = waLink(text); wa.target = "_blank"; wa.rel = "noopener";
    var note = el("div", "qz-note"); note.hidden = true; note.appendChild(el("p", "", "")); note.firstChild.setAttribute("data-note-t", "");
    var wa2 = el("a", "btn-line", "WhatsApp খুলুন"); wa2.href = wa.href; wa2.target = "_blank"; wa2.rel = "noopener"; note.appendChild(wa2);
    var pv = el("img", "qz-card"); pv.alt = "আজকের ফলাফলের ছবি: " + bn(s.score) + "/" + bn(s.total) + ", " + bn(s.streak) + " দিনের স্ট্রিক"; pv.hidden = true; pv.width = 540; pv.height = 540;
    sb.addEventListener("click", function () {
      sb.disabled = true; sb.textContent = "ছবি তৈরি হচ্ছে…";
      shareCard({ date: r.date || U.ist(), score: s.score, total: s.total, streak: s.streak, marks: marks }).then(function (cv) {
        pv.src = cv.toDataURL("image/png"); pv.hidden = false;
        return shareOut(cv, "ai-proshno-" + (r.date || "aaj") + ".png", text, note);
      }).then(function () { sb.disabled = false; sb.textContent = "আবার শেয়ার করুন"; }, function () { sb.disabled = false; sb.textContent = "ফলাফল শেয়ার করুন"; note.hidden = false; $("[data-note-t]", note).textContent = "ছবি তৈরি হল না। লেখাটা WhatsApp-এ পাঠান:"; });
    });
    act.appendChild(sb); act.appendChild(wa); top.appendChild(act); top.appendChild(note); top.appendChild(pv);
    out.push(top);
    if (!U.persona() && (fresh || r.first)) out.push(personaBox());
    if (s.certificate_ready || s.streak >= 7) out.push(certBox(s.streak));
    if (s.days_played >= 5 && FREE) {
      var fc = el("p", "qz-class"); fc.appendChild(el("span", "", bn(s.days_played) + " দিন ধরে খেলছেন। AI হাতে-কলমে শিখতে চাইলে Unique Gurukul-এর ৪ দিনের ফ্রি ক্লাস আছে, বাংলায়। "));
      var fa = el("a", "", "ফ্রি ক্লাসের বিস্তারিত"); fa.href = FREE + (FREE.indexOf("?") > -1 ? "&" : "?") + "utm_source=patrika&utm_medium=quiz-day5"; fa.target = "_blank"; fa.rel = "noopener";
      fc.appendChild(fa); out.push(fc);
    }
    var cd = el("div", "qz-next"), t8 = Date.parse((r.date || U.ist()) + "T08:00:00+05:30") + 864e5;
    if (!(t8 > Date.now())) t8 = next8();
    var early = new Date(t8 + 198e5).toISOString().slice(0, 10) === U.ist();
    cd.appendChild(el("p", "qz-next-h", early ? "নতুন প্রশ্ন আজ সকাল ৮টায়" : "কাল আবার আসুন — নতুন প্রশ্ন সকাল ৮টায়"));
    var cl = el("p", "qz-next-t"); cl.setAttribute("aria-live", "off"); cd.appendChild(cl);
    var tick = function () { if (!cl.isConnected) return clearInterval(iv); if (Date.now() >= t8) { cl.textContent = "নতুন প্রশ্ন এসে গেছে। পাতাটা আবার খুলুন।"; return clearInterval(iv); } cl.textContent = "আর " + left(t8) + " বাকি"; };
    var iv = setInterval(tick, 3e4);
    var lk = el("p", "qz-links"), a1 = el("a", "", "আজকের প্রম্পট"), a2 = el("a", "", "আজকের খবর"); a1.href = U.root + "prompt/"; a2.href = U.root;
    lk.appendChild(a1); lk.appendChild(a2); cd.appendChild(lk); out.push(cd);
    out.push(review(r, marks));
    show(out, fresh ? "#qz-big" : null);
    tick();
    board();
  };
  var review = function (r, marks) {
    var sec = el("section", "qz-rev"); sec.appendChild(el("h2", "", "উত্তর মিলিয়ে দেখুন"));
    var ol = el("ol");
    (r.qs || []).forEach(function (q, i) {
      var li = el("li", marks[i] ? "ok" : "no"), c = r.res.correct[i], mine = r.ans[i];
      li.appendChild(el("p", "qz-rq", q.q));
      var a = el("p", "qz-ra"); a.appendChild(el("b", "", marks[i] ? "ঠিক" : "ভুল")); a.appendChild(el("span", "", "আপনার উত্তর: " + (LET[mine] || "") + ". " + (q.options[mine] || "")));
      li.appendChild(a);
      if (!marks[i] && q.options[c]) li.appendChild(el("p", "qz-rc", "ঠিক উত্তর: " + LET[c] + ". " + q.options[c]));
      if (r.res.explanations[i]) li.appendChild(el("p", "qz-rx", r.res.explanations[i]));
      ol.appendChild(li);
    });
    sec.appendChild(ol); return sec;
  };
  var personaBox = function () {
    var b = el("section", "qz-who"); b.appendChild(el("h2", "", "আপনি কে?"));
    b.appendChild(el("p", "", "বেছে নিলে আপনার কাজে লাগে এমন খবর আর প্রম্পট আগে দেখাব। শুধু এই ফোনে মনে রাখা হয়।"));
    var row = el("div", "qz-who-r");
    Object.keys(U.AUD).forEach(function (k) {
      var x = el("button", "chip", U.AUD[k]); x.type = "button";
      x.addEventListener("click", function () { U.ls.set("uap_aud", k); b.textContent = ""; var p = el("p", "qz-who-ok", "ঠিক আছে, " + U.AUD[k] + "দের কাজের খবর আগে দেখাব।"); p.setAttribute("role", "status"); b.appendChild(p); });
      row.appendChild(x);
    });
    b.appendChild(row); return b;
  };

  // ---- সার্টিফিকেট: নাম না থাকলে আগে ফর্ম ----
  var certForm = $("[data-certform]");
  var certOut = function (box, c) {
    return certCard(c).then(function (cv) {
      var img = el("img", "cert-img"); img.src = cv.toDataURL("image/png"); img.alt = c.name + "-এর " + bn(c.streak) + " দিনের AI সচেতন সার্টিফিকেট"; img.width = 800; img.height = 566;
      var row = el("div", "qz-act"), dl = el("button", "btn", "ছবি ডাউনলোড করুন"), sh = el("button", "btn-line", "শেয়ার করুন");
      dl.type = sh.type = "button";
      var t = "আমি টানা " + bn(c.streak) + " দিন Unique AI পত্রিকার আজকের AI প্রশ্ন খেলে \"AI সচেতন\" সার্টিফিকেট পেয়েছি। আপনিও খেলুন: " + SHARE_URL;
      var note = el("div", "qz-note"); note.hidden = true; note.appendChild(el("p", "")); note.firstChild.setAttribute("data-note-t", "");
      var wa = el("a", "btn-line", "WhatsApp খুলুন"); wa.href = waLink(t); wa.target = "_blank"; wa.rel = "noopener"; note.appendChild(wa);
      var fn = "ai-sochetan-" + c.cert_id + ".png";
      dl.addEventListener("click", function () { blobOf(cv).then(function (b) { download(b, fn); }); });
      sh.addEventListener("click", function () { shareOut(cv, fn, t, note); });
      row.appendChild(dl); row.appendChild(sh);
      box.textContent = ""; box.appendChild(img); box.appendChild(row); box.appendChild(note);
    });
  };
  var getCert = function () {
    return U.call("?action=certificate&device_id=" + encodeURIComponent(U.did || ""), null, 10000).then(function (j) {
      if (!j) return { err: true };
      if (j.ready !== true) return { ready: false, streak: num(j.streak, 0) };
      var c = { ready: true, name: str(j.name, 60), streak: Math.max(7, num(j.streak, 7)), from: str(j.from, 10), to: str(j.to, 10), cert_id: str(j.cert_id, 40).replace(/[^\w-]/g, "") };
      if (!/^\d{4}-\d\d-\d\d$/.test(c.from) || !/^\d{4}-\d\d-\d\d$/.test(c.to) || !c.cert_id) return { err: true };
      return c;
    });
  };
  var certFlow = function (box, after) {
    var stat = el("p", "qz-wait", "সার্টিফিকেট তৈরি হচ্ছে…"); stat.setAttribute("role", "status"); box.textContent = ""; box.appendChild(stat);
    return getCert().then(function (c) {
      if (c.err) { stat.textContent = "সার্টিফিকেট এখন আনা গেল না। একটু পরে আবার চেষ্টা করুন।"; return c; }
      if (!c.ready) { stat.textContent = "সার্টিফিকেট এখনও তৈরি হয়নি। আপনার স্ট্রিক এখন " + bn(c.streak) + " দিন, টানা ৭ দিন হলেই পাবেন।"; return c; }
      if (!c.name) { needName(box, after); return c; }
      return certOut(box, c).then(function () { return c; });
    });
  };
  var needName = function (box, after) {
    if (!certForm) return;
    box.textContent = ""; box.appendChild(el("p", "qz-cert-ask", "সার্টিফিকেটে যে নাম ছাপা হবে, সেটা লিখুন।"));
    certForm.hidden = false; box.appendChild(certForm);
    var f = $("form", certForm);
    var on = function () { f.removeEventListener("uap:lead", on); certForm.hidden = true; D.body.appendChild(certForm); certFlow(box, after); };
    f.addEventListener("uap:lead", on);
    var n = f.elements.name; if (n) n.focus();
  };
  var certBox = function (streak) {
    var b = el("section", "qz-cert"), head = el("div", "qz-cert-h"); head.appendChild(flame("big"));
    var tx = el("div"); tx.appendChild(el("h2", "", "AI সচেতন — " + bn(Math.max(7, streak)) + " দিনের সার্টিফিকেট"));
    tx.appendChild(el("p", "", "টানা " + bn(streak) + " দিন খেলেছেন। নিজের নামে সার্টিফিকেট নিন, ফোনে রাখুন আর শেয়ার করুন।")); head.appendChild(tx); b.appendChild(head);
    var box = el("div", "qz-cert-b"), go = el("button", "btn-gold", "সার্টিফিকেট নিন"); go.type = "button"; box.appendChild(go); b.appendChild(box);
    go.addEventListener("click", function () { if (U.lead() && U.lead().name) certFlow(box); else needName(box); });
    return b;
  };

  // ---- সাপ্তাহিক সেরা ----
  var boardDone = false;
  var board = function () {
    var lb = $("[data-lb]"); if (!lb || boardDone) return; boardDone = true;
    U.call("?action=leaderboard").then(function (j) {
      var top = j && Array.isArray(j.top) ? j.top.filter(function (t) { return t && str(t.name, 40); }).slice(0, 10) : [];
      if (!top.length) return;
      var ol = $("ol", lb); ol.textContent = "";
      top.forEach(function (t, i) {
        var li = el("li"); li.appendChild(el("i", "", bn(i + 1))); li.appendChild(el("b", "", str(t.name, 40)));
        var m = el("span", "lb-m"); m.appendChild(el("span", "", bn(num(t.score, 0)) + " নম্বর"));
        if (num(t.streak, 0) > 0) { var f = el("span", "lb-st"); f.appendChild(flame()); f.appendChild(el("span", "", bn(num(t.streak, 0)))); f.setAttribute("aria-label", bn(num(t.streak, 0)) + " দিনের স্ট্রিক"); m.appendChild(f); }
        li.appendChild(m); ol.appendChild(li);
      });
      lb.hidden = false;
    });
  };

  if (app && stage) { load(); }

  // ---- /certificate/ পাতা ----
  var cp = $("[data-certpage]");
  if (cp) {
    var run = function () {
      certFlow(cp).then(function (c) {
        if (c && (c.err || !c.ready)) {
          var row = el("p", "qz-act"), a = el("a", "btn", "আজকের AI প্রশ্ন খেলুন"); a.href = U.root + "quiz/"; row.appendChild(a);
          if (c.err) { var r = el("button", "btn-line", "আবার চেষ্টা করুন"); r.type = "button"; r.addEventListener("click", run); row.appendChild(r); }
          cp.appendChild(row);
        }
      });
    };
    run();
  }
})();
