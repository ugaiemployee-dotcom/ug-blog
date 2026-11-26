// AI পত্রিকা: মালিকের অ্যাডমিন প্যানেল। লগইন Telegram-এ আসা কোডে, টোকেন ১২ ঘণ্টা এই ট্যাবেই থাকে।
(function () {
  "use strict";
  var D = document, B = D.body, API = B.getAttribute("data-app") || "";
  var $ = function (s, c) { return (c || D).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || D).querySelectorAll(s)); };
  var el = function (t, c, x) { var n = D.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
  var bn = function (n) { try { return new Intl.NumberFormat("bn-IN").format(n); } catch (e) { return String(n); } };
  var ss = { get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) {} } };
  var token = ss.get("uap_admin_t");
  if (token && !(+token.split(".")[0] > Date.now() + 6e4)) { token = null; ss.set("uap_admin_t", null); }
  var post = function (o) {
    return fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { s: r.status, j: j }; }); });
  };
  var msg = function (sel, t, ok) { var m = $(sel); m.textContent = t || ""; m.className = "ad-msg" + (sel === "[data-smsg]" ? " ad-toast" : "") + (t ? (ok ? " ok" : " err") : ""); };
  var ERR = { rate_limited: "অনেকবার চেষ্টা হয়েছে। এক ঘণ্টা পরে আবার চেষ্টা করুন।", bad_code: "কোডটা ঠিক নয় বা ১০ মিনিট পেরিয়ে গেছে। নতুন কোড চেয়ে নিন।", unauthorized: "লগইনের সময় শেষ। আবার লগইন করুন।", server_error: "সার্ভারে সমস্যা হল। একটু পরে চেষ্টা করুন।" };

  // ---- লগইন ----
  var showLogin = function () { $("[data-login]").hidden = false; $("[data-panel]").hidden = true; $("[data-savebar]").hidden = true; $("[data-out]").hidden = true; };
  var showPanel = function () { $("[data-login]").hidden = true; $("[data-panel]").hidden = false; $("[data-savebar]").hidden = false; $("[data-out]").hidden = false; };
  $("[data-send]").addEventListener("click", function () {
    var b = this; b.disabled = true; msg("[data-lmsg]", "পাঠানো হচ্ছে…", true);
    post({ action: "admin_code" }).then(function (r) {
      b.disabled = false;
      if (r.s === 200 && r.j.ok) { msg("[data-lmsg]", "Telegram দেখুন। কোডটা ১০ মিনিট চলবে।", true); $("[data-step2]").hidden = false; b.textContent = "আবার কোড পাঠান"; $("[data-code]").focus(); }
      else msg("[data-lmsg]", ERR[r.j.error] || "কোড পাঠানো গেল না।", false);
    }).catch(function () { b.disabled = false; msg("[data-lmsg]", "নেটের সমস্যা। আবার চেষ্টা করুন।", false); });
  });
  var login = function () {
    var c = $("[data-code]").value.trim(); if (c.length < 6) { msg("[data-lmsg]", "৬ অঙ্কের কোড লিখুন।", false); return; }
    var b = $("[data-in]"); b.disabled = true;
    post({ action: "admin_login", code: c }).then(function (r) {
      b.disabled = false;
      if (r.s === 200 && r.j.token) { token = r.j.token; ss.set("uap_admin_t", token); $("[data-code]").value = ""; msg("[data-lmsg]", ""); load(); }
      else msg("[data-lmsg]", ERR[r.j.error] || "লগইন হল না।", false);
    }).catch(function () { b.disabled = false; msg("[data-lmsg]", "নেটের সমস্যা। আবার চেষ্টা করুন।", false); });
  };
  $("[data-in]").addEventListener("click", login);
  $("[data-code]").addEventListener("keydown", function (e) { if (e.key === "Enter") login(); });
  $("[data-out]").addEventListener("click", function () { token = null; ss.set("uap_admin_t", null); showLogin(); });

  // ---- ফর্ম ↔ সেটিংস ----
  var getPath = function (o, p) { return p.split(".").reduce(function (a, k) { return a == null ? a : a[k]; }, o); };
  var fill = function (c) {
    $$("[data-f]").forEach(function (n) {
      var v = getPath(c, n.getAttribute("data-f"));
      if (n.type === "checkbox") n.checked = !!v; else n.value = v == null ? "" : String(v);
    });
  };
  var collect = function () {
    var c = { klass: {}, banner: {}, refer: {}, ask: {} };
    $$("[data-f]").forEach(function (n) {
      var p = n.getAttribute("data-f").split("."), v = n.type === "checkbox" ? n.checked : n.type === "number" ? Number(n.value || 0) : n.value.trim();
      c[p[0]][p[1]] = v;
    });
    return c;
  };
  var check = function (c) {
    var bad = function (u) { return u && !/^https:\/\/\S+$/.test(u); };
    if (bad(c.klass.url) || bad(c.banner.url)) return "লিংক https:// দিয়ে শুরু হতে হবে।";
    if (c.banner.show && !c.banner.title) return "ঘোষণা চালু করলে শিরোনাম লিখুন।";
    if (c.refer.enabled && !c.refer.reward) return "পুরস্কার চালু করলে কী পুরস্কার, সেটা লিখুন।";
    return "";
  };

  // ---- হিসাব আর তালিকা ----
  var ago = function (t) { var m = (Date.now() - Date.parse(t)) / 6e4; return isNaN(m) ? "" : m < 60 ? bn(Math.max(1, Math.round(m))) + " মিনিট আগে" : m < 1440 ? bn(Math.round(m / 60)) + " ঘণ্টা আগে" : bn(Math.round(m / 1440)) + " দিন আগে"; };
  var PERSONA = { student: "ছাত্র", jobseeker: "চাকরিপ্রার্থী", teacher: "শিক্ষক", business: "ব্যবসা", creator: "ক্রিয়েটর" };
  var paintStats = function (st, upd) {
    var ev = st.events || {}, evt = st.events_today || {};
    var box = $("[data-stats]"); box.textContent = "";
    [["আজ পাঠক", st.readers_today], ["৭ দিনে পাঠক", st.readers_7d], ["আজ অ্যাপে", st.app_today], ["৭ দিনে অ্যাপে", st.app_7d],
     ["AI প্রশ্ন আজ", st.asks_today], ["AI প্রশ্ন ৭ দিনে", st.asks_7d], ["নাম-নম্বর ৭ দিনে", st.leads_7d], ["মোট নাম-নম্বর", st.leads_total],
     ["শেয়ার ৭ দিনে", (ev["evt-share"] || 0) + (ev["evt-invite"] || 0)], ["বন্ধু এল ৭ দিনে", st.refs_7d], ["\"আজই করুন\" খোলা ৭ দিনে", ev["evt-act"] || 0], ["ক্লাসে ক্লিক ৭ দিনে", ev["evt-class"] || 0], ["বিস্তারিত পড়তে গেলেন ৭ দিনে", ev["evt-more"] || 0], ["AI অর্ব চাপা ৭ দিনে", ev["evt-orb"] || 0]
    ].forEach(function (x) { var d = el("div", "ad-st"); d.appendChild(el("b", "", bn(x[1] || 0))); d.appendChild(el("span", "", x[0])); box.appendChild(d); });
    $("[data-upd]").textContent = upd ? new Date(upd).toLocaleString("bn-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
    var L = $("[data-leads]"); L.textContent = "";
    (st.leads || []).forEach(function (l) {
      var li = el("li"); li.appendChild(el("b", "", l.name || ""));
      var ph = String(l.phone || "").replace(/\D/g, "");
      if (ph) { var a = el("a", "", "+91 " + ph); a.href = "tel:+91" + ph; li.appendChild(a); var w = el("a", "wa", "WhatsApp"); w.href = "https://wa.me/91" + ph; w.target = "_blank"; w.rel = "noopener"; li.appendChild(w); }
      li.appendChild(el("span", "m", [PERSONA[l.persona] || "", l.district || "", l.source || "", ago(l.t)].filter(Boolean).join(" · ")));
      L.appendChild(li);
    });
    if (!L.children.length) L.appendChild(el("li", "ad-empty", "এখনও কেউ নাম দেননি।"));
    var Q = $("[data-qs]"); Q.textContent = "";
    (st.questions || []).forEach(function (q) { var li = el("li"); li.appendChild(el("b", "", q.q || "")); li.appendChild(el("span", "m", ago(q.t))); Q.appendChild(li); });
    if (!Q.children.length) Q.appendChild(el("li", "ad-empty", "এখনও কেউ প্রশ্ন করেননি।"));
    var T = $("[data-toprefs]"); T.textContent = "";
    var tr = st.top_refs || [];
    T.textContent = "মোট বন্ধু এসেছে: " + bn(st.refs_total || 0) + (tr.length ? " · সবচেয়ে বেশি: " + tr.map(function (r) { return r.code + " (" + bn(r.n) + ")"; }).join(", ") : "");
  };
  var load = function () {
    post({ action: "admin_get", token: token }).then(function (r) {
      if (r.s === 401) { token = null; ss.set("uap_admin_t", null); showLogin(); msg("[data-lmsg]", ERR.unauthorized, false); return; }
      if (r.s !== 200) { msg("[data-smsg]", ERR[r.j.error] || "লোড হল না।", false); return; }
      showPanel(); fill(r.j.config); paintStats(r.j.stats || {}, r.j.updated_at);
    }).catch(function () { msg("[data-smsg]", "নেটের সমস্যা।", false); });
  };
  $("[data-save]").addEventListener("click", function () {
    var c = collect(), e = check(c); if (e) { msg("[data-smsg]", e, false); return; }
    var b = this; b.disabled = true; b.textContent = "সেভ হচ্ছে…";
    post({ action: "admin_save", token: token, config: c }).then(function (r) {
      b.disabled = false; b.textContent = "সেভ করুন";
      if (r.s === 401) { showLogin(); msg("[data-lmsg]", ERR.unauthorized, false); return; }
      if (r.s !== 200) { msg("[data-smsg]", ERR[r.j.error] || "সেভ হল না।", false); return; }
      fill(r.j.config); paintStats(r.j.stats || {}, r.j.updated_at);
      msg("[data-smsg]", "সেভ হয়েছে। অ্যাপে ২–৩ মিনিটের মধ্যে দেখাবে।", true);
      setTimeout(function () { msg("[data-smsg]", ""); }, 4000);
    }).catch(function () { b.disabled = false; b.textContent = "সেভ করুন"; msg("[data-smsg]", "নেটের সমস্যা, সেভ হয়নি।", false); });
  });

  if (token) load(); else showLogin();
})();
