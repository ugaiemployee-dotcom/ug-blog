// Unique Gurukul ব্লগ: ক্লিক গণনা, লিংক কপি, সার্চ
(function () {
  var UG = window.UG || {};
  var slug = (location.pathname.match(/\/posts\/([^/]+)/) || [])[1] || (location.pathname.replace(/\/+$/, "").split("/").pop() || "home");
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest && ev.target.closest("a[href]");
    if (a) {
      var h = a.getAttribute("href") || "";
      var target = UG.free && h.indexOf(UG.free) > -1 ? "free" : UG.main && h.indexOf(UG.main) > -1 ? "main" : null;
      if (target) {
        var box = a.closest(".topbar,.nav,.hero,.inline-cta,.cta,.promo,.site-footer,.prose,.author");
        var place = box ? box.className.split(" ")[0] : "other";
        if (h.indexOf("utm_source") < 0 && h.indexOf("mailto:") !== 0) a.href = h + (h.indexOf("?") > -1 ? "&" : "?") + "utm_source=blog&utm_medium=" + place + "&utm_campaign=" + encodeURIComponent(slug);
        if (UG.u && UG.k) {
          try {
            fetch(UG.u + "/rest/v1/news_clicks", { method: "POST", keepalive: true, headers: { apikey: UG.k, Authorization: "Bearer " + UG.k, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ slug: slug.slice(0, 120), target: target, place: place.slice(0, 30) }) }).catch(function () {});
          } catch (e) {}
        }
      }
    }
    var c = ev.target.closest && ev.target.closest("[data-copy]");
    if (c && navigator.clipboard) {
      navigator.clipboard.writeText(c.getAttribute("data-copy")).then(function () { var t = c.textContent; c.textContent = "কপি হয়েছে ✓"; setTimeout(function () { c.textContent = t; }, 1800); });
    }
  });

  var q = document.getElementById("q"), out = document.getElementById("results");
  if (q && out) {
    var root = out.getAttribute("data-root") || "./", data = null;
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]; }); };
    var run = function () {
      var term = q.value.trim().toLowerCase();
      if (!term) { out.innerHTML = '<p class="empty">উপরে খোঁজার শব্দ লিখুন।</p>'; return; }
      var words = term.split(/\s+/);
      var hits = (data || []).filter(function (p) { var hay = (p.t + " " + p.e + " " + p.k + " " + p.c).toLowerCase(); return words.every(function (w) { return hay.indexOf(w) > -1; }); });
      out.innerHTML = hits.length ? hits.map(function (p) { return '<a class="result" href="' + root + "posts/" + p.s + '/"><span class="tag">' + esc(p.c) + "</span><b>" + esc(p.t) + "</b><p>" + esc(p.e) + "</p><small>" + esc(p.d) + "</small></a>"; }).join("") : '<p class="empty">কিছু পাওয়া যায়নি। অন্য শব্দ দিয়ে চেষ্টা করুন।</p>';
    };
    fetch(root + "search.json").then(function (r) { return r.json(); }).then(function (d) { data = d; var p = new URLSearchParams(location.search).get("q"); if (p) { q.value = p; } run(); });
    q.addEventListener("input", run);
    q.focus();
  }
})();
(function () {
  var bar = document.querySelector(".progress i"), cta = document.querySelector(".sticky-cta"), art = document.querySelector(".article .prose");
  var tick = function () {
    var h = document.documentElement, max = h.scrollHeight - innerHeight, y = scrollY || h.scrollTop;
    if (bar) bar.style.width = (art && max > 0 ? Math.min(100, (y / max) * 100) : 0) + "%";
    if (cta) cta.classList.toggle("show", y > 500 && y < max - 500);
  };
  addEventListener("scroll", tick, { passive: true }); tick();
})();
