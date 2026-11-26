// Unique AI পত্রিকা: রোজের অভ্যাস (ডিভাইস আইডি, মাপজোখ, আজকের প্রম্পট, সকাল ৮টার পত্রিকা, স্ট্রিক, লিড ফর্ম)
// প্রতিটা পাতায় চলে। API না পেলে পাতা যেমন আছে তেমনই থাকে, কিছু ভাঙে না।
(function () {
  "use strict";
  var D = document, B = D.body, W = window;
  var API = B.getAttribute("data-daily") || "", R = B.getAttribute("data-root") || "/";
  var $ = function (s, c) { return (c || D).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || D).querySelectorAll(s)); };
  var ls = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} },
    json: function (k) { try { var v = JSON.parse(localStorage.getItem(k) || "null"); return v && typeof v === "object" ? v : null; } catch (e) { return null; } },
    put: function (k, o) { try { localStorage.setItem(k, JSON.stringify(o)); } catch (e) {} },
  };
  var bn = function (n) { try { return new Intl.NumberFormat("bn-IN", { useGrouping: false }).format(n); } catch (e) { return String(n); } };
  var ist = function (off) { return new Date(Date.now() + 198e5 + (off || 0) * 864e5).toISOString().slice(0, 10); };
  var str = function (v, max) { return typeof v === "string" ? v.trim().slice(0, max || 600) : ""; };

  // ---- ডিভাইস আইডি: একবার তৈরি, এই ব্রাউজারেই থাকে ----
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  var did = ls.get("uap_did");
  if (!did || !UUID.test(did)) {
    try {
      if (W.crypto && crypto.randomUUID) did = crypto.randomUUID();
      else { var b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128; var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join(""); did = h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20); }
    } catch (e) { did = ""; }
    if (did) ls.set("uap_did", did);
  }

  // ---- নেটওয়ার্ক: সময়সীমা সহ, ভুল হলে শুধু null ----
  var call = function (q, body, ms) {
    if (!API || !W.fetch) return Promise.resolve(null);
    var ctl = W.AbortController ? new AbortController() : null, t = ctl && setTimeout(function () { ctl.abort(); }, ms || 9000);
    var o = body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { method: "GET" };
    if (ctl) o.signal = ctl.signal;
    return fetch(API + (q || ""), o).then(function (r) { if (!r.ok) throw r.status; return r.json(); })
      .then(function (j) { clearTimeout(t); return j && typeof j === "object" ? j : null; })
      .catch(function () { clearTimeout(t); return null; });
  };
  var todayP;
  var today = function () {
    if (!todayP) todayP = call("?action=today").then(function (j) { if (!j || typeof j.date !== "string") { todayP = null; return null; } return j; });
    return todayP;
  };

  // ---- মাপজোখ: প্রথম কোথা থেকে এসেছেন (৩০ দিন), পাতা দেখা ----
  var dnt = navigator.doNotTrack === "1" || W.doNotTrack === "1";
  var qp = new URLSearchParams(location.search), us = str(qp.get("utm_source"), 60), um = str(qp.get("utm_medium"), 60);
  var ft = ls.json("uap_utm");
  if (ft && !(Date.now() - ft.t < 30 * 864e5)) { ft = null; ls.set("uap_utm", null); }
  if (!ft && us) { ft = { s: us, m: um, t: Date.now() }; ls.put("uap_utm", ft); }
  var persona = function () { var p = ls.get("uap_aud") || ""; return /^(student|jobseeker|teacher|business|creator)$/.test(p) ? p : ""; };
  var hit = function () {
    if (!API || !did) return;
    var ref = "";
    try { if (D.referrer) { var rh = new URL(D.referrer).hostname; if (rh !== location.hostname) ref = rh; } } catch (e) {}
    var m = { action: "hit", path: location.pathname.slice(0, 200), ref: ref.slice(0, 100), device_id: did };
    if (!dnt) { m.utm_source = (ft && ft.s) || ""; m.utm_medium = (ft && ft.m) || ""; m.persona = persona(); }
    var s = JSON.stringify(m);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(API, new Blob([s], { type: "text/plain" }))) return;
      fetch(API, { method: "POST", body: s, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(function () {});
    } catch (e) {}
  };
  if (D.readyState === "complete") setTimeout(hit, 0); else W.addEventListener("load", function () { setTimeout(hit, 0); });

  // ---- স্ট্রিক: মাথার ব্যাজ আর "আজকের প্রশ্ন" সারি ----
  var qs = ls.json("uap_qs");
  var alive = function () { return qs && qs.streak > 0 && qs.date >= ist(-2) ? qs.streak : 0; };
  var badge = function () {
    var s = alive();
    $$("[data-streak]").forEach(function (b) {
      b.hidden = !s;
      if (s) { $("b", b).textContent = bn(s); b.setAttribute("aria-label", bn(s) + " দিনের স্ট্রিক: আজকের AI প্রশ্ন"); }
    });
  };
  var strips = function (date) {
    var r = ls.json("uap_qr"), done = r && r.res && r.date && r.date === (date || ist());
    $$("[data-qstrip]").forEach(function (q) {
      var t = $("[data-qs-t]", q), go = $("[data-qs-go]", q);
      if (!t) return;
      if (t.getAttribute("data-base") == null) { t.setAttribute("data-base", t.textContent); go.setAttribute("data-base", go.textContent); }
      q.classList.toggle("done", !!done);
      t.textContent = done ? "আজ খেলেছেন: " + bn(r.res.score) + "/" + bn(r.res.total) + (alive() ? ", স্ট্রিক " + bn(alive()) + " দিন" : "") : t.getAttribute("data-base");
      go.textContent = done ? "ফলাফল" : go.getAttribute("data-base");
    });
  };
  badge(); strips();

  // ---- কপি: Clipboard API, না থাকলে পুরনো উপায় ----
  var copyText = function (txt) {
    if (navigator.clipboard && W.isSecureContext) return navigator.clipboard.writeText(txt).catch(function () { return legacy(txt); });
    return Promise.resolve(legacy(txt));
  };
  var legacy = function (txt) {
    var ta = D.createElement("textarea"); ta.value = txt; ta.setAttribute("readonly", ""); ta.className = "vh"; D.body.appendChild(ta);
    ta.select(); ta.setSelectionRange(0, txt.length);
    var ok = false; try { ok = D.execCommand("copy"); } catch (e) {}
    ta.remove(); if (!ok) throw 0; return true;
  };
  D.addEventListener("click", function (ev) {
    var b = ev.target.closest && ev.target.closest("[data-dcopy]");
    if (!b) return;
    var root = b.closest("[data-copyroot]"), src = root && $("[data-copytext]", root);
    var txt = (src ? src.textContent : b.getAttribute("data-dcopy") || "").trim();
    if (!txt) return;
    if (b.getAttribute("data-label") == null) b.setAttribute("data-label", b.textContent);
    var done = function (ok) {
      b.textContent = ok ? "কপি হয়েছে" : "কপি হল না, লেখাটা চেপে ধরে কপি করুন"; b.classList.toggle("done", ok);
      setTimeout(function () { b.textContent = b.getAttribute("data-label"); b.classList.remove("done"); }, ok ? 1800 : 3600);
    };
    copyText(txt).then(function () { done(true); }, function () { done(false); });
  });

  // ---- আজকের প্রম্পট আর সকাল ৮টার পত্রিকা ----
  var AUD = { student: "ছাত্র", jobseeker: "চাকরিপ্রার্থী", teacher: "শিক্ষক", business: "ব্যবসা", creator: "ক্রিয়েটর" };
  var fillPrompt = function (p) {
    if (!p || !str(p.prompt)) return;
    $$("[data-ptd]").forEach(function (c) {
      var set = function (s, v) { var n = $(s, c); if (n && v) n.textContent = v; };
      set("[data-pt-title]", str(p.title, 120)); set("[data-pt-why]", str(p.why, 200)); set("[data-copytext]", str(p.prompt, 1500));
      set("[data-pt-tool]", str(p.tool, 40) + (p.free === true ? " (ফ্রি)" : ""));
      var st = $("[data-pt-steps]", c), steps = Array.isArray(p.steps) ? p.steps.map(function (x) { return str(x, 240); }).filter(Boolean).slice(0, 6) : [];
      if (st && steps.length) { st.textContent = ""; steps.forEach(function (s) { var li = D.createElement("li"); li.textContent = s; st.appendChild(li); }); }
      var f = $("[data-pt-for]", c), fr = Array.isArray(p["for"]) ? p["for"].filter(function (k) { return AUD[k]; }).map(function (k) { return AUD[k]; }) : [];
      if (f) { f.textContent = fr.length ? "কাদের জন্য: " + fr.join(", ") : ""; f.hidden = !fr.length; }
      c.classList.add("live");
    });
  };
  var fillDigest = function (d) {
    var lines = d && Array.isArray(d.lines) ? d.lines.map(function (x) { return str(x, 220); }).filter(Boolean).slice(0, 5) : [];
    if (lines.length < 3) return;
    $$("[data-digest]").forEach(function (box) {
      var h = $("h2", box), k = $(".dg-k", box), ul = $("ul", box);
      if (h) h.textContent = "সকাল ৮টার পত্রিকা";
      if (k) k.textContent = "আজকের AI খবরের মূল কথা, " + bn(lines.length) + " লাইনে";
      ul.textContent = ""; lines.forEach(function (l) { var li = D.createElement("li"); li.textContent = l; ul.appendChild(li); });
      box.classList.add("dg-live");
    });
  };
  if ($("[data-ptd]") || $("[data-digest]") || $("[data-qstrip]")) today().then(function (t) {
    if (!t) return;
    fillPrompt(t.prompt); fillDigest(t.digest); strips(t.date);
  });

  // ---- লিড ফর্ম: নাম, নম্বর, পরিচয়, সম্মতি ----
  var digits = function (s) { return String(s || "").replace(/[০-৯]/g, function (c) { return String(c.charCodeAt(0) - 2534); }).replace(/\D/g, ""); };
  var phoneOk = function (s) { var d = digits(s); if (d.length === 12 && d.indexOf("91") === 0) d = d.slice(2); else if (d.length === 11 && d[0] === "0") d = d.slice(1); return /^[6-9]\d{9}$/.test(d) ? d : ""; };
  var NAME = /^[ঀ-৿A-Za-z][ঀ-৿A-Za-z .'‌‍-]{1,59}$/;
  var lead = ls.json("uap_lead");
  $$("form[data-lead]").forEach(function (f) {
    var err = $(".lf-err", f), btn = $("button[type=submit]", f), p = persona();
    if (p) { var r = $('input[name="persona"][value="' + p + '"]', f); if (r) r.checked = true; }
    if (lead && lead.name && f.elements.name && !f.elements.name.value) f.elements.name.value = lead.name;
    var bad = function (el, msg) {
      err.textContent = msg; err.hidden = false;
      try { err.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (x) {}
      $$("[aria-invalid]", f).forEach(function (n) { n.removeAttribute("aria-invalid"); });
      if (el) { if (el.setAttribute) el.setAttribute("aria-invalid", "true"); if (el.focus) el.focus(); }
    };
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = (f.elements.name.value || "").normalize("NFC").replace(/\s+/g, " ").trim();
      var ph = phoneOk(f.elements.phone.value), per = (($('input[name="persona"]:checked', f) || {}).value) || "";
      var dist = f.elements.district ? str(f.elements.district.value, 40) : "";
      if (!NAME.test(name)) return bad(f.elements.name, "নামটা লিখুন (অন্তত ২ অক্ষর, বাংলা বা ইংরেজিতে)।");
      if (!ph) return bad(f.elements.phone, "১০ অঙ্কের মোবাইল নম্বর লিখুন, যেটা ৬, ৭, ৮ বা ৯ দিয়ে শুরু।");
      if (!per) return bad($('input[name="persona"]', f), "আপনি কে, সেটা একটা বেছে নিন।");
      if (!f.elements.consent.checked) return bad(f.elements.consent, "এগোতে সম্মতির ঘরে টিক দিন।");
      err.hidden = true; $$("[aria-invalid]", f).forEach(function (n) { n.removeAttribute("aria-invalid"); });
      btn.disabled = true; var lbl = btn.textContent; btn.textContent = "পাঠানো হচ্ছে…";
      var src = f.getAttribute("data-lead");
      call("", { action: "lead", device_id: did, name: name, phone: ph, district: dist, persona: per, consent: true, source: src }, 10000).then(function (j) {
        btn.disabled = false; btn.textContent = lbl;
        var ok = !!(j && j.ok);
        if (ok) { lead = { name: name, persona: per, t: Date.now() }; ls.put("uap_lead", lead); }
        ls.set("uap_aud", per);
        if (!ok && !f.hasAttribute("data-soft")) return bad(null, "নামটা জমা হল না। নেট চালু আছে কি না দেখে আবার চেষ্টা করুন।");
        f.dispatchEvent(new CustomEvent("uap:lead", { detail: { ok: ok, name: name, persona: per } }));
      });
    });
  });

  // ---- ৫০টা প্রম্পট: নাম দিলে বাকিগুলো খোলে (API না পেলেও খোলে) ----
  var p50 = $("[data-p50]");
  if (p50) {
    var open = function () {
      p50.classList.remove("locked"); ls.set("uap_p50", "1");
      $$("[data-p50-lock]").forEach(function (n) { n.hidden = true; });
      $$("[data-p50-x]").forEach(function (n) { n.removeAttribute("inert"); n.removeAttribute("aria-hidden"); });
    };
    if (ls.get("uap_p50") === "1") open();
    var lf = $("form[data-lead]", p50.parentNode);
    if (lf) lf.addEventListener("uap:lead", function () { open(); var t = $("[data-p50-thanks]"); if (t) { t.hidden = false; t.focus(); } });
  }

  W.UAPD = { api: API, root: R, did: did, ls: ls, bn: bn, ist: ist, str: str, call: call, today: today, copy: copyText, persona: persona, AUD: AUD,
    lead: function () { return lead; },
    saveStreak: function (o) { qs = o; ls.put("uap_qs", o); badge(); strips(); } };
})();
