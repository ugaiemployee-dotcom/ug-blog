// Unique AI পত্রিকা builder. No dependencies: `node build.mjs` turns posts/*.json into a static site + PWA in dist/.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, cpSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const cfg = JSON.parse(readFileSync("site.config.json", "utf8"));
const SITE = cfg.siteUrl.replace(/\/+$/, ""); // ডোমেইন বদলাতে শুধু site.config.json-এর siteUrl বদলান
const OUT = "dist";
const PER_PAGE = 12;
const NOW = Date.now();

const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dparts = (d, weekday) => {
  const parts = new Intl.DateTimeFormat("bn-IN", { weekday: weekday ? "long" : undefined, day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).formatToParts(new Date(d));
  const g = (t) => parts.find((x) => x.type === t)?.value || "";
  return `${weekday ? g("weekday") + ", " : ""}${g("day")} ${g("month")} ${g("year")}`;
};
const bnDate = (d) => dparts(d, false); // ২৩ নভেম্বর ২০২৬
const bnNum = (n) => new Intl.NumberFormat("bn-IN").format(n);
const isoDate = (d) => new Date(d).toISOString();
const text = (html = "") => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const abs = (p) => (/^https?:\/\//.test(p) ? p : `${SITE}/${p.replace(/^\/+/, "")}`);
const catName = (k) => cfg.categories[k] || k;
const host = (u) => u.replace(/^https?:\/\//, "").replace(/\/+$/, "");
// Unique Gurukul-এর প্রতিটা লিংকে utm: কোন জায়গা থেকে ক্লিক হল তা বোঝা যায়
const ug = (u, medium) => esc(`${u}${u.includes("?") ? "&" : "?"}utm_source=patrika&utm_medium=${medium}`);
const UG_HREF = new RegExp(`href="(https?://(?:www\\.)?(?:${[cfg.mainSiteUrl, cfg.freeClassUrl].map((u) => host(u).replace(/\./g, "\\.")).join("|")})[^"]*)"`, "g");
const utmHtml = (html = "", medium) => html.replace(UG_HREF, (m, u) => (u.includes("utm_source") ? m : `href="${u}${u.includes("?") ? "&amp;" : "?"}utm_source=patrika&amp;utm_medium=${medium}"`));
const TG = cfg.telegramUrl || "https://t.me/uniquegurukulfamily";
const hasLogo = existsSync("assets/logo.webp");
const logoAbs = hasLogo ? abs("assets/logo.webp") : cfg.logoSourceUrl;
const APPICON = existsSync("assets/app/icon-512.png");

// ছবির আসল মাপ (CLS এড়াতে width/height)
function imgSize(f) {
  try {
    const b = readFileSync(f);
    if (b[0] === 0x89 && b[1] === 0x50) return [b.readUInt32BE(16), b.readUInt32BE(20)];
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i < b.length - 9) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
    if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
      const t = b.toString("ascii", 12, 16);
      if (t === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
      if (t === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
      if (t === "VP8L") { const n = b.readUInt32LE(21); return [1 + (n & 0x3fff), 1 + ((n >> 14) & 0x3fff)]; }
    }
  } catch (e) {}
  return [1200, 630];
}

// ---- খবরের ধরন, কাদের জন্য, ভারতে চালু, দাম ----
const TYPES = cfg.newsTypes || [];
const TYPE = Object.fromEntries(TYPES.map((t) => [t.key, t]));
// য়/ড়/ঢ় দুইভাবে লেখা যায় (এক অক্ষরে বা নুক্তা দিয়ে), তাই তুলনার আগে NFC করে নিই
const nf = (s) => String(s ?? "").normalize("NFC").trim();
const TYPE_BY_LABEL = Object.fromEntries(TYPES.map((t) => [nf(t.label), t.key]));
const AUD = cfg.audiences || {};
const AUD_BY_LABEL = Object.fromEntries(Object.entries(AUD).map(([k, v]) => [nf(v), k]));
const INDIA = { available: "ভারতে চালু ✅", soon: "ভারতে শীঘ্রই", no: "ভারতে এখনও নেই" };
const PRICE = { free: "ফ্রি", freemium: "আংশিক ফ্রি", paid: "পেইড" };
// বন্ধনীর আগের অংশটুকুই আসল কথা: "টাকা লাগে (ফ্রি ব্যবহারকারীদের জন্য নয়)" মানে পেইড
const head = (v = "") => nf(String(v).split("(")[0]);
const rx = (s) => new RegExp(nf(s));
const indiaFrom = (v = "") => {
  const m = head(v);
  if (!m || /বলা নেই/.test(m)) return null;
  if (rx("শীঘ্রই|চালু হচ্ছে|আসছে").test(m)) return "soon";
  if (rx("এখনও|নয়|হয়নি|নেই|বন্ধ").test(m)) return "no";
  if (/চালু/.test(m)) return "available";
  return null;
};
const priceFrom = (v = "") => {
  const m = head(v);
  if (!m || /বলা নেই/.test(m)) return null;
  const free = /ফ্রি/.test(m), paid = /টাকা|\$|ডলার|পেইড|চার্জ|ফি(?![\u0980-\u09FF])|শুরু/.test(m.replace(/ফ্রি/g, ""));
  if (/আংশিক ফ্রি|কিছু ফ্রি/.test(m) || (free && paid)) return "freemium";
  if (free) return "free";
  if (/টাকা|\$|ডলার|পেইড|চার্জ/.test(m)) return "paid";
  return null;
};
function deriveMeta(p) {
  const tags = p.tags.map(nf);
  p.type = TYPE[p.news_type] ? p.news_type : TYPE_BY_LABEL[tags[0]] || cfg.typeFromCategory?.[p.category] || TYPES[0]?.key;
  const aud = Array.isArray(p.audience) ? p.audience : tags.map((t) => AUD_BY_LABEL[t]);
  p.aud = [...new Set(aud.filter((a) => AUD[a]))];
  const fact = (l) => (p.quick_facts.find((f) => nf(f.label) === nf(l)) || {}).value || "";
  p.india = INDIA[p.india] ? p.india : indiaFrom(String(fact("ভারতে")));
  p.price = PRICE[p.price] ? p.price : priceFrom(String(fact("খরচ")));
  p.push_line = p.push_line || p.card_headline || p.title;
  p.tags = p.tags.filter((t) => !TYPE_BY_LABEL[nf(t)] && !AUD_BY_LABEL[nf(t)]);
  p.pinned = p.type === "scam-alert" && NOW - new Date(p.date).getTime() < 3 * 864e5;
}
const typeLabel = (k) => TYPE[k]?.label || "";

// ---- AI tool library (icons + matching) ----
const TOOLS = existsSync("data/tools.json") ? JSON.parse(readFileSync("data/tools.json", "utf8")).map((t) => ({ ...t, re: new RegExp(`(?<![a-z])(?:${t.match})`, "i") })) /* শব্দের শুরু থেকে মিল: "Inkling" যেন "Kling" না হয় */ : [];
const toolsFor = (p) => {
  const hay = `${p.title} ${(p.tags || []).join(" ")} ${text(p.body_html).slice(0, 700)}`;
  return TOOLS.filter((t) => t.re.test(hay)).slice(0, 4);
};
const toolChip = (t, root, link = true) => {
  const inner = `${t.icon ? `<img src="${root}${t.icon}" alt="" width="18" height="18" loading="lazy">` : `<i aria-hidden="true">${esc(t.name[0])}</i>`}${esc(t.name)}`;
  return link ? `<a class="tool" href="${root}tool/${t.key}/">${inner}</a>` : `<span class="tool">${inner}</span>`;
};
// ---- টুলের বিভাগ (ছবি, ভিডিও, চ্যাট...) ----
const TCATS = cfg.toolCats || {};
const toolsIn = (c) => TOOLS.filter((t) => t.cat === c);
const postsOfTool = (t) => posts.filter((p) => p.tools.includes(t));
const postsOfCat = (c) => posts.filter((p) => p.tools.some((t) => t.cat === c));
const toolIcon = (t, root, size = 28) => t.icon ? `<img src="${root}${t.icon}" alt="" width="${size}" height="${size}" loading="lazy">` : `<i aria-hidden="true">${esc(t.name[0])}</i>`;
// একটা টুলের সারি: নাম, এক লাইনের পরিচয়, আর আপডেট থাকলে তার লিংক
const toolRow = (t, root) => {
  const n = postsOfTool(t).length;
  const inner = `<span class="tr-ic">${toolIcon(t, root)}</span><span class="tr-tx"><b>${esc(t.name)}</b><span>${esc(t.desc || "")}</span></span><em>${n ? `${bnNum(n)}টি খবর` : "খবর এলে এখানে"}</em>`;
  return n ? `<a class="trow" href="${root}tool/${t.key}/">${inner}</a>` : `<div class="trow trow-off">${inner}</div>`;
};
// তারিখ ধরে আপডেটের তালিকা
const timeline = (items, root) => `<ol class="tline">${items.map((p) => `<li><time datetime="${p.date}">${bnDate(p.date)}</time><a href="${root}posts/${p.slug}/"><b>${esc(p.title)}</b><span>${esc(p.excerpt)}</span></a></li>`).join("")}</ol>`;

const CAT_ICON = {
  "ai-tools": '<path d="M12 2l2.4 6.2L21 9l-5 4.3L17.5 20 12 16.4 6.5 20 8 13.3 3 9l6.6-.8z"/>',
  "vibe-coding": '<path d="M8 6l-6 6 6 6M16 6l6 6-6 6M14 3l-4 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  "automation": '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  "ai-income": '<path d="M3 17l6-6 4 4 8-8M15 7h6v6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
};
const catIcon = (k) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">${CAT_ICON[k] || CAT_ICON["ai-tools"]}</svg>`;

// ---- Unique Gurukul-এর নিজস্ব AI টুল ----
const OWN = existsSync("data/own-tools.json") ? JSON.parse(readFileSync("data/own-tools.json", "utf8")) : [];
const ownCard = (t) => `<a class="own" href="${esc(t.url)}?utm_source=patrika&utm_medium=own-tools" target="_blank" rel="noopener"><div class="own-top"><i aria-hidden="true">${esc(t.name.replace(/^AI /, "")[0])}</i><div><span class="own-cat">${esc(t.category)}</span><b>${esc(t.name)}</b></div></div><em>${esc(t.tagline)}</em><p>${esc(t.desc)}</p><ul>${t.points.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><span class="more">টুলটা দেখুন</span></a>`;
const ownSection = () => OWN.length ? `<section class="own-tools"><div class="wrap"><p class="lede">বিভিন্ন বিভাগে Unique Gurukul-এর ৪০টিরও বেশি নিজস্ব AI টুল আছে, আরও তৈরি হচ্ছে। তার মধ্যে কয়েকটা:</p><div class="own-grid">${OWN.map(ownCard).join("")}<div class="own own-more"><b>আরও টুল আসছে</b><p>বাকি টুলগুলো একে একে এখানে যোগ হবে।</p><a class="btn" href="${ug(cfg.mainSiteUrl, "own-tools")}">Unique Gurukul-এর ওয়েবসাইট</a></div></div></div></section>` : "";

// ---- load posts ----
const posts = [];
const seen = new Set();
if (existsSync("posts")) {
  for (const f of readdirSync("posts").filter((f) => f.endsWith(".json"))) {
    let p;
    try {
      p = JSON.parse(readFileSync(join("posts", f), "utf8"));
    } catch (e) {
      console.warn(`SKIP ${f}: invalid JSON (${e.message})`);
      continue;
    }
    if (p.status === "draft") continue;
    if (!p.title || !p.body_html) { console.warn(`SKIP ${f}: title/body_html missing`); continue; }
    p.slug = (p.slug || f.replace(/\.json$/, "")).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!p.slug || seen.has(p.slug)) { console.warn(`SKIP ${f}: empty or duplicate slug`); continue; }
    seen.add(p.slug);
    p.date = p.date || new Date().toISOString().slice(0, 10);
    p.category = cfg.categories[p.category] ? p.category : Object.keys(cfg.categories)[0];
    p.excerpt = p.excerpt || text(p.body_html).slice(0, 150);
    p.meta_description = p.meta_description || p.excerpt;
    p.tags = Array.isArray(p.tags) ? p.tags : [];
    if (p.cover && !/^https?:/.test(p.cover) && !existsSync(p.cover)) p.cover = null; // কার্ড এখনও তৈরি না হলে
    if (p.photo && !existsSync(p.photo)) p.photo = null;
    p.photoSize = p.photo ? imgSize(p.photo) : null;
    p.quick_facts = Array.isArray(p.quick_facts) ? p.quick_facts.filter((f) => f && f.label && f.value) : [];
    p.key_points = Array.isArray(p.key_points) ? p.key_points.filter(Boolean).slice(0, 5) : [];
    p.faq = Array.isArray(p.faq) ? p.faq.filter((f) => f && f.q && f.a).slice(0, 5) : [];
    deriveMeta(p);
    p.quick_facts = p.quick_facts.slice(0, 6);
    p.tools = toolsFor(p);
    p.minutes = Math.max(1, Math.round(text(p.body_html).split(" ").length / 180));
    posts.push(p);
  }
}
posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.slug.localeCompare(a.slug)));
const typeCount = (k) => posts.filter((p) => p.type === k).length;

// ---- AI ফ্ল্যাশ: ছোট খবর। build-এর সময় একবার আনা হয় (SEO আর JS ছাড়া পাঠকের জন্য), পাতায় site.js নিজে তাজা করে ----
const INDIA_S = { available: "ভারতে চালু", soon: "ভারতে শীঘ্রই", no: "ভারতে নেই" };
let briefs = [];
if (cfg.briefsApi && !process.env.NO_BRIEFS) {
  try {
    const r = await fetch(cfg.briefsApi, { signal: AbortSignal.timeout(8000), headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    briefs = (Array.isArray(j?.briefs) ? j.briefs : [])
      .filter((b) => b && typeof b.title === "string" && b.title.trim() && !isNaN(Date.parse(b.time)))
      .map((b) => ({ id: String(b.id ?? "").replace(/[^\w-]/g, "").slice(0, 40), title: b.title.trim().slice(0, 160), body: String(b.body || "").trim().slice(0, 500), type: TYPE[b.news_type] ? b.news_type : "", tool: String(b.tool || "").trim().slice(0, 40), india: INDIA[b.india] ? b.india : "", price: PRICE[b.price] ? b.price : "", imp: +b.importance || 1, time: new Date(b.time).toISOString() }))
      .filter((b) => b.id)
      .sort((a, b) => (a.time < b.time ? 1 : -1));
  } catch (e) {
    console.warn(`briefs: আনা গেল না (${e.message}); সর্বশেষ খবর থেকে ফ্ল্যাশ বানানো হচ্ছে`);
  }
}
const LIVE = briefs.filter((b) => NOW - Date.parse(b.time) < 48 * 36e5 && Date.parse(b.time) <= NOW + 6e5).slice(0, 60);
const BRK = LIVE.filter((b) => b.imp >= 3 && NOW - Date.parse(b.time) < 24 * 36e5).slice(0, 4);
const bnTime = (d) => new Intl.DateTimeFormat("bn-IN", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(d));
const fromPost = (p) => ({ slug: p.slug, title: p.card_headline || p.title, body: p.excerpt, type: p.type, tool: p.tools[0]?.name || "", india: p.india || "", price: p.price || "", imp: 1, date: p.date });

// ---- asset version (cache-busting + service worker) ----
const CSS = readFileSync("src/style.css", "utf8");
const JS = readFileSync("assets/site.js", "utf8");
const SW_SRC = readFileSync("src/sw.js", "utf8");
const DJS = readFileSync("assets/daily.js", "utf8");
const QJS = readFileSync("assets/quiz.js", "utf8");
const ACSS = readFileSync("src/app.css", "utf8");
const AJS = readFileSync("assets/app.js", "utf8");
const APP_BG = "#FAF8F3"; // কার্ড ফিডের উষ্ণ সাদা কাগজ (manifest আর /app/-এর theme-color)
const P50 = JSON.parse(readFileSync("data/prompts50.json", "utf8"));
const VER = createHash("sha1").update(CSS + JS + DJS + QJS + ACSS + AJS + SW_SRC + JSON.stringify(cfg) + JSON.stringify(P50)).digest("hex").slice(0, 10);
const DAILY = cfg.dailyApi || "";

// ---- shared pieces ----
const ORG = { "@type": "EducationalOrganization", "@id": `${cfg.mainSiteUrl}/#org`, name: cfg.brand, url: cfg.mainSiteUrl, logo: logoAbs, foundingDate: cfg.founded, founder: { "@type": "Person", name: cfg.mentorName }, sameAs: [cfg.freeClassUrl], email: cfg.email, address: { "@type": "PostalAddress", streetAddress: cfg.address?.street, addressLocality: cfg.address?.locality, addressRegion: "West Bengal", postalCode: cfg.address?.pin, addressCountry: "IN" }, areaServed: [{ "@type": "State", name: "West Bengal" }, { "@type": "Country", name: "India" }], knowsLanguage: ["bn", "en"], description: cfg.orgDescription };
const PUB = { "@type": "NewsMediaOrganization", "@id": `${SITE}/#patrika`, name: cfg.siteName, url: `${SITE}/`, logo: APPICON ? abs("assets/app/icon-512.png") : logoAbs, slogan: cfg.motto, parentOrganization: { "@id": ORG["@id"] }, inLanguage: "bn" };
const crumbs = (items) => ({ "@type": "BreadcrumbList", itemListElement: items.map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })) });

const hasMentor = existsSync("assets/mentor.webp");
const authorBox = (root) => `<div class="author">${hasMentor ? `<img class="avatar" src="${root}assets/mentor.webp" alt="${esc(cfg.mentorName)}" width="64" height="64" loading="lazy">` : `<div class="avatar" aria-hidden="true">${esc(cfg.mentorName.split(" ").map((w) => w[0]).join("").slice(0, 2))}</div>`}<div><span class="author-k">লিখেছেন ও যাচাই করেছেন</span><b>${esc(cfg.mentorName)}</b><span>${esc(cfg.mentorTitle)}</span><p>${esc(cfg.mentorBio)}</p><a href="${root}about/">আমাদের কথা পড়ুন</a></div></div>`;
const ICON = {
  wa: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.7.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.4-.3z"/></svg>',
  share: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  bell: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0"/></svg>',
  plane: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 3L3 10.5l6.5 2.5M21 3l-4.5 17-7-7M21 3L9.5 13v6l3.2-3.8"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  filter: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
  flame: '<svg class="flame" viewBox="0 0 24 24" aria-hidden="true"><path class="fm-o" d="M12 2.5c.6 3.2 3 4.9 4.6 7.3 1.2 1.8 1.9 3.6 1.9 5.4A6.5 6.5 0 0 1 12 21.7a6.5 6.5 0 0 1-6.5-6.5c0-2.6 1.3-4.6 3-6.2.1 1.8.9 3.1 2.2 3.8C10.3 9.4 10.7 5.6 12 2.5z"/><path class="fm-i" d="M12 12.6c1.4 1.3 2.7 2.6 2.7 4.4a2.7 2.7 0 0 1-5.4 0c0-1.4.8-2.4 1.6-3.1.1.7.4 1.2.9 1.5.2-1 .2-1.9.2-2.8z"/></svg>',
};
const shareRow = (url, title) => {
  const u = encodeURIComponent(url), t = encodeURIComponent(title);
  return `<div class="share"><b>খবরটা শেয়ার করুন</b><div class="share-btns"><a class="s-wa" href="https://wa.me/?text=${t}%20${u}" target="_blank" rel="noopener">${ICON.wa}WhatsApp</a><button type="button" class="s-native" data-share-title="${esc(title)}" data-share-url="${esc(url)}" hidden>${ICON.share}শেয়ার</button><a href="https://t.me/share/url?url=${u}&amp;text=${t}" target="_blank" rel="noopener">Telegram</a><a href="https://www.facebook.com/sharer/sharer.php?u=${u}" target="_blank" rel="noopener">Facebook</a><button type="button" data-copy="${esc(url)}">লিংক কপি</button></div></div>`;
};

// খবরের ধরন + সময় + ভারতে চালু + দাম
const tlabel = (p) => `<span class="tl t-${p.type}">${esc(typeLabel(p.type))}</span>`;
// সময়: পাতায় লেখা থাকে তারিখ; site.js সেটাকে "আজ / গতকাল / ৩ দিন আগে" করে, আর data-nb থাকলে "নতুন" ছাপ বসায়
const when = (p, nb = true) => `<time datetime="${p.date}" data-rel="d"${nb ? " data-nb" : ""}>${bnDate(p.date)}</time>`;
const kicker = (p) => `<div class="kicker">${tlabel(p)}${when(p)}</div>`;
const badges = (p) => {
  const b = [];
  if (p.india) b.push(`<li class="b-in b-${p.india}">${INDIA[p.india]}</li>`);
  if (p.price) b.push(`<li class="b-pr b-${p.price}">${PRICE[p.price]}</li>`);
  return b.length ? `<ul class="badges" aria-label="এক নজরে">${b.join("")}</ul>` : "";
};
const dataAttrs = (p) => `data-t="${p.type}" data-a="${p.aud.join(" ")}" data-i="${p.india || ""}" data-p="${p.price || ""}"`;
const photoTag = (p, root, attrs) => p.photo ? `<img src="${root}${esc(p.photo)}" alt="${esc(p.photo_alt || p.title)}" width="${p.photoSize[0]}" height="${p.photoSize[1]}" ${attrs}>` : "";
// টুলের লোগোর ছোট টালি: ছবি না থাকা খবরেও চোখে পড়ার মতো একটা চিহ্ন থাকে
const tile = (t, root, size = 28) => `<span class="lt" aria-hidden="true">${t ? toolIcon(t, root, size) : "<i>AI</i>"}</span>`;
const alertCls = (p) => (p.type === "scam-alert" ? " is-alert" : "");

// তালিকার একটা খবর (ধরনের পাতা, খোঁজা, পুরনো খবর)
const story = (p, root) => `<article class="story${alertCls(p)}" ${dataAttrs(p)}><a href="${root}posts/${p.slug}/">${p.photo ? `<div class="story-pic">${photoTag(p, root, 'loading="lazy" decoding="async"')}</div>` : tile(p.tools[0], root)}<div class="story-tx">${kicker(p)}<h3>${esc(p.title)}</h3><p>${esc(p.excerpt)}</p>${badges(p)}</div></a></article>`;
const storyList = (items, root, id = "") =>
  items.length ? `<div class="feed"${id ? ` id="${id}"` : ""}>${items.map((p) => story(p, root)).join("\n")}</div>` : `<div class="feed"${id ? ` id="${id}"` : ""}><p class="empty">এই ধরনের খবর এখনও আসেনি। নতুন খবর এলেই এখানে দেখাবে।</p></div>`;

// ---- প্রথম পাতার টুকরো ----
// ছবি না থাকলে প্রধান খবরের পাশে খবরের কাগজের "এক নজরে" তথ্যের ঘর: টুলের লোগো আর ৩টা তথ্য (বানানো সংখ্যা নয়, পোস্টের quick_facts)
const leadCard = (p, root) => {
  const t = primaryTool(p), facts = p.quick_facts.filter((f) => !/^টুল$/.test(nf(f.label))).slice(0, 3);
  if (!t || facts.length < 2) return "";
  return `<div class="lead-card"><span class="lc-logo">${toolIcon(t, root, 40)}<b>${esc(t.name)}</b></span><dl>${facts.map((f) => `<div><dt>${esc(f.label)}</dt><dd>${esc(head(f.value) || f.value)}</dd></div>`).join("")}</dl></div>`;
};
const leadStory = (p, root) => `<article class="lead${alertCls(p)}" ${dataAttrs(p)}><a href="${root}posts/${p.slug}/"><div class="kicker"><b class="lead-k">প্রধান খবর</b>${tlabel(p)}${when(p)}</div><h2>${esc(p.title)}</h2>${p.photo ? `<figure class="lead-pic">${photoTag(p, root, 'fetchpriority="high" decoding="async"')}</figure>` : leadCard(p, root)}<p class="dek">${esc(p.excerpt)}</p>${p.key_points.length ? `<ul class="lead-points">${p.key_points.slice(0, 3).map((k) => `<li>${esc(k)}</li>`).join("")}</ul>` : ""}<div class="lead-f">${p.tools.length ? `<span class="lead-tools">${p.tools.slice(0, 3).map((t) => toolChip(t, root, false)).join("")}</span>` : ""}${badges(p)}<span class="read">পুরো খবর পড়ুন${ICON.arrow}</span></div></a></article>`;
const secStory = (p, root) => `<article class="sec${alertCls(p)}" ${dataAttrs(p)}><a href="${root}posts/${p.slug}/">${tile(p.tools[0], root)}<div>${kicker(p)}<h3>${esc(p.title)}</h3><p>${esc(p.excerpt)}</p></div></a></article>`;
const top5 = (root, items, id = "top5-h") => items.length ? `<section class="top5" aria-labelledby="${id}"><h2 class="rule-h" id="${id}">আজকের সেরা ৫</h2><ol>${items.map((p, i) => `<li><a href="${root}posts/${p.slug}/"><i aria-hidden="true">${bnNum(i + 1)}</i><span class="t5-tx"><b>${esc(p.title)}</b><span class="t5-m">${tlabel(p)}${when(p, false)}</span></span></a></li>`).join("")}</ol></section>` : "";
const digest = (root) => `<section class="digest" aria-labelledby="dg-h" data-digest><h2 id="dg-h">আজ ২ মিনিটে</h2><p class="dg-k">সর্বশেষ ${bnNum(Math.min(5, posts.length))}টি খবরের মূল কথা, এক লাইনে</p><ul>${posts.slice(0, 5).map((p) => `<li><a href="${root}posts/${p.slug}/">${esc(p.key_points[0] || p.excerpt)}</a></li>`).join("")}</ul></section>`;

// AI ফ্ল্যাশের একটা খবর। site.js-এর flashEl() ঠিক এই গঠনই বানায়
const flashLi = (f, root, full) => {
  const href = f.slug ? `${root}posts/${f.slug}/` : `${full ? "" : `${root}flash/`}#f-${f.id}`;
  const tm = f.slug ? `<time datetime="${f.date}" data-rel="d" data-nb>${bnDate(f.date)}</time>` : `<time datetime="${f.time}" data-rel="t" data-nb>${bnTime(f.time)}</time>`;
  const chips = [f.tool && `<li class="c-tool">${esc(f.tool)}</li>`, f.india && `<li class="b-${f.india}">${INDIA_S[f.india]}</li>`, f.price && `<li class="b-${f.price}">${PRICE[f.price]}</li>`].filter(Boolean).join("");
  return `<li class="fl${f.slug ? " fl-p" : ""}${f.imp >= 3 ? " fl-brk" : ""}"${full && f.id ? ` id="f-${f.id}"` : ""}><a href="${href}"><span class="fl-m">${tm}${f.imp >= 3 ? '<b class="brk">ব্রেকিং</b>' : ""}${f.type ? `<span class="tl t-${f.type}">${esc(typeLabel(f.type))}</span>` : ""}</span><b class="fl-h">${esc(f.title)}</b>${f.body ? `<p>${esc(f.body)}</p>` : ""}${chips ? `<ul class="fl-c">${chips}</ul>` : ""}</a></li>`;
};
const TL_JSON = esc(JSON.stringify(Object.fromEntries(TYPES.map((t) => [t.key, t.label]))));
// n = কটা দেখাবে (০ = সব); fb = ফ্ল্যাশ না থাকলে যে খবরগুলো থেকে বানানো হবে
const flashList = (root, n, fb, full = false) => {
  // ফ্ল্যাশ কম থাকলে বাকি জায়গা সর্বশেষ খবর দিয়ে ভরা হয় (fl-p), যাতে কলাম কখনও ফাঁকা না থাকে
  const live = n ? LIVE.slice(0, n) : LIVE;
  const items = [...live, ...fb.slice(0, Math.max(0, (n || 8) - live.length)).map(fromPost)];
  return `<ol class="flash${full ? " flash-full" : ""}" data-flash="${n}"${full ? " data-full" : ""} data-tl="${TL_JSON}">${items.map((f) => flashLi(f, root, full)).join("")}</ol>`;
};
const flashBox = (root, n, fb, cls = "") => `<section class="flashbox${cls}" aria-labelledby="fx-h"><header class="fx-h"><h2 id="fx-h"><i class="live-dot" aria-hidden="true"></i><a href="${root}flash/">AI ফ্ল্যাশ</a></h2><span class="fx-upd" data-flash-upd>ছোট খবর, সবার আগে</span></header>${flashList(root, n, fb)}<footer class="fx-f"><a href="${esc(TG)}" target="_blank" rel="noopener">${ICON.plane}সব ফ্ল্যাশ Telegram-এ</a><a href="${root}flash/">সব ফ্ল্যাশ দেখুন</a></footer></section>`;

// ---- AI বাজার: যে টুলে সম্প্রতি খবর এসেছে তার বোর্ড ----
const BCAT = { chat: "চ্যাট", image: "ছবি", video: "ভিডিও", voice: "ভয়েস", code: "কোডিং", auto: "অটোমেশন", write: "লেখা", design: "ডিজাইন", other: "অন্যান্য" };
const primaryTool = (p) => p.tools.find((t) => t.re.test(p.title)) || p.tools[0];
const BZ = (() => {
  const m = new Map();
  for (const p of posts) {
    const t = primaryTool(p);
    if (!t) continue;
    if (!m.has(t.key)) m.set(t.key, { t, p, n: 0 });
    if (NOW - Date.parse(p.date) < 30 * 864e5) m.get(t.key).n++;
  }
  return [...m.values()];
})();
const shortLine = (s, max = 8) => { const w = String(s).trim().split(/\s+/); return w.length > max ? w.slice(0, max).join(" ").replace(/[,:;।?!-]+$/, "") + "…" : w.join(" "); };
const bzRow = ({ t, p, n }, root, i, limit) => `<tr data-c="${t.cat}" data-d="${p.date}" data-n="${n}" data-name="${esc(t.name.toLowerCase())}"${limit && i >= limit ? ' class="bz-x"' : ""}><th scope="row"><a class="bz-tool" href="${root}tool/${t.key}/">${tile(t, root, 24)}<span><b>${esc(t.name)}</b><small>${esc(BCAT[t.cat] || "")}</small></span></a></th><td class="bz-chg"><a href="${root}posts/${p.slug}/">${esc(shortLine(p.card_headline || p.title))}</a></td><td class="bz-type">${tlabel(p)}</td><td class="bz-in">${p.india ? `<span class="st st-${p.india}">${INDIA_S[p.india].replace("ভারতে ", "")}</span>` : '<span class="st st-na">জানা নেই</span>'}</td><td class="bz-pr">${p.price ? `<span class="st st-${p.price}">${PRICE[p.price]}</span>` : '<span class="st st-na">জানা নেই</span>'}</td><td class="bz-n"><span class="bars" aria-hidden="true">${"<i class=\"on\"></i>".repeat(Math.min(5, n))}${"<i></i>".repeat(5 - Math.min(5, n))}</span><b>${bnNum(n)}</b></td><td class="bz-when">${when(p)}</td></tr>`;
const sortBtn = (k, label, cur = false) => `<button type="button" data-sort="${k}"${cur ? ' class="on"' : ""}>${label}</button>`;
const bazar = (root, { limit = 0, head = true } = {}) => {
  if (!BZ.length) return "";
  const cats = Object.keys(BCAT).filter((c) => BZ.some((r) => r.t.cat === c));
  return `<section class="bazar" data-bazar="${limit}" aria-labelledby="bz-h">${head ? `<header class="bz-head"><div><h2 id="bz-h"><a href="${root}bazar/">AI বাজার</a></h2><p>কোন টুলে কী বদলাল, ভারতে চালু কি না, খরচ কত: এক বোর্ডে</p></div><p class="bz-stamp"><i class="live-dot" aria-hidden="true"></i>শেষ বদল ${when(BZ[0].p, false)}</p></header>` : `<h2 class="vh" id="bz-h">টুলের আপডেট বোর্ড</h2>`}
<div class="bz-tabs" role="group" aria-label="টুলের বিভাগ"><button type="button" data-bcat="" aria-pressed="true">সব</button>${cats.map((c) => `<button type="button" data-bcat="${c}" aria-pressed="false">${BCAT[c]}</button>`).join("")}</div>
<div class="bz-wrap"><table class="bz-t"><thead><tr><th scope="col" aria-sort="none">${sortBtn("name", "টুল")}</th><th scope="col">সর্বশেষ বদল</th><th scope="col">ধরন</th><th scope="col">ভারতে</th><th scope="col">খরচ</th><th scope="col" aria-sort="none">${sortBtn("n", "৩০ দিনে খবর")}</th><th scope="col" aria-sort="descending">${sortBtn("d", "কবে", true)}</th></tr></thead><tbody>${BZ.map((r, i) => bzRow(r, root, i, limit)).join("")}</tbody></table></div>
<p class="bz-empty" hidden>এই বিভাগের টুলে এখন নতুন খবর নেই।</p>
${limit && BZ.length > limit ? `<p class="bz-more"><a href="${root}bazar/">পুরো বোর্ড দেখুন: ${bnNum(BZ.length)}টি টুল${ICON.arrow}</a></p>` : ""}</section>`;
};

// ---- বিভাগের ব্লক: ১টা বড় খবর + ৩টা শিরোনাম ----
const blockOf = (id, label, href, items, root, cls = "") => items.length ? `<section class="blk${cls}" aria-labelledby="blk-${id}"><header class="blk-h"><h2 id="blk-${id}"><a href="${href}">${esc(label)}</a></h2><a class="blk-all" href="${href}" aria-label="${esc(label)}: সব খবর দেখুন">সব দেখুন</a></header><article class="feat"><a href="${root}posts/${items[0].slug}/">${items[0].photo ? `<div class="feat-pic">${photoTag(items[0], root, 'loading="lazy" decoding="async"')}</div>` : ""}<div class="kicker">${when(items[0])}</div><h3>${esc(items[0].title)}</h3><p>${esc(items[0].excerpt)}</p>${badges(items[0])}</a></article>${items.length > 1 ? `<ol class="heads">${items.slice(1, 4).map((p) => `<li><a href="${root}posts/${p.slug}/">${tile(p.tools[0], root, 20)}<span><b>${esc(p.title)}</b>${when(p)}</span></a></li>`).join("")}</ol>` : ""}</section>` : "";

// খবরের ধরনের সারি: কাগজের বিভাগের মতো, পাতার মাথায় আটকে থাকে
const secBar = (root, active, { filter = false } = {}) => {
  const a = (key, href, label, cls = "", extra = "") => `<a class="sn${cls}${active === key ? " on" : ""}" href="${href}"${active === key ? ' aria-current="page"' : ""}${extra}>${label}</a>`;
  return `<div class="secnav"><div class="wrap secnav-in"><nav class="sn-row" aria-label="খবরের বিভাগ">${a("", root, "প্রথম পাতা")}${a("quiz", `${root}quiz/`, `${ICON.flame}কুইজ`, " sn-quiz")}${a("flash", `${root}flash/`, '<i class="live-dot" aria-hidden="true"></i>AI ফ্ল্যাশ')}${a("bazar", `${root}bazar/`, "AI বাজার")}${TYPES.filter((t) => typeCount(t.key) || active === t.key).map((t) => a(t.key, `${root}type/${t.key}/`, esc(t.label), ` t-${t.key}`)).join("")}${a("tools", `${root}tools/`, "AI টুল")}${a("-", ug(cfg.freeClassUrl, "nav"), "ফ্রি ক্লাস", " sn-cta", ' target="_blank" rel="noopener"')}</nav>${filter ? `<button type="button" class="who-chip" data-sheet="fsheet" data-who aria-haspopup="dialog">আপনি কে?</button><button type="button" class="filter-btn" data-sheet="fsheet" aria-haspopup="dialog">${ICON.filter}<span>ফিল্টার</span><i data-fcount hidden></i></button>` : ""}</div></div>`;
};
// চলমান শিরোনাম: ব্রেকিং ফ্ল্যাশ আগে, তারপর সর্বশেষ খবর। দ্বিতীয় তালিকাটা শুধু চোখের জন্য (থামা ছাড়া ঘোরাতে)
const tkItems = (root, hid) => [...BRK.map((b) => `<li class="tk-brk"><a href="${root}flash/#f-${b.id}"${hid}><b>ব্রেকিং</b>${esc(b.title)}</a></li>`), ...posts.slice(0, 8).map((p) => `<li><a href="${root}posts/${p.slug}/"${hid}><i>${esc(typeLabel(p.type))}</i>${esc(p.card_headline || p.title)}</a></li>`)].join("");
const ticker = (root) => posts.length ? `<div class="ticker" role="region" aria-label="সর্বশেষ শিরোনাম"><div class="wrap tk-in"><b class="tk-live"><i class="live-dot" aria-hidden="true"></i>লাইভ</b><div class="tk-view"><div class="tk-track" data-ticker><ul>${tkItems(root, "")}</ul><ul aria-hidden="true">${tkItems(root, ' tabindex="-1"')}</ul></div></div><button type="button" class="tk-pause" data-tk-pause aria-pressed="false" aria-label="শিরোনামের চলা থামান"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path class="i-pause" d="M7 5h3.500v14H7zM13.500 5H17v14h-3.500z"/><path class="i-play" d="M8 5l11 7-11 7z"/></svg></button></div></div>` : "";

const radioGroup = (name, legend, opts) => `<fieldset><legend>${legend}</legend><div class="opts">${[["", "সব"], ...opts].map(([v, l], i) => `<label><input type="radio" name="${name}" value="${v}"${i ? "" : " checked"}><span>${esc(l)}</span></label>`).join("")}</div></fieldset>`;
const filterSheet = () => `<div class="sheet" id="fsheet" role="dialog" aria-modal="true" aria-labelledby="fsheet-h" hidden><div class="sheet-bg" data-close></div><form class="sheet-panel" id="fform"><div class="sheet-head"><h2 id="fsheet-h">ফিল্টার</h2><button type="button" class="x" data-close aria-label="বন্ধ করুন">×</button></div>
${radioGroup("aud", "আপনি কে? বেছে নিলে আপনার কাজের খবর আগে দেখাব", Object.entries(AUD))}
${radioGroup("india", "ভারতে", [["available", "চালু"], ["soon", "শীঘ্রই"], ["no", "এখনও নেই"]])}
${radioGroup("price", "খরচ", Object.entries(PRICE))}
<p class="sheet-note">যে খবরে এই তথ্য নেই, সেটা ভারত বা খরচের ফিল্টারে বাদ যায়। কাদের জন্য, তা না লেখা থাকলে খবরটা সবার জন্য ধরা হয়।</p>
<div class="sheet-foot"><button type="reset" class="btn-line">সব মুছুন</button><button type="submit" class="btn">খবর দেখুন</button></div></form></div>`;
const pushSheet = () => `<div class="sheet" id="psheet" role="dialog" aria-modal="true" aria-labelledby="psheet-h" hidden><div class="sheet-bg" data-close></div><form class="sheet-panel" id="pform"><div class="sheet-head"><h2 id="psheet-h">নোটিফিকেশন</h2><button type="button" class="x" data-close aria-label="বন্ধ করুন">×</button></div>
<fieldset><legend>কোন খবর এলে জানাব? সর্বোচ্চ ৫টা বেছে নিন</legend><div class="opts">${TYPES.map((t, i) => `<label><input type="checkbox" name="topic" value="${t.key}"${["new-tool", "free-offer", "scam-alert"].includes(t.key) ? " checked" : ""}><span>${esc(t.label)}</span></label>`).join("")}</div></fieldset>
<p class="sheet-note" data-push-msg role="status" aria-live="polite">দিনে খুব বেশি নোটিফিকেশন পাঠানো হয় না। যেকোনো সময় বন্ধ করতে পারবেন।</p>
<div class="sheet-foot"><button type="button" class="btn-line" data-push-off hidden>বন্ধ করুন</button><button type="submit" class="btn" data-push-on>নোটিফিকেশন চালু করুন</button></div></form></div>`;
const installCard = (root) => `<div class="install" id="install" role="dialog" aria-labelledby="install-h" hidden><img src="${root}assets/app/icon-192.png" alt="" width="48" height="48"><div class="install-tx"><b id="install-h">AI পত্রিকা ফোনে রাখুন</b><p data-std>অ্যাপের মতো এক ট্যাপে খুলবে। নেট না থাকলেও আগে খোলা খবর পড়া যাবে।</p><p data-ios hidden>Safari-র নিচের Share বোতামে ট্যাপ করে "Add to Home Screen" বেছে নিন।</p></div><div class="install-act"><button type="button" class="btn" data-install>ইনস্টল করুন</button><button type="button" class="btn-text" data-install-x>এখন নয়</button></div></div>`;

const wordmark = (root) => `<a class="brand" href="${root}" aria-label="${esc(cfg.siteName)}, প্রথম পাতা"><img src="${root}assets/app/icon-192.png" alt="" width="40" height="40"><span class="wordmark"><b><small>Unique</small> AI পত্রিকা</b><em>${esc(cfg.motto)}</em></span></a>`;
// নোটিফিকেশনের বোতাম: ব্রাউজারে push না থাকলে একই বোতাম Telegram চ্যানেলে নিয়ে যায়
const pushCta = (cls, label = "নোটিফিকেশন চালু করুন") => `<a class="${cls}" href="${esc(TG)}" target="_blank" rel="noopener" data-push-cta data-alt="Telegram-এ রোজ খবর পান">${ICON.bell}<span>${label}</span></a>`;
const tgBtn = (cls, label = "Telegram-এ জয়েন করুন") => `<a class="${cls}" href="${esc(TG)}" target="_blank" rel="noopener" data-tg>${ICON.plane}<span>${label}</span></a>`;

// ---- কাগজের ভেতরের বিজ্ঞপ্তি: ফ্রি ক্লাস, নোটিফিকেশন ----
// ৪ দিনের ফ্রি ক্লাস: কাগজের "বিজ্ঞপ্তি"-র মতো একটা ঘর। wide = প্রথম পাতার চওড়া সংস্করণ
const klass = (root, medium, wide) => `<aside class="notice${wide ? " notice-wide" : ""}" aria-labelledby="notice-h"><p class="notice-k">বিজ্ঞপ্তি</p><div class="notice-b"><h2 id="notice-h">${wide ? "৪ দিনের ফ্রি AI ক্লাস, পুরোটা বাংলায়" : esc(cfg.learnTitle)}</h2><p>${esc(cfg.learnText)}</p><dl class="notice-f"><div><dt>সময়</dt><dd>৪ দিন</dd></div><div><dt>ফি</dt><dd>₹০</dd></div><div><dt>ভাষা</dt><dd>বাংলা</dd></div><div><dt>ধরন</dt><dd>হাতে-কলমে</dd></div></dl></div><div class="notice-a">${hasMentor ? `<img src="${root}assets/mentor.webp" alt="" width="48" height="48" loading="lazy">` : ""}<p><b>${esc(cfg.mentorName)}</b><span>${esc(cfg.mentorTitle)}</span></p><a class="btn" href="${ug(cfg.freeClassUrl, medium)}" target="_blank" rel="noopener">ফ্রি ক্লাসে নাম লেখান${ICON.arrow}</a></div></aside>`;
const joinCard = () => `<aside class="join"><div><h2>বড় খবর এলেই জানতে চান?</h2><p>দিনে খুব বেশি নয়, আর যখন খুশি বন্ধ করা যায়।</p></div><div class="join-act">${pushCta("btn")}${tgBtn("btn-line")}</div></aside>`;
const pushStrip = () => `<div class="pstrip" data-pstrip><div class="wrap pstrip-in">${pushCta("pstrip-a", "নোটিফিকেশন চালু করুন")}<span class="pstrip-t">বড় খবর মিস করবেন না</span><button type="button" class="x" data-pstrip-x aria-label="এই সারিটা বন্ধ করুন">×</button></div></div>`;

// ---- রোজের অভ্যাস: আজকের AI প্রশ্ন, আজকের প্রম্পট, ৫০টা প্রম্পট, লিড ফর্ম ----
const P50G = P50.groups;
const P50OPEN = P50G.flatMap((g) => P50.prompts.filter((x) => x.aud === g.key).slice(0, 2));
const P50REST = P50G.map((g) => [g, P50.prompts.filter((x) => x.aud === g.key).slice(2)]);
const PTD = P50OPEN[Math.floor((NOW + 198e5) / 864e5) % P50OPEN.length];
const ptdSteps = (x) => ["নিচের বোতামে ট্যাপ করে প্রম্পটটা কপি করুন", `${x.tool.split(/[ (,]/)[0]} খুলুন (ফোনের অ্যাপে বা ব্রাউজারে) আর পেস্ট করুন`, "[ ] বন্ধনীর জায়গায় নিজের তথ্য বসিয়ে পাঠান"];
// প্রথম পাতায় কার্ড ফিডের ডাক (ফোনে বড়, ডেস্কটপে সরু)
const appCta = (root) => `<a class="appcta" href="${root}app/?src=home"><span class="ac-ic" aria-hidden="true"><i></i><i></i><i></i></span><span class="ac-tx"><b>আজকের খবর কার্ডে পড়ুন</b><span>এক স্ক্রিনে এক খবর, উপরে টানলেই পরেরটা</span></span><span class="ac-go">খুলুন${ICON.arrow}</span></a>`;
const qstrip = (root, card = false) => `<a class="qstrip${card ? " qcard" : ""}" href="${root}quiz/" data-qstrip><span class="qs-ic">${ICON.flame}</span><span class="qs-tx"><b>${card ? "আজকের AI প্রশ্ন খেলুন" : "আজকের AI প্রশ্ন"}</b><span data-qs-t>${card ? "আজকের খবর থেকে ৫টা প্রশ্ন, ১ মিনিটে। রোজ খেলে স্ট্রিক বাড়ান।" : "৫টা প্রশ্ন · ১ মিনিট"}</span></span><span class="qs-go" data-qs-go>খেলুন</span></a>`;
const ptdCard = (root, compact) => `<section class="ptd${compact ? " ptd-c" : ""}" aria-labelledby="ptd-h" data-ptd data-copyroot><header class="ptd-h"><h2 id="ptd-h">${compact ? `<a href="${root}prompt/">আজকের প্রম্পট</a>` : "আজকের প্রম্পট"}</h2><span class="ptd-tool"><span class="vh">কোন টুলে: </span><span data-pt-tool>${esc(PTD.tool)}</span></span></header><p class="ptd-t" data-pt-title>${esc(PTD.title)}</p>${compact ? "" : `<p class="ptd-why" data-pt-why>${esc(PTD.tip || P50G.find((g) => g.key === PTD.aud)?.lead || "")}</p>`}<p class="ptd-p" data-copytext>${esc(PTD.prompt)}</p><div class="ptd-f"><button type="button" class="btn ptd-copy" data-dcopy>প্রম্পট কপি করুন</button><details class="ptd-steps"${compact ? "" : " open"}><summary>কীভাবে ব্যবহার করবেন</summary><ol data-pt-steps>${ptdSteps(PTD).map((x) => `<li>${esc(x)}</li>`).join("")}</ol><p class="ptd-for" data-pt-for>কাদের জন্য: ${esc(AUD[PTD.aud] || "")}</p></details></div></section>`;
const DISTRICTS = ["কলকাতা", "উত্তর ২৪ পরগনা", "দক্ষিণ ২৪ পরগনা", "হাওড়া", "হুগলি", "নদিয়া", "পূর্ব বর্ধমান", "পশ্চিম বর্ধমান", "বীরভূম", "বাঁকুড়া", "পুরুলিয়া", "পূর্ব মেদিনীপুর", "পশ্চিম মেদিনীপুর", "ঝাড়গ্রাম", "মুর্শিদাবাদ", "মালদা", "উত্তর দিনাজপুর", "দক্ষিণ দিনাজপুর", "জলপাইগুড়ি", "আলিপুরদুয়ার", "কোচবিহার", "দার্জিলিং", "কালিম্পং", "পশ্চিমবঙ্গের বাইরে"];
const CONSENT = "আমার নাম-নম্বর Unique AI পত্রিকা ও Unique Gurukul আমাকে AI শেখার খবর ও ফ্রি ক্লাসের তথ্য পাঠাতে ব্যবহার করতে পারে। যেকোনো সময় বন্ধ করা যাবে।";
const leadForm = (root, src, label, soft = false) => `<form class="lf" data-lead="${src}"${soft ? " data-soft" : ""} novalidate>
<div class="lf-f"><label for="lf-n-${src}">আপনার নাম</label><input id="lf-n-${src}" name="name" autocomplete="name" maxlength="60" required></div>
<div class="lf-f"><label for="lf-p-${src}">মোবাইল নম্বর</label><div class="lf-ph"><span aria-hidden="true">+৯১</span><input id="lf-p-${src}" name="phone" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="16" required placeholder="১০ অঙ্কের নম্বর"></div></div>
<fieldset class="lf-who"><legend>আপনি কে?</legend><div class="lf-chips">${Object.entries(AUD).map(([k, v]) => `<label><input type="radio" name="persona" value="${k}"><span>${esc(v)}</span></label>`).join("")}</div></fieldset>
<div class="lf-f"><label for="lf-d-${src}">জেলা <small>(না দিলেও চলবে)</small></label><select id="lf-d-${src}" name="district"><option value="">বেছে নিন</option>${DISTRICTS.map((d) => `<option>${d}</option>`).join("")}</select></div>
<label class="lf-ok"><input type="checkbox" name="consent" required><span>${CONSENT}</span></label>
<p class="lf-err" role="alert" hidden></p>
<button type="submit" class="btn lf-go">${label}</button>
<p class="lf-note">নম্বর যাচাইয়ের জন্য OTP লাগে না। কী রাখা হয়, পড়ুন <a href="${root}privacy/#lead">গোপনীয়তা নীতিতে</a>।</p>
</form>`;
const press = () => `<div class="press" aria-hidden="true"><p class="press-word">AI পত্রিকা</p></div>`;
const CONNECT = [...new Set([cfg.supabaseUrl || cfg.pushApi, DAILY].filter(Boolean).map((u) => new URL(u).origin))].join(" ");
const CSP = `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data: blob:; font-src 'self'; connect-src 'self' ${CONNECT}; manifest-src 'self'; worker-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'`;

function layout({ root, title, description, canonical, ogImage, ogType = "website", jsonLd = [], body, extraHead = "", noindex = false, kind = "page", active = "-", filter = false, preload = "", quiz = false }) {
  const img = abs(ogImage || "assets/og-default.png");
  const ld = [{ "@context": "https://schema.org", "@graph": [ORG, PUB, ...jsonLd] }];
  const news = ["home", "list", "article"].includes(kind);
  return `<!doctype html>
<html lang="bn">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description.length > 160 ? description.slice(0, 157).replace(/\s+\S*$/, "") + "…" : description)}">
<meta name="robots" content="${noindex ? "noindex, follow" : "index, follow, max-image-preview:large, max-snippet:-1"}">
<link rel="canonical" href="${esc(canonical)}">
${cfg.googleSiteVerification ? `<meta name="google-site-verification" content="${esc(cfg.googleSiteVerification)}">` : ""}
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="${esc(cfg.siteName)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="bn_IN">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(img)}">
<meta name="theme-color" content="#5D16E9">
<meta name="color-scheme" content="light">
<meta name="application-name" content="${esc(cfg.shortName || cfg.siteName)}">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="${esc(cfg.shortName || cfg.siteName)}">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
${extraHead}
<link rel="manifest" href="${root}manifest.webmanifest">
<link rel="alternate" type="application/rss+xml" title="${esc(cfg.siteName)}" href="${root}feed.xml">
<link rel="icon" href="${root}assets/app/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="${root}assets/app/icon-192.png" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="${root}assets/app/apple-touch-icon.png">
<link rel="preload" href="${root}assets/fonts/anek-bangla-bengali-800-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${root}assets/fonts/hind-siliguri-bengali-400-normal.woff2" as="font" type="font/woff2" crossorigin>
${preload}<link rel="stylesheet" href="${root}assets/style.css?v=${VER}">
${ld.map((x) => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, "\\u003c")}</script>`).join("\n")}
</head>
<body class="k-${kind}" data-root="${root}" data-v="${VER}" data-sb="${esc(cfg.supabaseUrl || "")}" data-sbk="${esc(cfg.supabaseKey || "")}" data-free="${esc(host(cfg.freeClassUrl))}" data-main="${esc(host(cfg.mainSiteUrl))}" data-push="${cfg.pushEnabled ? 1 : 0}" data-push-api="${esc(cfg.pushApi || "")}" data-briefs="${esc(cfg.briefsApi || "")}" data-daily="${esc(DAILY)}">
<a class="skip" href="#main">মূল লেখায় যান</a>
${kind === "article" ? '<div class="progress" aria-hidden="true"><i></i></div>' : ""}
<div class="util"><div class="wrap util-in"><span class="u-date" data-today>${dparts(NOW, true)}</span><span class="u-ed">অনলাইন সংস্করণ</span><span class="u-clock" data-clockbox hidden><i class="live-dot" aria-hidden="true"></i><b data-clock></b><small>ভারতীয় সময়</small></span><nav class="u-links" aria-label="প্রধান মেনু"><a href="${root}about/">আমাদের কথা</a><a href="${root}our-tools/">আমাদের টুল</a><a href="${esc(TG)}" target="_blank" rel="noopener">Telegram</a></nav></div></div>
<header class="mast"><div class="wrap mast-in">${wordmark(root)}<span class="mast-act"><a class="streak-b" href="${root}quiz/" data-streak hidden>${ICON.flame}<b></b></a><a class="icon-btn" href="${root}search/" aria-label="খবর খুঁজুন">${ICON.search}</a><button class="icon-btn" type="button" data-sheet="psheet" data-push-open hidden aria-label="নোটিফিকেশন">${ICON.bell}</button><a class="mast-cta" href="${ug(cfg.freeClassUrl, "nav")}" target="_blank" rel="noopener">৪ দিনের ফ্রি ক্লাস</a></span></div></header>
${secBar(root, active, { filter })}
${kind === "offline" ? "" : ticker(root)}
${news ? pushStrip() : ""}
<main id="main">
${body}
</main>
<footer class="foot"><div class="wrap foot-in">
<div class="foot-brand">${wordmark(root)}<p>${esc(cfg.footerAbout)}</p><p class="foot-links"><a href="${esc(TG)}" target="_blank" rel="noopener">Telegram চ্যানেল</a><a href="${ug(cfg.freeClassUrl, "footer")}" target="_blank" rel="noopener">৪ দিনের ফ্রি ক্লাস</a></p></div>
<nav class="foot-col" aria-label="খবরের ধরন"><b>খবরের ধরন</b>${TYPES.map((t) => `<a href="${root}type/${t.key}/">${esc(t.label)}</a>`).join("")}</nav>
<nav class="foot-col" aria-label="রোজের কাজ"><b>রোজের কাজ</b><a href="${root}quiz/">আজকের AI প্রশ্ন</a><a href="${root}prompt/">আজকের প্রম্পট</a><a href="${root}prompts-50/">৫০টা কাজের AI প্রম্পট</a></nav>
<nav class="foot-col" aria-label="নিউজরুম"><b>নিউজরুম</b><a href="${root}flash/">AI ফ্ল্যাশ</a><a href="${root}bazar/">AI বাজার</a><a href="${root}tools/">সব AI টুলের তালিকা</a>${Object.entries(cfg.categories).map(([k, v]) => `<a href="${root}category/${k}/">${esc(v)}</a>`).join("")}<a href="${root}our-tools/">Unique Gurukul-এর টুল</a></nav>
<nav class="foot-col" aria-label="পত্রিকা"><b>পত্রিকা</b><a href="${root}about/">আমাদের কথা</a><a href="${root}contact/">যোগাযোগ</a><a href="${root}privacy/">গোপনীয়তা নীতি</a><a href="${root}terms/">শর্ত ও দাবিত্যাগ</a><a href="${root}feed.xml">RSS ফিড</a></nav>
</div>${press()}<div class="foot-pub"><div class="wrap"><p><a href="${ug(cfg.mainSiteUrl, "footer")}">${esc(cfg.brand)}</a>-এর একটি উদ্যোগ</p><p>© ${bnNum(new Date().getFullYear()).replace(/,/g, "")} ${esc(cfg.brand)}। সব অধিকার সংরক্ষিত।</p></div></div></footer>
${kind === "article" ? `<div class="abar" id="abar" hidden><a class="abar-wa" href="https://wa.me/?text=${encodeURIComponent(title.split(" | ")[0])}%20${encodeURIComponent(canonical)}" target="_blank" rel="noopener">${ICON.wa}<span>WhatsApp শেয়ার</span></a>${pushCta("abar-push", "নোটিফিকেশন")}<button type="button" class="x" data-abar-x aria-label="বন্ধ করুন">×</button></div>` : ""}
${filter ? filterSheet() : ""}
${pushSheet()}
${installCard(root)}
<script src="${root}assets/site.js?v=${VER}" defer></script>
<script src="${root}assets/daily.js?v=${VER}" defer></script>${quiz ? `\n<script src="${root}assets/quiz.js?v=${VER}" defer></script>` : ""}
</body>
</html>`;
}

function pager(root, page, pages) {
  if (pages <= 1) return "";
  const href = (n) => (n === 1 ? root : `${root}page/${n}/`);
  return `<nav class="pager" aria-label="পাতা">${page > 1 ? `<a href="${href(page - 1)}">নতুন খবর</a>` : "<span></span>"}<span>পাতা ${bnNum(page)} / ${bnNum(pages)}</span>${page < pages ? `<a href="${href(page + 1)}">পুরনো খবর</a>` : "<span></span>"}</nav>`;
}

function write(path, content) {
  const full = join(OUT, path);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content);
}

// ---- build ----
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "assets"), { recursive: true });
cpSync("assets", join(OUT, "assets"), { recursive: true });
// site.js: মন্তব্যের লাইন আর সারির শুরুর ফাঁকা জায়গা বাদ দিয়ে পাঠানো হয় (ফাইলটা ছোট হয়, কোড একই থাকে)
writeFileSync(join(OUT, "assets/site.js"), JS.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("//")).join("\n") + "\n");
writeFileSync(join(OUT, "assets/style.css"), CSS);
writeFileSync(join(OUT, "assets/app.css"), ACSS);
for (const [f, src] of [["daily.js", DJS], ["quiz.js", QJS], ["app.js", AJS]]) writeFileSync(join(OUT, "assets", f), src.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("//")).join("\n") + "\n");
writeFileSync(join(OUT, ".nojekyll"), "");
if (existsSync("CNAME")) cpSync("CNAME", join(OUT, "CNAME"));
// public/: ভেতরের সব ফাইল হুবহু dist-এর গোড়ায় যায় (.well-known-এর মতো ডট-ফোল্ডার সহ)
if (existsSync("public")) cpSync("public", OUT, { recursive: true, filter: (src) => !/(^|[\\/])\.gitkeep$/.test(src) });

const feedHead = (title) => `<div class="feed-head"><h2 class="rule-h" id="feed-title" data-default="${esc(title)}">${esc(title)}</h2><span class="feed-count" data-feed-count aria-live="polite"></span><button type="button" class="btn-text" data-clear hidden>ফিল্টার মুছুন</button></div>`;
const pageHead = (kicker, h1, lead, extra = "") => `<section class="page-head"><div class="wrap">${kicker ? `<p class="page-k">${kicker}</p>` : ""}<h1>${h1}</h1>${lead ? `<p>${lead}</p>` : ""}${extra}</div></section>`;

// প্রথম পাতার বাছাই: ১টা প্রধান + ২টা পাশের খবর, আর "সেরা ৫" (শেষ ৮ দিনের, প্রতি ধরন থেকে আগে একটা করে)
const FRONT = posts.slice(0, 3);
const TOP5 = (() => {
  const rest = posts.slice(9);
  const week = rest.filter((p) => NOW - Date.parse(p.date) < 8 * 864e5);
  const pool = week.length >= 5 ? week : rest;
  const out = [], seenT = new Set();
  for (const p of pool) if (!seenT.has(p.type)) { seenT.add(p.type); out.push(p); }
  for (const p of pool) if (out.length < 5 && !out.includes(p)) out.push(p);
  return out.slice(0, 5).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
})();
const top5Ld = { "@type": "ItemList", name: "আজকের সেরা ৫ AI খবর", itemListOrder: "https://schema.org/ItemListOrderAscending", numberOfItems: TOP5.length, itemListElement: TOP5.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}/posts/${p.slug}/`, name: p.title })) };
// পাশের কলাম (ধরনের পাতা, ফ্ল্যাশ, পুরনো খবর)
const sideRail = (root, fb, flash = true) => `<aside class="rail" aria-label="আরও খবর">${flash ? flashBox(root, 5, fb) : ""}${top5(root, TOP5)}</aside>`;

// home + pagination
const HEAD = 9; // প্রথম পাতার মাথার খবর বাদ দিয়ে বাকিগুলো "আগের খবর" আর পরের পাতায়
const pages = Math.max(1, Math.ceil(Math.max(0, posts.length - HEAD) / PER_PAGE));
const pinned = posts.filter((p) => p.pinned);
// বিভাগের ব্লকে প্রথম পাতার মাথার খবরগুলো আবার না আসে, যদি যথেষ্ট অন্য খবর থাকে
// প্রতিটা খবর প্রথম পাতার ব্লকে একবারই আসে, যাতে পাতাটা একই শিরোনামের পুনরাবৃত্তি না লাগে
const fresh = (items, used, min = 2) => { const x = items.filter((p) => !used.has(p)).slice(0, 4); if (x.length < min) return []; x.forEach((p) => used.add(p)); return x; };
for (let page = 1; page <= pages; page++) {
  const root = page === 1 ? "./" : "../../";
  const rest = posts.slice(HEAD + (page - 1) * PER_PAGE, HEAD + page * PER_PAGE);
  const url = page === 1 ? `${SITE}/` : `${SITE}/page/${page}/`;
  const lead = posts[0];
  const leadPic = page === 1 && lead?.photo ? `<link rel="preload" as="image" href="${root}${esc(lead.photo)}" fetchpriority="high">\n` : "";
  const used = new Set([...posts.slice(0, HEAD), ...TOP5]);
  const typeBlocks = TYPES.filter((t) => t.key !== "scam-alert" && typeCount(t.key)).map((t) => blockOf(t.key, t.label, `${root}type/${t.key}/`, fresh(posts.filter((p) => p.type === t.key), used, 1), root));
  const alerts = posts.filter((p) => p.type === "scam-alert");
  const catBlocks = Object.keys(TCATS).map((k) => [k, postsOfCat(k)]).filter((x) => x[1].length >= 2).sort((a, b) => (a[1][0].date < b[1][0].date ? 1 : -1)).map(([k, items]) => blockOf(`c-${k}`, TCATS[k].name, `${root}tools/${k}/`, fresh(items, used, 3), root)).filter(Boolean).slice(0, 3);
  write(
    page === 1 ? "index.html" : `page/${page}/index.html`,
    layout({
      root,
      kind: page === 1 ? "home" : "list",
      active: page === 1 ? "" : "-",
      filter: true,
      preload: leadPic,
      title: page === 1 ? `${cfg.siteName} | ${cfg.tagline}` : `${cfg.siteName} | পাতা ${bnNum(page)}`,
      description: cfg.description,
      canonical: url,
      jsonLd: page === 1 ? [
        { "@type": "WebSite", "@id": `${SITE}/#website`, name: cfg.siteName, alternateName: cfg.shortName, url: `${SITE}/`, inLanguage: "bn", description: cfg.description, publisher: { "@id": PUB["@id"] }, potentialAction: { "@type": "SearchAction", target: `${SITE}/search/?q={search_term_string}`, "query-input": "required name=search_term_string" } },
        { "@type": "FAQPage", mainEntity: cfg.homeFaq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
        { "@type": "ItemList", name: "সর্বশেষ খবর", itemListElement: posts.slice(0, 10).map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}/posts/${p.slug}/`, name: p.title })) },
        top5Ld,
      ] : [],
      body: page === 1 ? `<h1 class="vh">${esc(cfg.siteName)}: ${esc(cfg.tagline)}</h1>
<div class="wrap paper" id="fwrap" hidden><div class="paper-main">${feedHead("বাছাই করা খবর")}<div class="feed" id="feed"></div><div class="feed-more" data-more hidden><button type="button" class="btn-line">আরও খবর দেখুন</button></div></div></div>
<div id="front">
${pinned.length ? `<div class="wrap">${pinned.map((p) => `<a class="alert-bar" href="./posts/${p.slug}/"><b>সতর্কতা</b><span>${esc(p.title)}</span></a>`).join("")}</div>` : ""}
<div class="wrap">${appCta(root)}${qstrip(root)}</div>
<div class="wrap fp">
${lead ? leadStory(lead, root) : ""}
${flashBox(root, 6, posts.slice(HEAD, HEAD + 6), " fp-flash")}
<div class="secs">${posts.slice(1, 3).map((p) => secStory(p, root)).join("")}</div>
${posts.length > 3 ? `<section class="fp-more" aria-labelledby="more-h"><h2 class="rule-h" id="more-h">আরও শিরোনাম</h2><ol>${posts.slice(3, HEAD).map((p) => `<li><a href="${root}posts/${p.slug}/"><b>${esc(p.title)}</b><span class="t5-m">${tlabel(p)}${when(p)}</span></a></li>`).join("")}</ol></section>` : ""}
<aside class="fp-r" aria-label="আজকের প্রম্পট, সেরা খবর ও সারাংশ">${ptdCard(root, true)}${top5(root, TOP5)}${digest(root)}</aside>
</div>
<div class="wrap">${bazar(root, { limit: 8 })}</div>
${alerts.length ? `<div class="wrap">${blockOf("scam-alert", "সতর্কতা ডেস্ক", `${root}type/scam-alert/`, alerts, root, " blk-alert")}</div>` : ""}
<div class="wrap blks">${typeBlocks.join("")}</div>
<div class="wrap">${klass(root, "home-class", true)}</div>
${catBlocks.length ? `<div class="wrap"><h2 class="band-h">কাজ ধরে খবর</h2></div><div class="wrap blks blks-b">${catBlocks.join("")}</div>` : ""}
${rest.length ? `<section class="wrap arch" aria-labelledby="arch-h"><header class="blk-h"><h2 id="arch-h">আগের খবর</h2>${pages > 1 ? `<a class="blk-all" href="./page/2/">আরও পুরনো খবর</a>` : ""}</header><ol class="arch-l">${rest.map((p) => `<li><a href="./posts/${p.slug}/">${when(p, false)}<b>${esc(p.title)}</b>${tlabel(p)}</a></li>`).join("")}</ol></section>` : ""}
<section class="seo-block"><div class="wrap seo-in"><div class="prose">${utmHtml(cfg.homeSeoHtml, "home-about")}</div>
<div><div class="tool-cloud"><h2>টুল অনুযায়ী খবর</h2><div class="tools-row">${TOOLS.map((t) => [t, postsOfTool(t).length]).filter((x) => x[1]).sort((a, b) => b[1] - a[1]).slice(0, 18).map((x) => toolChip(x[0], root)).join("") || "<span>শিগগিরই আসছে</span>"}</div><a class="rail-more" href="${root}tools/">সব AI টুলের তালিকা</a></div>
<section class="faq"><h2>সাধারণ প্রশ্ন</h2>${cfg.homeFaq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</section></div></div></section>
</div>` : `${pageHead(`<a href="${root}">প্রথম পাতা</a>`, "পুরনো খবর", `পাতা ${bnNum(page)} / ${bnNum(pages)}`)}
<div class="wrap paper"><div class="paper-main">${feedHead(`পুরনো খবর, পাতা ${bnNum(page)}`)}${storyList(rest, root, "feed")}<div class="feed-more" data-more hidden><button type="button" class="btn-line">আরও খবর দেখুন</button></div>${pager(root, page, pages)}</div>
${sideRail(root, posts.slice(0, 5))}</div>`,
    })
  );
}

// খবরের ধরনের পাতা: /type/<key>/
for (const t of TYPES) {
  const items = posts.filter((p) => p.type === t.key);
  const url = `${SITE}/type/${t.key}/`;
  write(
    `type/${t.key}/index.html`,
    layout({
      root: "../../",
      kind: "list",
      active: t.key,
      filter: true,
      title: `${t.label}: AI-এর খবর বাংলায় | ${cfg.siteName}`,
      description: `${t.text} ${cfg.siteName}-এ সহজ বাংলায়।`,
      canonical: url,
      noindex: !items.length,
      jsonLd: [crumbs([["হোম", `${SITE}/`], [t.label, url]]), { "@type": "CollectionPage", name: `${t.label}: AI-এর খবর`, url, inLanguage: "bn", isPartOf: { "@id": `${SITE}/#website` }, ...(items.length ? { mainEntity: { "@type": "ItemList", itemListElement: items.slice(0, 20).map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}/posts/${p.slug}/` })) } } : {}) }],
      body: `${pageHead(`<a href="../../">প্রথম পাতা</a><span aria-hidden="true"> / </span>খবরের ধরন`, esc(t.label), esc(t.text), `<p class="page-count">${bnNum(items.length)}টি খবর</p>`)}
<div class="wrap paper"><div class="paper-main">${feedHead(`${t.label}: সব খবর`)}${storyList(items, "../../", "feed")}<div class="feed-more" data-more hidden><button type="button" class="btn-line">আরও খবর দেখুন</button></div></div>
${sideRail("../../", posts.slice(0, 5))}</div>`,
    })
  );
}

// categories (পুরনো ঠিকানা, আগের মতোই চালু)
for (const [k, v] of Object.entries(cfg.categories)) {
  const items = posts.filter((p) => p.category === k);
  const desc = `${v} বিষয়ে ${cfg.siteName}-এর সব খবর ও গাইড, সহজ বাংলায়। ${cfg.categoryText?.[k] || ""}`.trim();
  write(
    `category/${k}/index.html`,
    layout({
      root: "../../",
      kind: "list",
      filter: true,
      noindex: !items.length,
      title: `${v}: খবর ও গাইড | ${cfg.siteName}`,
      description: desc,
      canonical: `${SITE}/category/${k}/`,
      jsonLd: [crumbs([["হোম", `${SITE}/`], [v, `${SITE}/category/${k}/`]]), { "@type": "CollectionPage", name: v, url: `${SITE}/category/${k}/`, inLanguage: "bn" }],
      body: `${pageHead(`<a href="../../">প্রথম পাতা</a><span aria-hidden="true"> / </span>বিষয়`, esc(v), esc(cfg.categoryText?.[k] || `${v} বিষয়ে সব খবর এক জায়গায়।`), `<p class="page-count">${bnNum(items.length)}টি খবর</p>`)}
<div class="wrap paper"><div class="paper-main">${feedHead(`${v}: সব খবর`)}${storyList(items, "../../", "feed")}<div class="feed-more" data-more hidden><button type="button" class="btn-line">আরও খবর দেখুন</button></div></div>
${sideRail("../../", posts.slice(0, 5))}</div>`,
    })
  );
}

// AI বাজার: /bazar/
if (BZ.length) write(
  "bazar/index.html",
  layout({
    root: "../",
    kind: "list",
    active: "bazar",
    title: `AI টুলের আজকের আপডেট বোর্ড: কোন টুলে কী বদলাল | ${cfg.shortName}`,
    description: `${BZ.slice(0, 5).map((r) => r.t.name).join(", ")} সহ ${bnNum(BZ.length)}টি AI টুলের সর্বশেষ বদল এক বোর্ডে: কী এল, ভারতে চালু কি না, ফ্রি না পেইড, আর কবে। সহজ বাংলায়।`,
    canonical: `${SITE}/bazar/`,
    jsonLd: [crumbs([["হোম", `${SITE}/`], ["AI বাজার", `${SITE}/bazar/`]]), { "@type": "CollectionPage", name: "AI বাজার: AI টুলের আপডেট বোর্ড", url: `${SITE}/bazar/`, inLanguage: "bn", isPartOf: { "@id": `${SITE}/#website` }, dateModified: isoDate(BZ[0].p.date), mainEntity: { "@type": "ItemList", numberOfItems: BZ.length, itemListElement: BZ.slice(0, 30).map((r, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}/posts/${r.p.slug}/`, name: `${r.t.name}: ${r.p.card_headline || r.p.title}` })) } }],
    body: `${pageHead(`<a href="../">প্রথম পাতা</a><span aria-hidden="true"> / </span>AI বাজার`, "AI টুলের আজকের আপডেট বোর্ড", "শেয়ার বাজারের বোর্ডের মতো, তবে AI টুলের। কোন টুলে সর্বশেষ কী বদলাল, ভারতে চালু কি না, খরচ কত আর খবরটা কবেকার, এক নজরে।", `<p class="page-count">${bnNum(BZ.length)}টি টুল, শেষ বদল ${when(BZ[0].p, false)}</p>`)}
<div class="wrap bazar-page">${bazar("../", { head: false })}
<div class="bz-note prose"><h2>বোর্ডটা কীভাবে পড়বেন</h2><ul><li><strong>সর্বশেষ বদল:</strong> ওই টুল নিয়ে আমাদের সবচেয়ে নতুন খবরের শিরোনাম। ট্যাপ করলে পুরো খবর খুলবে।</li><li><strong>ভারতে:</strong> খবর প্রকাশের দিন টুলটা ভারতে চালু ছিল কি না। সূত্রে বলা না থাকলে "জানা নেই"।</li><li><strong>খরচ:</strong> ফ্রি, আংশিক ফ্রি না পেইড। টাকা খরচের আগে টুলের নিজের সাইটে একবার মিলিয়ে নিন।</li><li><strong>৩০ দিনে খবর:</strong> গত ৩০ দিনে ওই টুল নিয়ে পত্রিকায় কটা খবর বেরিয়েছে।</li></ul><p>সব টুলের পরিচয় বিভাগ ধরে দেখতে চাইলে <a href="../tools/">AI টুলের তালিকা</a> খুলুন।</p></div>
${klass("../", "bazar-class", true)}</div>`,
  })
);

// AI ফ্ল্যাশ: /flash/ (গত ৪৮ ঘণ্টার ছোট খবর; ফ্ল্যাশ না থাকলে সর্বশেষ খবর)
{
  const fb = posts.slice(0, 12);
  const list = LIVE.length ? LIVE.map((b) => ({ url: `${SITE}/flash/#f-${b.id}`, name: b.title })) : fb.map((p) => ({ url: `${SITE}/posts/${p.slug}/`, name: p.title }));
  write(
    "flash/index.html",
    layout({
      root: "../",
      kind: "list",
      active: "flash",
      title: `AI ফ্ল্যাশ: গত ৪৮ ঘণ্টার ছোট AI খবর বাংলায় | ${cfg.shortName}`,
      description: "AI জগতে গত ৪৮ ঘণ্টায় যা যা ঘটল, দুই-তিন লাইনে: নতুন টুল, আপডেট, ফ্রি অফার আর সতর্কতা। সময় ধরে সাজানো, সহজ বাংলায়।",
      canonical: `${SITE}/flash/`,
      jsonLd: [crumbs([["হোম", `${SITE}/`], ["AI ফ্ল্যাশ", `${SITE}/flash/`]]), { "@type": "CollectionPage", name: "AI ফ্ল্যাশ: ছোট AI খবর", url: `${SITE}/flash/`, inLanguage: "bn", isPartOf: { "@id": `${SITE}/#website` }, mainEntity: { "@type": "ItemList", numberOfItems: list.length, itemListElement: list.slice(0, 30).map((x, i) => ({ "@type": "ListItem", position: i + 1, ...x })) } }],
      body: `${pageHead(`<a href="../">প্রথম পাতা</a><span aria-hidden="true"> / </span>AI ফ্ল্যাশ`, "AI ফ্ল্যাশ: গত ৪৮ ঘণ্টার ছোট খবর", "বড় খবরের ফাঁকে ফাঁকে যা ঘটছে, দুই-তিন লাইনে। নতুনটা সবার উপরে, পাতা খোলা রাখলে নিজে থেকেই তাজা হয়।", `<p class="page-count"><i class="live-dot" aria-hidden="true"></i><span data-flash-upd>${LIVE.length ? `${bnNum(LIVE.length)}টি ফ্ল্যাশ` : "সর্বশেষ খবর থেকে"}</span></p>`)}
<div class="wrap paper"><div class="paper-main">${flashList("../", 0, fb, true)}
<p class="flash-tg"><a class="btn-line" href="${esc(TG)}" target="_blank" rel="noopener">${ICON.plane}সব ফ্ল্যাশ Telegram-এ পান</a></p></div>
${sideRail("../", fb, false)}</div>`,
    })
  );
}

// posts
posts.forEach((p, idx) => {
  const root = "../../";
  const url = `${SITE}/posts/${p.slug}/`;
  const others = posts.filter((x) => x.slug !== p.slug);
  const related = [...others.filter((x) => x.type === p.type), ...others.filter((x) => x.type !== p.type && x.category === p.category), ...others].filter((x, i, a) => a.indexOf(x) === i).slice(0, 3);
  const next = posts[idx + 1] || posts[0];
  let n = 0;
  const heads = [];
  const bodyHtml = p.body_html.replace(/<h2>([\s\S]*?)<\/h2>/g, (m, t) => { n++; heads.push(text(t)); return `<h2 id="s${n}">${t}</h2>`; });
  // blockquote: মেন্টরের মতামত আলাদা বাক্সে, বাকি সব কপি করার মতো প্রম্পট
  const richBody = bodyHtml.replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, (m, inner) => {
    const mentor = inner.match(/^\s*(?:<p>)?\s*<strong>মেন্টরের মতামত[^<]*<\/strong>\s*/);
    if (mentor) return `<aside class="mentor-note">${hasMentor ? `<img src="${root}assets/mentor.webp" alt="${esc(cfg.mentorName)}" width="48" height="48" loading="lazy">` : ""}<div><b>মেন্টরের মতামত</b><span>${esc(cfg.mentorName)}, ${esc(cfg.mentorTitle)}</span><p>${inner.replace(mentor[0], "").replace(/<\/?p>/g, " ").trim()}</p></div></aside>`;
    return `<div class="pbox"><span class="pbox-k">প্রম্পট: কপি করে ব্যবহার করুন</span><q>${inner.replace(/<\/?p>/g, " ").trim()}</q><button type="button" data-copy="${esc(text(inner))}">প্রম্পট কপি করুন</button></div>`;
  });
  const toc = heads.length >= 4 ? `<details class="toc" open><summary>এই খবরে যা আছে</summary><ol>${heads.map((h, i) => `<li><a href="#s${i + 1}">${esc(h)}</a></li>`).join("")}</ol></details>` : "";
  write(
    `posts/${p.slug}/index.html`,
    layout({
      root,
      kind: "article",
      active: p.type,
      preload: p.photo ? `<link rel="preload" as="image" href="${root}${esc(p.photo)}" fetchpriority="high">\n` : "",
      title: ((t) => (t.length + cfg.shortName.length + 3 <= 62 ? `${t} | ${cfg.shortName}` : t))(p.meta_title || p.title),
      description: p.meta_description,
      canonical: url,
      ogImage: p.photo || p.cover || undefined,
      ogType: "article",
      noindex: text(p.body_html).split(" ").length < 150,
      extraHead: `<meta property="article:published_time" content="${isoDate(p.date)}">\n<meta property="article:section" content="${esc(typeLabel(p.type))}">${p.tags.map((t) => `\n<meta property="article:tag" content="${esc(t)}">`).join("")}`,
      jsonLd: [
        crumbs([["হোম", `${SITE}/`], [typeLabel(p.type), `${SITE}/type/${p.type}/`], [p.title, url]]),
        {
          "@type": "NewsArticle",
          headline: p.title.slice(0, 110),
          description: p.meta_description,
          datePublished: isoDate(p.date),
          dateModified: isoDate(p.updated || p.date),
          inLanguage: "bn",
          mainEntityOfPage: url,
          articleSection: typeLabel(p.type),
          keywords: p.tags.join(", "),
          wordCount: text(p.body_html).split(" ").length,
          image: [...(p.photo ? [abs(p.photo)] : []), abs(p.cover || "assets/og-default.png")],
          author: { "@type": "Person", name: cfg.mentorName, jobTitle: cfg.mentorTitle, url: `${SITE}/about/`, worksFor: { "@id": ORG["@id"] } },
          publisher: { "@id": PUB["@id"] },
          isAccessibleForFree: true,
        },
        ...(p.faq.length ? [{ "@type": "FAQPage", mainEntity: p.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }] : []),
      ],
      body: `<div class="wrap a-grid"><article class="article${alertCls(p)}" data-slug="${p.slug}">
<header class="a-head">
<p class="a-kick"><a class="tl t-${p.type}" href="${root}type/${p.type}/">${esc(typeLabel(p.type))}</a></p>
<h1>${esc(p.title)}</h1>
<p class="dek">${esc(p.excerpt)}</p>
<div class="dateline"><p><b>${esc(cfg.siteName)} ডেস্ক</b><span>কলকাতা সময় <time datetime="${p.date}" data-rel="d" data-keep data-nb>${bnDate(p.date)}</time></span><span>${bnNum(p.minutes)} মিনিটে পড়া</span></p><button type="button" class="s-native icon-share" data-share-title="${esc(p.title)}" data-share-url="${esc(url)}" hidden aria-label="খবরটা শেয়ার করুন">${ICON.share}</button></div>
${p.india || p.price || p.aud.length ? `<div class="a-badges">${badges(p)}${p.aud.length ? `<p class="a-aud"><span>কাদের জন্য:</span>${p.aud.map((a) => `<b>${esc(AUD[a])}</b>`).join("")}</p>` : ""}</div>` : ""}
</header>
${p.photo ? `<figure class="a-photo">${photoTag(p, root, 'fetchpriority="high" decoding="async"')}</figure>` : ""}
<div class="a-body">
${p.key_points.length ? `<section class="glance"><h2>সংক্ষেপে</h2><ul>${p.key_points.map((k) => `<li>${esc(k)}</li>`).join("")}</ul></section>` : ""}
${p.quick_facts.length ? `<dl class="facts">${p.quick_facts.map((f) => `<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join("")}</dl>` : ""}
${p.tools.length ? `<div class="tools-row tools-top"><span>এই খবরে:</span>${p.tools.map((t) => toolChip(t, root)).join("")}</div>` : ""}
${toc}
<div class="prose">${utmHtml(richBody, "article-body")}</div>
${p.faq.length ? `<section class="faq"><h2>সাধারণ প্রশ্ন</h2>${p.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</section>` : ""}
${qstrip(root, true)}
${klass(root, "article-class", false)}
${shareRow(url, p.title)}
${p.tags.length ? `<ul class="tags" aria-label="ট্যাগ">${p.tags.map((t) => `<li>#${esc(t)}</li>`).join("")}</ul>` : ""}
${authorBox(root)}
${next && next !== p ? `<nav class="next" aria-label="পরের খবর"><a href="${root}posts/${next.slug}/"><span class="next-k">পরের খবর${ICON.arrow}</span>${kicker(next)}<b>${esc(next.title)}</b><p>${esc(next.excerpt)}</p></a></nav>` : ""}
${joinCard()}
</div>
</article>
<aside class="a-rail" aria-label="আরও খবর">${flashBox(root, 5, others.slice(0, 5))}${top5(root, [...TOP5.filter((x) => x !== p), ...FRONT.filter((x) => x !== p)].slice(0, 5))}</aside></div>
${related.length ? `<section class="related"><div class="wrap"><h2 class="rule-h">আরও পড়ুন</h2>${storyList(related, root)}</div></section>` : ""}`,
    })
  );
});

// tool pages (শুধু যে টুলের অন্তত একটা পোস্ট আছে)
const toolPages = [];
for (const t of TOOLS) {
  const items = posts.filter((p) => p.tools.includes(t));
  if (!items.length) continue;
  toolPages.push({ key: t.key, lastmod: items[0].date });
  const desc = `${t.desc ? t.desc + " " : ""}${t.name}-এর নতুন ফিচার, আপডেট আর ব্যবহারের গাইড সহজ বাংলায়, তারিখ ধরে এক জায়গায়।`;
  const tc = TCATS[t.cat];
  const sibs = toolsIn(t.cat).filter((x) => x !== t && postsOfTool(x).length).slice(0, 8);
  write(
    `tool/${t.key}/index.html`,
    layout({
      root: "../../",
      title: `${t.name} বাংলায়: খবর, নতুন ফিচার ও গাইড | ${cfg.shortName}`,
      description: desc,
      canonical: `${SITE}/tool/${t.key}/`,
      jsonLd: [crumbs([["হোম", `${SITE}/`], ...(tc ? [[tc.name, `${SITE}/tools/${t.cat}/`]] : []), [t.name, `${SITE}/tool/${t.key}/`]]), { "@type": "CollectionPage", name: `${t.name} বাংলায়`, url: `${SITE}/tool/${t.key}/`, inLanguage: "bn", about: { "@type": "SoftwareApplication", name: t.name } }],
      body: `${pageHead(tc ? `<a href="../../tools/">সব AI টুল</a><span aria-hidden="true"> / </span><a href="../../tools/${t.cat}/">${esc(tc.name)}</a>` : "টুল", `${esc(t.name)} বাংলায়`, esc(desc))}
<div class="wrap narrow">
<h2 class="sec-h">${esc(t.name)}-এর আপডেট, তারিখ ধরে</h2>${timeline(items, "../../")}
<h2 class="sec-h">${esc(t.name)} নিয়ে সব খবর</h2>${storyList(items, "../../")}
${sibs.length ? `<h2 class="sec-h">একই ধরনের আরও টুল</h2><div class="tools-row">${sibs.map((x) => toolChip(x, "../../")).join("")}</div>` : ""}</div>`,
    })
  );
}

// সব AI টুলের তালিকা + বিভাগের পাতা
const tcatKeys = Object.keys(TCATS).filter((k) => toolsIn(k).length);
if (tcatKeys.length) {
  write(
    "tools/index.html",
    layout({
      root: "../",
      title: `সব AI টুলের তালিকা বাংলায়: ছবি, ভিডিও, ভয়েস, কোডিং | ${cfg.shortName}`,
      description: `ছবি তৈরি, ভিডিও তৈরি, ভয়েস, অ্যাপ বানানো আর অটোমেশনের ${bnNum(TOOLS.length)}টি AI টুল বিভাগ ধরে, প্রতিটার পরিচয় আর নতুন আপডেট সহজ বাংলায়।`,
      canonical: `${SITE}/tools/`,
      jsonLd: [crumbs([["হোম", `${SITE}/`], ["সব AI টুল", `${SITE}/tools/`]]), { "@type": "CollectionPage", name: "সব AI টুলের তালিকা", url: `${SITE}/tools/`, inLanguage: "bn" }],
      body: `${pageHead("AI টুলের তালিকা", "সব AI টুল, কাজ অনুযায়ী", "কোন কাজের জন্য কোন AI টুল, এক জায়গায়। প্রতিটা টুলের এক লাইনের পরিচয়, আর নতুন ফিচার এলে তার খবর।")}
<div class="wrap narrow"><nav class="jump" aria-label="বিভাগে যান">${tcatKeys.map((k) => `<a href="#${k}">${esc(TCATS[k].name)}</a>`).join("")}</nav>
${tcatKeys.map((k) => `<section class="tsec" id="${k}"><div class="tsec-head"><h2 class="sec-h">${esc(TCATS[k].name)}</h2><a href="./${k}/">এই বিভাগের সব খবর</a></div><p class="muted">${esc(TCATS[k].text)}</p><div class="trows">${toolsIn(k).map((t) => toolRow(t, "../")).join("")}</div></section>`).join("")}</div>`,
    })
  );
  for (const k of tcatKeys) {
    const v = TCATS[k];
    const items = postsOfCat(k);
    write(
      `tools/${k}/index.html`,
      layout({
        root: "../../",
        title: `${v.name}: টুলের তালিকা ও নতুন আপডেট বাংলায় | ${cfg.shortName}`,
        description: `${v.text} ${toolsIn(k).slice(0, 5).map((t) => t.name).join(", ")} সহ ${bnNum(toolsIn(k).length)}টি টুলের পরিচয় আর নতুন আপডেট।`,
        canonical: `${SITE}/tools/${k}/`,
        jsonLd: [crumbs([["হোম", `${SITE}/`], ["সব AI টুল", `${SITE}/tools/`], [v.name, `${SITE}/tools/${k}/`]]), { "@type": "ItemList", name: v.name, itemListElement: toolsIn(k).map((t, i) => ({ "@type": "ListItem", position: i + 1, item: { "@type": "SoftwareApplication", name: t.name, description: t.desc || undefined, applicationCategory: v.name } })) }],
        body: `${pageHead(`<a href="../">সব AI টুল</a>`, esc(v.name), esc(v.text))}
<div class="wrap narrow">
<h2 class="sec-h">এই বিভাগের টুল</h2><div class="trows">${toolsIn(k).map((t) => toolRow(t, "../../")).join("")}</div>
<h2 class="sec-h">নতুন আপডেট</h2>${items.length ? timeline(items, "../../") + storyList(items.slice(0, 6), "../../") : `<p class="empty">এই বিভাগের টুলে নতুন কিছু এলেই এখানে তারিখ ধরে দেখাবে।</p>`}
<nav class="jump" aria-label="অন্য বিভাগ">${tcatKeys.filter((x) => x !== k).map((x) => `<a href="../${x}/">${esc(TCATS[x].name)}</a>`).join("")}</nav></div>`,
      })
    );
  }
}

// search + client data (ফিল্টার আর অফলাইন পাতা এটাই পড়ে)
write("search.json", JSON.stringify(posts.map((p) => ({ s: p.slug, t: p.title, e: p.excerpt, c: catName(p.category), y: p.type, l: typeLabel(p.type), a: p.aud, i: p.india || "", p: p.price || "", d: bnDate(p.date), dt: p.date, k: [...p.tags, ...p.tools.map((t) => t.name)].join(" "), ic: p.tools[0]?.icon || "", tn: p.tools[0]?.name[0] || "", ph: p.photo || "", w: p.photoSize?.[0] || 0, h: p.photoSize?.[1] || 0 }))));
write(
  "search/index.html",
  layout({
    root: "../",
    title: `খুঁজুন | ${cfg.siteName}`,
    description: `${cfg.siteName}-এর সব খবরের মধ্যে খুঁজুন।`,
    canonical: `${SITE}/search/`,
    noindex: true,
    body: `${pageHead("", "খবর খুঁজুন", "", `<form class="search-form" role="search" action="./" method="get"><input id="q" name="q" type="search" placeholder="যেমন: ChatGPT, ফ্রি, ভিডিও" autocomplete="off" aria-label="খোঁজার শব্দ লিখুন"></form>`)}
<div class="wrap narrow"><div id="results" class="feed" aria-live="polite"><p class="empty">উপরে খোঁজার শব্দ লিখুন।</p></div></div>`,
  })
);

// নিজস্ব টুলের পাতা
if (OWN.length) write(
  "our-tools/index.html",
  layout({
    root: "../",
    title: `${cfg.brand}-এর নিজস্ব AI টুল: বাংলায় AI টুলের তালিকা`,
    description: `${cfg.brand}-এর নিজস্ব AI টুল: ${OWN.map((t) => t.name).join(", ")} ও আরও অনেক। বাংলায় লিড খোঁজা, ব্র্যান্ডিং, ভয়েস, কনটেন্ট আর নোট বানানোর টুল।`,
    canonical: `${SITE}/our-tools/`,
    jsonLd: [crumbs([["হোম", `${SITE}/`], ["Unique Gurukul-এর AI টুল", `${SITE}/our-tools/`]]), { "@type": "ItemList", name: `${cfg.brand}-এর নিজস্ব AI টুল`, itemListElement: OWN.map((t, i) => ({ "@type": "ListItem", position: i + 1, item: { "@type": "SoftwareApplication", name: t.name, applicationCategory: "BusinessApplication", operatingSystem: "Web", url: t.url, description: t.desc, inLanguage: "bn", publisher: { "@id": ORG["@id"] } } })) }],
    body: `${pageHead(esc(cfg.brand), `${esc(cfg.brand)}-এর নিজস্ব AI টুল`, "পত্রিকার প্রকাশক Unique Gurukul নিজেও AI টুল বানায়। এই টুলগুলো বাংলাভাষীদের কাজের কথা ভেবে তৈরি।")}
${ownSection()}`,
  })
);

// about
write(
  "about/index.html",
  layout({
    root: "../",
    title: `আমাদের কথা | ${cfg.siteName}`,
    description: cfg.aboutDescription,
    canonical: `${SITE}/about/`,
    jsonLd: [crumbs([["হোম", `${SITE}/`], ["আমাদের কথা", `${SITE}/about/`]]), { "@type": "AboutPage", name: `${cfg.siteName} সম্পর্কে`, url: `${SITE}/about/`, inLanguage: "bn", about: { "@id": PUB["@id"] } }, { "@type": "Person", name: cfg.mentorName, jobTitle: cfg.mentorTitle, description: cfg.mentorBio, worksFor: { "@id": ORG["@id"] } }],
    body: `${pageHead("আমাদের কথা", `${esc(cfg.siteName)} ও ${esc(cfg.brand)}`, esc(cfg.aboutDescription))}
<article class="article"><div class="a-body">${existsSync("assets/mentor-about.webp") ? `<figure class="about-photo"><img src="../assets/mentor-about.webp" alt="${esc(cfg.mentorName)}, ${esc(cfg.mentorTitle)}" width="860" height="800" loading="lazy"><figcaption><b>${esc(cfg.mentorName)}</b>${esc(cfg.mentorTitle)}</figcaption></figure>` : ""}<div class="prose">${utmHtml(cfg.aboutHtml, "about")}</div>
<section class="diff"><h2>${esc(cfg.diff.title)}</h2><p class="muted">${esc(cfg.diff.lead)}</p>
<div class="diff-table" role="table"><div class="diff-row diff-head" role="row"><span role="columnheader"></span><span role="columnheader">সাধারণ AI কোর্স</span><span role="columnheader">${esc(cfg.brand)}</span></div>
${cfg.diff.rows.map((r) => `<div class="diff-row" role="row"><b role="cell">${esc(r[0])}</b><span role="cell" class="no">${esc(r[1])}</span><span role="cell" class="yes">${esc(r[2])}</span></div>`).join("")}</div></section>
${authorBox("../")}
${klass("../", "about-class", false)}</div></article>`,
  })
);

// গোপনীয়তা নীতি, যোগাযোগ, শর্তাবলি
const UPDATED = "২৩ নভেম্বর ২০২৬";
const infoPage = (slug, title, lead, html, type = "WebPage") => write(
  `${slug}/index.html`,
  layout({
    root: "../",
    title: `${title} | ${cfg.siteName}`,
    description: lead,
    canonical: `${SITE}/${slug}/`,
    jsonLd: [crumbs([["হোম", `${SITE}/`], [title, `${SITE}/${slug}/`]]), { "@type": type, name: title, url: `${SITE}/${slug}/`, inLanguage: "bn", publisher: { "@id": PUB["@id"] } }],
    body: `${pageHead(esc(cfg.siteName), esc(title), esc(lead))}
<article class="article"><div class="a-body"><div class="prose">${html}</div></div></article>`,
  })
);
const mail = `<a href="mailto:${esc(cfg.email)}">${esc(cfg.email)}</a>`;
infoPage("privacy", "গোপনীয়তা নীতি", `${cfg.siteName} আপনার সম্পর্কে কী তথ্য রাখে আর কী রাখে না, সহজ বাংলায়।`, `
<p>এই পাতায় বলা আছে ${esc(cfg.siteName)} (${esc(host(SITE))}) ব্যবহার করলে আপনার কোন তথ্য আমাদের কাছে আসে আর কোনটা আসে না। পত্রিকাটি ${esc(cfg.brand)}-এর একটি উদ্যোগ। শেষ হালনাগাদ: ${UPDATED}।</p>
<h2>সংক্ষেপে</h2>
<ul><li>পত্রিকা পড়তে অ্যাকাউন্ট খুলতে হয় না, নাম, ফোন নম্বর বা ইমেইল দিতে হয় না।</li><li>কুইজের সার্টিফিকেট বা ৫০টা প্রম্পট চাইলে তবেই নাম আর নম্বর চাওয়া হয়, আপনার সম্মতি নিয়ে।</li><li>পত্রিকা নিজে আপনার ব্রাউজারে কোনো কুকি বসায় না।</li><li>আমরা আপনার তথ্য কাউকে বিক্রি করি না।</li></ul>
<h2>আপনার ফোনেই যা থাকে</h2>
<p>কোন ফিল্টার রেখেছেন, কটা খবর পড়েছেন, কুইজের আগের ফল, এগুলো আপনার ফোন বা কম্পিউটারের ব্রাউজারে (localStorage) জমা থাকে। "আপনি কে?" প্রশ্নে যা বেছেছেন, সেটা নিচে বলা পাতা দেখার হিসেবের সাথে আমাদের কাছে আসে। নেট না থাকলেও যাতে আগে খোলা খবর পড়া যায়, সেজন্য পত্রিকার পাতা আর ছবি আপনার ব্রাউজারেই রেখে দেওয়া হয়। ব্রাউজারের সাইট ডেটা মুছে দিলে এসব মুছে যায়।</p>
<h2>নোটিফিকেশন</h2>
<p>আপনি নিজে "নোটিফিকেশন চালু করুন" বোতামে ট্যাপ করে অনুমতি দিলে তবেই নোটিফিকেশন আসে। তখন আপনার ব্রাউজার একটা ঠিকানা (subscription) তৈরি করে, যেটা আর আপনি কোন ধরনের খবর চেয়েছেন, শুধু সেটুকু আমাদের সার্ভারে (Supabase) জমা থাকে, যাতে খবর পাঠানো যায়। এতে আপনার নাম বা ফোন নম্বর থাকে না। নোটিফিকেশন বন্ধ করলে সেই ঠিকানা মুছে দেওয়া হয়।</p>
<h2 id="quiz">আজকের AI প্রশ্ন আর পাতা দেখার হিসেব</h2>
<p>প্রথমবার পত্রিকা খুললে আপনার ব্রাউজার একটা এলোমেলো নম্বর (ডিভাইস আইডি) তৈরি করে রাখে। এতে আপনার নাম বা ফোনের কোনো তথ্য থাকে না। কুইজের উত্তর, স্ট্রিক আর সার্টিফিকেট এই নম্বর ধরেই মেলানো হয়। প্রতিটা পাতা খুললে আমরা শুধু এটুকু জমা রাখি: কোন পাতা, কোন সাইট থেকে এলেন (শুধু সাইটের নাম, পুরো লিংক নয়), লিংকে utm চিহ্ন থাকলে সেটা, ডিভাইস আইডি আর "আপনি কে?" বাছাই। আপনার IP ঠিকানা জমা রাখা হয় না; অপব্যবহার আটকাতে শুধু তার একটা অপরিবর্তনীয় সংকেত (hash) কিছুক্ষণ ব্যবহার হয়। ব্রাউজারে "Do Not Track" চালু থাকলে utm আর "আপনি কে?" পাঠানো হয় না।</p>
<h2 id="lead">নাম আর ফোন নম্বর</h2>
<p>সার্টিফিকেট বা ৫০টা প্রম্পটের জন্য আপনি নিজে নাম, মোবাইল নম্বর, পরিচয় আর চাইলে জেলা দিলে, এবং সম্মতির ঘরে টিক দিলে তবেই সেগুলো আমাদের কাছে জমা হয়। এগুলো দিয়ে Unique AI পত্রিকা ও Unique Gurukul আপনাকে AI শেখার খবর আর ফ্রি ক্লাসের তথ্য পাঠাতে পারে। নম্বর যাচাই করা হয় না (OTP নেই)। সাপ্তাহিক সেরা তালিকায় শুধু আপনার নামের প্রথম অংশ আর জেলার আদ্যক্ষর দেখানো হয়। মেসেজ বন্ধ করতে বা তথ্য মুছে দিতে চাইলে ${mail} ঠিকানায় লিখুন।</p>
<h2>আমরা কী গুনে রাখি</h2>
<p>পত্রিকা থেকে কেউ Unique Gurukul-এর ফ্রি ক্লাস বা মূল ওয়েবসাইটের লিংকে ক্লিক করলে আমরা তিনটা জিনিস গুনে রাখি: কোন পাতা থেকে ক্লিক হল, কোন লিংকে, আর কখন। কে ক্লিক করলেন তা আমরা রাখি না। আপনার নাম, IP ঠিকানা বা ফোনের তথ্য এই হিসেবে থাকে না।</p>
<p>ওই লিংকগুলোর শেষে একটা ছোট চিহ্ন জোড়া থাকে (যেমন <strong>utm_source=patrika</strong>), যাতে আমাদের অন্য সাইট বুঝতে পারে আপনি পত্রিকা থেকে এসেছেন।</p>
<h2>যে পরিষেবাগুলো ব্যবহার করি</h2>
<ul><li><strong>GitHub Pages:</strong> পত্রিকার পাতাগুলো এখান থেকে আপনার কাছে পৌঁছয়। যেকোনো ওয়েবসাইটের মতো, পাতা পাঠানোর সময় তাদের সার্ভারে আপনার IP ঠিকানা সাময়িকভাবে ধরা পড়ে। এটা GitHub-এর নিজের নীতি অনুযায়ী চলে।</li><li><strong>Supabase:</strong> উপরে বলা ক্লিকের গোনাগুনতি, নোটিফিকেশনের ঠিকানা, কুইজের উত্তর, পাতা দেখার হিসেব আর আপনার দেওয়া নাম-নম্বর এখানে জমা থাকে।</li></ul>
<p>পত্রিকার ফন্ট, ছবি আর আইকন আমাদের নিজের জায়গা থেকেই আসে, বাইরের কোনো সাইট থেকে নয়।</p>
<h2>বিজ্ঞাপন</h2>
<p>এই মুহূর্তে পত্রিকায় বাইরের কোনো বিজ্ঞাপন নেই। ভবিষ্যতে Google AdSense-এর মতো বিজ্ঞাপন চালু হলে Google ও তার সহযোগীরা কুকি ব্যবহার করে আপনার আগ্রহ অনুযায়ী বিজ্ঞাপন দেখাতে পারে। তখন এই পাতায় তা পরিষ্কার করে জানানো হবে, আর আপনি Google-এর বিজ্ঞাপন সেটিংস থেকে তা বন্ধ করতে পারবেন।</p>
<h2>বাইরের লিংক</h2>
<p>লেখার ভেতর থেকে আপনি ${esc(host(cfg.mainSiteUrl))}, ${esc(host(cfg.freeClassUrl))} বা অন্য টুলের সাইটে যেতে পারেন। সেখানে ভর্তি বা পেমেন্টের সময় যে তথ্য দেন, তা ওই সাইটের নিজের নিয়মে চলে। আমাদের Telegram চ্যানেলে যোগ দিলে সেটা Telegram-এর নীতি অনুযায়ী চলে।</p>
<h2>শিশুদের জন্য</h2>
<p>এই পত্রিকা সাধারণ পাঠকের জন্য লেখা। আমরা জেনেশুনে কোনো শিশুর ব্যক্তিগত তথ্য সংগ্রহ করি না।</p>
<h2>নীতি বদলালে</h2>
<p>এই নীতিতে কিছু বদলালে এই পাতাতেই নতুন তারিখ সহ জানানো হবে।</p>
<h2>প্রশ্ন থাকলে</h2>
<p>গোপনীয়তা নিয়ে কিছু জানার থাকলে লিখুন: ${mail}। আরও উপায় <a href="../contact/">যোগাযোগের পাতায়</a>।</p>`);
infoPage("contact", "যোগাযোগ", `${cfg.siteName} আর ${cfg.brand}-এর সাথে যোগাযোগ করার সব উপায় এক জায়গায়।`, `
<p>কোনো খবর নিয়ে প্রশ্ন, ভুল ধরিয়ে দেওয়া, বা খবরের খোঁজ দিতে চাইলে নিচের যেকোনো উপায়ে যোগাযোগ করুন।</p>
<h2>ইমেইল</h2>
<p>${mail}<br>খবরে কোনো তথ্য ভুল মনে হলে খবরের লিংকটা সহ লিখুন, আমরা দেখে ঠিক করে দেব।</p>
<h2>Telegram</h2>
<p>AI-এর নতুন খবর আর আপডেট রোজ পেতে আমাদের চ্যানেলে যোগ দিন: <a href="${esc(TG)}" rel="noopener">${esc(host(TG))}</a></p>
<h2>কোর্স ও ভর্তি</h2>
<ul><li>৪ দিনের ফ্রি AI ক্লাস: <a href="${ug(cfg.freeClassUrl, "contact")}">${esc(host(cfg.freeClassUrl))}</a></li><li>সব কোর্স আর বিস্তারিত: <a href="${ug(cfg.mainSiteUrl, "contact")}">${esc(host(cfg.mainSiteUrl))}</a></li></ul>
<h2>আমরা কোথায়</h2>
<p>${esc(cfg.brand)}, ${esc(cfg.address?.locality || "")}, পশ্চিমবঙ্গ, ভারত। ২০১৭ সাল থেকে শেখাচ্ছি।</p>
<p><a href="../about/">আমাদের কথা</a>, <a href="../privacy/">গোপনীয়তা নীতি</a>, <a href="../terms/">শর্ত ও দাবিত্যাগ</a></p>`, "ContactPage");
infoPage("terms", "শর্ত ও দাবিত্যাগ", `${cfg.siteName}-এর খবর কীভাবে তৈরি হয়, আর তা ব্যবহারের নিয়ম।`, `
<p>শেষ হালনাগাদ: ${UPDATED}।</p>
<h2>লেখার উদ্দেশ্য</h2>
<p>এই পত্রিকার সব লেখা জানা আর শেখার জন্য। AI টুলের দাম, ফিচার আর কোন দেশে চালু, এগুলো প্রায়ই বদলায়। তাই কোনো টুলে টাকা খরচ করার আগে সেই টুলের নিজের ওয়েবসাইটে একবার মিলিয়ে নিন। "ভারতে চালু" বা "ফ্রি" চিহ্নগুলো খবর প্রকাশের দিনের তথ্য অনুযায়ী।</p>
<h2>আমরা কীভাবে লিখি</h2>
<p>খবর জোগাড় আর প্রথম খসড়া তৈরিতে আমরা AI টুলের সাহায্য নিই। প্রতিটা লেখা প্রকাশের আগে ${esc(cfg.brand)}-এর পক্ষ থেকে পড়ে অনুমোদন করা হয়। যা আমরা নিজে পরীক্ষা করিনি, তা পরীক্ষা করেছি বলে লিখি না।</p>
<h2>ভুল থাকলে</h2>
<p>যত্ন নিয়ে লিখলেও ভুল থেকে যেতে পারে। কোনো তথ্য ভুল মনে হলে ${mail} ঠিকানায় জানান, আমরা দেখে ঠিক করব।</p>
<h2>অন্য কোম্পানির নাম ও লোগো</h2>
<p>লেখায় যে টুল বা কোম্পানির নাম আর লোগো আসে (যেমন ChatGPT, Gemini), সেগুলো তাদের নিজ নিজ মালিকের সম্পত্তি। আমরা শুধু চেনানোর জন্য ব্যবহার করি। ওই কোম্পানিগুলোর সাথে ${esc(cfg.brand)}-এর কোনো ব্যবসায়িক সম্পর্ক নেই, আর তারা এই পত্রিকা অনুমোদন করেনি।</p>
<h2>আয়ের কথা</h2>
<p>"চাকরি ও আয়" ধরনের খবর সম্ভাবনা আর উপায় দেখায়। আয় নির্ভর করে আপনার পরিশ্রম, দক্ষতা আর বাজারের ওপর। আমরা কোনো নির্দিষ্ট আয়ের নিশ্চয়তা দিই না।</p>
<h2>লেখা ব্যবহার</h2>
<p>পত্রিকার লেখা আর ছবি ${esc(cfg.brand)}-এর। লিংক দিয়ে শেয়ার করতে পারেন। পুরো লেখা কপি করে অন্য কোথাও ছাপতে চাইলে আগে অনুমতি নিন।</p>
<p><a href="../privacy/">গোপনীয়তা নীতি</a>, <a href="../contact/">যোগাযোগ</a></p>`);


// ---- রোজের পাতা: /quiz/, /certificate/, /prompt/, /prompts-50/ ----
write(
  "quiz/index.html",
  layout({
    root: "../",
    kind: "quiz",
    active: "quiz",
    quiz: true,
    title: `আজকের AI প্রশ্ন: রোজ ৫টা প্রশ্ন, ১ মিনিট | ${cfg.siteName}`,
    description: "রোজ সকাল ৮টায় AI-এর খবর আর সাধারণ জ্ঞান থেকে ৫টা নতুন প্রশ্ন, বাংলায়। ১ মিনিটে খেলুন, সঙ্গে সঙ্গে ঠিক উত্তর আর ব্যাখ্যা, রোজ খেলে স্ট্রিক আর ৭ দিনে সার্টিফিকেট।",
    canonical: `${SITE}/quiz/`,
    jsonLd: [crumbs([["হোম", `${SITE}/`], ["আজকের AI প্রশ্ন", `${SITE}/quiz/`]]), { "@type": "WebPage", name: "আজকের AI প্রশ্ন", url: `${SITE}/quiz/`, inLanguage: "bn", description: "রোজ ৫টা নতুন প্রশ্ন: AI-এর খবর আর সাধারণ জ্ঞান, বাংলায়।", isPartOf: { "@id": `${SITE}/#website` }, publisher: { "@id": PUB["@id"] }, about: ["কৃত্রিম বুদ্ধিমত্তা", "সাধারণ জ্ঞান"] }],
    body: `<div class="wrap qz-wrap">
<section class="qz" data-quiz data-freeurl="${esc(cfg.freeClassUrl)}" aria-labelledby="qz-h">
<header class="qz-head"><h1 id="qz-h">আজকের AI প্রশ্ন</h1><p class="qz-sub"><span data-qdate>${dparts(NOW, true)}</span><span>৫টা প্রশ্ন, ১ মিনিট</span></p></header>
<div class="qz-stage" data-qstage aria-live="polite" aria-busy="true"><div class="qz-load"><i></i><i></i><i></i><p>আজকের প্রশ্ন আনা হচ্ছে…</p></div><noscript><p class="qz-msg">কুইজ খেলতে ব্রাউজারে JavaScript চালু রাখুন।</p></noscript></div>
</section>
<aside class="qz-side" aria-label="সাপ্তাহিক সেরা ও নিয়ম">
<section class="lb" data-lb hidden aria-labelledby="lb-h"><h2 id="lb-h">এই সপ্তাহের সেরা ১০</h2><ol></ol><p class="lb-n">যাঁরা নাম দিয়ে রাজি হয়েছেন, শুধু তাঁদের নামের প্রথম অংশ দেখানো হয়।</p></section>
<section class="qz-how" aria-labelledby="how-h"><h2 id="how-h">কীভাবে খেলবেন</h2><ol><li>রোজ সকাল ৮টায় ৫টা নতুন প্রশ্ন আসে, আজকের AI খবর আর সাধারণ জ্ঞান থেকে।</li><li>প্রতিটা প্রশ্নে একটা উত্তর বেছে নিন। পাঁচটা হলে জমা দিন, সঙ্গে সঙ্গে ঠিক উত্তর আর ব্যাখ্যা দেখবেন।</li><li>রোজ খেললে স্ট্রিক বাড়ে। একদিন বাদ পড়লে সপ্তাহে একবার "ছুটির পাস" নিজে থেকেই স্ট্রিক বাঁচিয়ে দেয়।</li><li>টানা ৭ দিন খেললে নিজের নামে "AI সচেতন" সার্টিফিকেট পাবেন।</li></ol></section>
<p class="qz-more"><a href="../prompt/">আজকের প্রম্পট</a><a href="../prompts-50/">৫০টা কাজের AI প্রম্পট</a><a href="../certificate/">আমার সার্টিফিকেট</a></p>
</aside>
</div>
<div class="wrap lf-hold" data-certform hidden>${leadForm("../", "certificate", "সার্টিফিকেট তৈরি করুন")}</div>`,
  })
);
write(
  "certificate/index.html",
  layout({
    root: "../",
    kind: "quiz",
    active: "quiz",
    quiz: true,
    noindex: true,
    title: `আমার AI সচেতন সার্টিফিকেট | ${cfg.siteName}`,
    description: "টানা ৭ দিন আজকের AI প্রশ্ন খেললে পাওয়া সার্টিফিকেট আবার ডাউনলোড বা শেয়ার করুন।",
    canonical: `${SITE}/certificate/`,
    body: `${pageHead(`<a href="../quiz/">আজকের AI প্রশ্ন</a>`, "আমার সার্টিফিকেট", 'টানা ৭ দিন আজকের AI প্রশ্ন খেললে এই ফোনে আপনার "AI সচেতন" সার্টিফিকেট তৈরি হয়। এখান থেকে আবার ডাউনলোড বা শেয়ার করতে পারেন।')}
<div class="wrap narrow cert-page"><div data-certpage aria-live="polite"><p class="qz-wait">সার্টিফিকেট খোঁজা হচ্ছে…</p></div></div>
<div class="wrap narrow lf-hold" data-certform hidden>${leadForm("../", "certificate", "সার্টিফিকেট তৈরি করুন")}</div>`,
  })
);
write(
  "prompt/index.html",
  layout({
    root: "../",
    active: "prompt",
    title: `আজকের প্রম্পট: রোজ একটা কাজের AI প্রম্পট | ${cfg.siteName}`,
    description: "রোজ একটা করে কাজের AI প্রম্পট, বাংলায়: কপি করুন, নিজের তথ্য বসান, ফোনে ফ্রি টুলেই চালান। কোন টুলে চলবে আর কীভাবে, ধাপে ধাপে।",
    canonical: `${SITE}/prompt/`,
    jsonLd: [crumbs([["হোম", `${SITE}/`], ["আজকের প্রম্পট", `${SITE}/prompt/`]]), { "@type": "WebPage", name: "আজকের প্রম্পট", url: `${SITE}/prompt/`, inLanguage: "bn", isPartOf: { "@id": `${SITE}/#website` }, publisher: { "@id": PUB["@id"] } }],
    body: `${pageHead(`<a href="../">প্রথম পাতা</a>`, "আজকের প্রম্পট", "রোজ একটা করে কাজের AI প্রম্পট। কপি করুন, [ ] বন্ধনীর জায়গায় নিজের কথা বসান, আর ফোনে ফ্রি টুলেই চালান।")}
<div class="wrap narrow ptd-page">${ptdCard("../", false)}
<div class="ptd-next"><a class="qstrip-link" href="../prompts-50/"><b>৫০টা কাজের AI প্রম্পট</b><span>ছাত্র, চাকরিপ্রার্থী, শিক্ষক, দোকানদার আর ক্রিয়েটরদের জন্য, এক পাতায়</span></a>${qstrip("../", true)}</div></div>`,
  })
);
let pn = 0;
const p50Item = (x, locked) => { pn++; return `<li class="p50-i${locked ? " is-x" : ""}" data-copyroot><h3><i>${bnNum(pn)}</i>${esc(x.title)}</h3><p class="p50-tool">কোন টুলে: <b>${esc(x.tool)}</b></p><div class="p50-body"${locked ? ' data-p50-x inert aria-hidden="true"' : ""}><p class="p50-p" data-copytext>${esc(x.prompt)}</p>${x.tip ? `<p class="p50-tip">${esc(x.tip)}</p>` : ""}<button type="button" class="btn-line p50-copy" data-dcopy>কপি করুন</button></div></li>`; };
write(
  "prompts-50/index.html",
  layout({
    root: "../",
    active: "prompt",
    title: `৫০টা কাজের AI প্রম্পট, বাংলায় | ${cfg.siteName}`,
    description: "ছাত্র, চাকরিপ্রার্থী, শিক্ষক, দোকানদার আর ক্রিয়েটরদের জন্য বাংলায় লেখা ৫০টা কাজের AI প্রম্পট: রেজিউমে, WBCS রিভিশন, পাঠ পরিকল্পনা, পুজোর অফার, রিল স্ক্রিপ্ট। ফোনে ফ্রি টুলেই চলে।",
    canonical: `${SITE}/prompts-50/`,
    jsonLd: [crumbs([["হোম", `${SITE}/`], ["৫০টা কাজের AI প্রম্পট", `${SITE}/prompts-50/`]]), { "@type": "WebPage", name: "৫০টা কাজের AI প্রম্পট", url: `${SITE}/prompts-50/`, inLanguage: "bn", isPartOf: { "@id": `${SITE}/#website` }, publisher: { "@id": PUB["@id"] }, mainEntity: { "@type": "ItemList", numberOfItems: P50.prompts.length, itemListElement: [...P50OPEN, ...P50REST.flatMap((r) => r[1])].map((x, i) => ({ "@type": "ListItem", position: i + 1, name: x.title })) } }],
    body: `${pageHead(`<a href="../prompt/">আজকের প্রম্পট</a>`, "৫০টা কাজের AI প্রম্পট", "ছাত্র, চাকরিপ্রার্থী, শিক্ষক, দোকানদার আর ক্রিয়েটরদের জন্য বাংলায় লেখা। সবগুলো ফোনে ফ্রি টুলেই চলে। কপি করে [ ] বন্ধনীর জায়গায় নিজের কথা বসান।")}
<div class="wrap p50-wrap">
<nav class="p50-jump" aria-label="কাদের জন্য">${P50G.map((g) => `<a href="#p-${g.key}">${esc(g.label)}</a>`).join("")}</nav>
<div class="p50 locked" data-p50>
<section class="p50-g p50-open" aria-labelledby="p-open"><h2 id="p-open">শুরুর ১০টা, সবার জন্য খোলা</h2><p>প্রতিটা দলের সবচেয়ে কাজের দুটো করে।</p><ol class="p50-l">${P50OPEN.map((x) => p50Item(x, false)).join("")}</ol></section>
<section class="p50-gate" data-p50-lock aria-labelledby="gate-h"><h2 id="gate-h">বাকি ৪০টা প্রম্পট খুলুন</h2><p>নাম আর নম্বর দিলেই নিচের সবগুলো এই ফোনে খুলে যাবে, আর পরে নতুন প্রম্পট এলে জানিয়ে দেব।</p>${leadForm("../", "prompts50", "৪০টা প্রম্পট খুলুন", true)}</section>
<p class="p50-ok" data-p50-thanks tabindex="-1" hidden role="status">সবগুলো প্রম্পট খুলে গেছে। কপি করে কাজে লাগান।</p>
${P50REST.map(([g, items]) => `<section class="p50-g" id="p-${g.key}" aria-labelledby="ph-${g.key}"><h2 id="ph-${g.key}">${esc(g.label)}</h2><p>${esc(g.lead)}</p><ol class="p50-l">${items.map((x) => p50Item(x, true)).join("")}</ol></section>`).join("")}
</div>
<p class="p50-foot">AI-এর উত্তর সবসময় ঠিক হয় না। সাল, সংখ্যা আর নিয়মকানুন বই বা সরকারি সাইটে মিলিয়ে নিন। <a href="../quiz/">আজকের AI প্রশ্ন খেলুন</a></p>
</div>`,
  })
);
// 404 + অফলাইন পাতা (absolute paths, because they can be served from any depth)
const base = new URL(SITE + "/").pathname;
write(
  "404.html",
  layout({
    root: base,
    title: `পাতাটা পাওয়া যায়নি | ${cfg.siteName}`,
    description: cfg.description,
    canonical: `${SITE}/`,
    noindex: true,
    body: `${pageHead("", "পাতাটা পাওয়া যায়নি", "ঠিকানাটা ভুল, অথবা খবরটা সরানো হয়েছে।", `<p><a class="btn-gold" href="${base}">আজকের খবরে ফিরে যান</a></p>`)}`,
  })
);
write(
  "offline/index.html",
  layout({
    root: base,
    kind: "offline",
    title: `আপনি অফলাইনে আছেন | ${cfg.siteName}`,
    description: cfg.description,
    canonical: `${SITE}/`,
    noindex: true,
    body: `${pageHead("", "আপনি অফলাইনে আছেন", "ইন্টারনেট ফিরলেই নতুন খবর দেখাবে। এর মধ্যে আগে খোলা খবরগুলো পড়তে পারেন।", `<p><button type="button" class="btn-gold" data-reload>আবার চেষ্টা করুন</button></p>`)}
<div class="wrap narrow"><h2 class="sec-h">ফোনে রাখা খবর</h2><div id="offline-list" class="feed"><p class="empty">এখনও কোনো খবর ফোনে রাখা নেই। নেট ফিরলে যে খবর খুলবেন, সেটা পরে অফলাইনেও পড়া যাবে।</p></div></div>`,
  })
);

// ---- /app/: কার্ড ফিড (এক স্ক্রিনে এক খবর, উল্টো পিঠে "আজই করুন") ----
const APP_N = 12;
const AI = {
  flip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11a8 8 0 0 1 14-5l2 2M20 4v4h-4M20 13a8 8 0 0 1-14 5l-2-2M4 20v-4h4"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.2 2 4.5 13.4h5.9L9.3 22l9.2-12h-6.1z"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5 2.5 20h19zM12 10v4.5M12 17.4v.1"/></svg>',
  speak: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  save: '<svg class="ic-bm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 4h11v16.5L12 16.6l-5.5 3.9z"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/></svg>',
  gear: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.6 4.6L19.5 7"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/></svg>',
  hand: '<svg class="coach-hand" viewBox="0 0 44 64" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 60V10M10 22 22 10l12 12"/></svg>',
  ios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4M6 11H5v9h14v-9h-1"/></svg>',
};
const wc = (s) => String(s || "").trim().split(/\s+/).filter(Boolean).length;
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
// কাজের পিঠ: চুক্তি অনুযায়ী prompt / steps / scam; ভুল বা ফাঁকা হলে null (তখন "মূল কথা" দেখায়)
const cleanAction = (a) => {
  if (!a || typeof a !== "object" || !["prompt", "steps", "scam"].includes(a.kind)) return null;
  const steps = (Array.isArray(a.steps) ? a.steps : []).map((s) => str(s, 260)).filter(Boolean).slice(0, 6);
  const prompt = str(a.prompt, 1500);
  if (a.kind === "prompt" ? !prompt : !steps.length) return steps.length ? { kind: "steps", title: str(a.title, 90), steps, prompt: "", note: str(a.note, 260) } : null;
  return { kind: a.kind, title: str(a.title, 90), steps, prompt, note: str(a.note, 260) };
};
const appBadges = (p) => {
  const b = [];
  if (p.price === "free") b.push('<li class="b-free">ফ্রি</li>');
  if (p.price === "paid") b.push("<li>পেইড</li>");
  if (p.india === "available") b.push('<li class="b-available">ভারতে চালু</li>');
  return b.length ? `<ul class="c-badges" aria-label="এক নজরে">${b.join("")}</ul>` : "";
};
const waHref = (txt) => `https://wa.me/?text=${encodeURIComponent(txt)}`;
const cardBack = (p, root, a) => {
  const full = `<a class="ab ab-line" href="${root}posts/${p.slug}/">পুরো খবর${AI.next}</a>`;
  const foot = `<div class="b-foot"><button type="button" class="ab ab-line" data-flip>${AI.back}খবরে ফিরুন</button>${full}</div>`;
  const of = `<p class="b-of">${esc(p.card_headline || p.title)}</p>`;
  if (!a) {
    const facts = p.quick_facts.slice(0, 4);
    return `<div class="face c-back" aria-hidden="true" inert><header class="b-head"><span class="b-k">${AI.bolt}মূল কথা</span><button type="button" class="b-x" data-flip>${AI.back}ফিরুন</button></header>
<div class="b-body"><h3>এক নজরে পুরো খবর</h3>${of}
${p.key_points.length ? `<ul class="b-pts">${p.key_points.map((k) => `<li>${esc(k)}</li>`).join("")}</ul>` : `<p class="b-pts-p">${esc(p.excerpt)}</p>`}
${facts.length ? `<dl class="b-facts">${facts.map((f) => `<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join("")}</dl>` : ""}
<a class="b-ptd" href="${root}prompt/"><span><b>আজকের প্রম্পট</b><span>কপি করে এখনই নিজের কাজে লাগান</span></span>${AI.next}</a></div>${foot}</div>`;
  }
  const scam = a.kind === "scam";
  const title = a.title || (scam ? "কীভাবে চিনবেন, কী করবেন" : a.kind === "prompt" ? "এই প্রম্পটটা কপি করে চালান" : "৩ ধাপে নিজে করুন");
  return `<div class="face c-back${scam ? " is-scam" : ""}" aria-hidden="true" inert><header class="b-head"><span class="b-k">${scam ? AI.warn : AI.bolt}${scam ? "সতর্ক থাকুন" : "আজই করুন"}${scam ? "" : " <small>৬০ সেকেন্ডে</small>"}</span><button type="button" class="b-x" data-flip>${AI.back}ফিরুন</button></header>
<div class="b-body"><h3>${esc(title)}</h3>${of}
${a.steps.length ? `<ol class="b-steps">${a.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}
${a.prompt ? `<div class="b-prompt"><span>প্রম্পট</span><p data-copytext>${esc(a.prompt)}</p><button type="button" class="b-copy" data-acopy>${AI.copy}<span>প্রম্পট কপি করুন</span></button></div>` : ""}
${a.note ? `<p class="b-note"><b>${scam ? "মনে রাখুন:" : "টিপ:"}</b> ${esc(a.note)}</p>` : ""}</div>${foot}</div>`;
};
const actRow = (wa, saveAttrs, label = "আজই করুন") => `<div class="c-act"><button type="button" class="ab ab-i" data-listen hidden>${AI.speak}<span>শুনুন</span></button>${saveAttrs ? `<button type="button" class="ab ab-i" data-save aria-pressed="false" ${saveAttrs}>${AI.save}<span>সেভ</span></button>` : ""}<a class="ab ab-wa" ${wa} target="_blank" rel="noopener">${ICON.wa}শেয়ার</a><button type="button" class="ab ab-go" data-flip>${AI.flip}${label}</button></div>`;
const appCard = (p, i, n, root) => {
  const url = `${SITE}/posts/${p.slug}/`;
  const head = p.card_headline || p.title;
  const local = (f) => f && !/^https?:/.test(f);
  const pic = p.photo ? { src: root + p.photo, size: p.photoSize, alt: p.photo_alt || head, ai: /\/news\/ai\//.test(p.photo_url || "") } : p.cover ? { src: local(p.cover) ? root + p.cover : p.cover, size: local(p.cover) ? imgSize(p.cover) : [1200, 630], alt: p.cover_alt || head, ai: false } : null;
  // সারাংশ: excerpt; ছোট হলে মূল কথা থেকে পয়েন্ট জুড়ে মোটামুটি ৬০ শব্দ (কার্ডে যতটা ধরে, app.js ততটাই রাখে)
  const sum = p.excerpt || p.key_points[0] || "";
  let words = wc(sum);
  const pts = [];
  for (const k of p.key_points) { if (words >= 46 || pts.length >= 3) break; if (k === sum || words + wc(k) > 66) continue; pts.push(k); words += wc(k); }
  const a = cleanAction(p.action);
  const benefit = str(p.benefit, 90);
  const src = str(p.source_name || (typeof p.source === "string" && !/^https?:/.test(p.source) ? p.source : ""), 40);
  const wa = waHref(`${head}${benefit ? `\n\nআপনার লাভ: ${benefit}` : ""}\n\nপুরো খবর: ${url}?utm_source=whatsapp&utm_medium=card-share`);
  return `<section class="slide${p.type === "scam-alert" ? " is-alert" : ""}" id="c-${p.slug}" data-id="${p.slug}" data-kind="post" aria-roledescription="খবরের কার্ড" aria-label="খবর ${bnNum(i + 1)} / ${bnNum(n)}: ${esc(head)}"><div class="card"><div class="card-in">
<article class="face c-front">${pic ? `<div class="c-pic"><img src="${esc(pic.src)}" alt="${esc(pic.alt)}" width="${pic.size[0]}" height="${pic.size[1]}" decoding="async" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}>${pic.ai ? '<span class="c-ai">AI-নির্মিত ছবি</span>' : ""}</div>` : ""}
<div class="c-body"><div class="c-meta">${tlabel(p)}${when(p)}${appBadges(p)}</div>
<h2 class="c-h">${esc(head)}</h2>
<div class="c-sum"><p>${esc(sum)}</p>${pts.length ? `<ul>${pts.map((k) => `<li>${esc(k)}</li>`).join("")}</ul>` : ""}</div>
${benefit ? `<p class="c-ben"><b>আপনার লাভ</b><span>${esc(benefit)}</span></p>` : ""}
<div class="c-more">${src ? `<span class="c-src">সূত্র: ${esc(src)}</span>` : ""}<a class="c-full" href="${root}posts/${p.slug}/">পুরো খবর${AI.next}</a></div></div>
${actRow(`href="${esc(wa)}"`, `data-title="${esc(head)}" data-url="${root}posts/${p.slug}/"`, a && a.kind === "scam" ? "কী করবেন" : "আজই করুন")}</article>
${cardBack(p, root, a)}
</div></div></section>`;
};
// AI ফ্ল্যাশের কার্ডের ছাঁচ: app.js এতে লেখা বসিয়ে পোস্টের পরে জোড়ে
const briefTpl = (root) => `<template id="brief-tpl"><section class="slide is-brief" data-kind="brief" aria-roledescription="খবরের কার্ড"><div class="card"><div class="card-in">
<article class="face c-front"><div class="c-band"><i class="live-dot" aria-hidden="true"></i>AI ফ্ল্যাশ<small>ছোট খবর</small></div>
<div class="c-body"><div class="c-meta"><span data-b-chip></span><time></time><ul class="c-badges" data-b-badges></ul></div>
<h2 class="c-h" data-b-h></h2><div class="c-sum"><p data-b-body></p></div>
<div class="c-more"><a class="c-full" href="${root}flash/" data-b-full>সব ফ্ল্যাশ${AI.next}</a></div></div>
${actRow("href=\"#\" data-b-wa", "")}</article>
<div class="face c-back" aria-hidden="true" inert><header class="b-head"><span class="b-k">${AI.bolt}আজই করুন <small>৬০ সেকেন্ডে</small></span><button type="button" class="b-x" data-flip>${AI.back}ফিরুন</button></header>
<div class="b-body"><h3>আজকের প্রম্পট দিয়ে হাত পাকান</h3><p class="b-of">ছোট খবরে আলাদা কাজ থাকে না। তার বদলে আজকের বাছাই করা প্রম্পটটা কপি করে নিজের কাজে চালিয়ে দেখুন।</p>
<a class="b-ptd" href="${root}prompt/"><span><b>আজকের প্রম্পট</b><span>কপি করে এখনই নিজের কাজে লাগান</span></span>${AI.next}</a>
<a class="b-ptd" href="${root}quiz/"><span><b>আজকের AI প্রশ্ন</b><span>৫টা প্রশ্ন, ১ মিনিট</span></span>${AI.next}</a></div>
<div class="b-foot"><button type="button" class="ab ab-line" data-flip>${AI.back}খবরে ফিরুন</button><a class="ab ab-line" href="${root}flash/" data-b-full>সব ফ্ল্যাশ${AI.next}</a></div></div>
</div></div></section></template>`;
const FIX = [
  ["Xiaomi / Redmi / POCO", ["Settings → Apps → Manage apps → Chrome (বা AI পত্রিকা) খুলুন", "Autostart চালু করুন", "Battery saver → No restrictions বেছে নিন", "Notifications → Allow notifications চালু আছে কি না দেখুন"]],
  ["Vivo / iQOO", ["Settings → Battery → Background power consumption management → Chrome (বা AI পত্রিকা) → Don't restrict", "Settings → Apps → Autostart → অ্যাপটা চালু করুন", "Settings → Notifications-এ অ্যাপের নোটিফিকেশন Allow করুন"]],
  ["Oppo", ["Settings → Battery → More settings → Optimise battery use → Chrome (বা AI পত্রিকা) → Don't optimise", "Settings → Apps → Auto launch → অ্যাপটা চালু করুন", "Settings → Notifications-এ অ্যাপের নোটিফিকেশন Allow করুন"]],
  ["Realme", ["Settings → Battery → More settings → Optimise battery use → Chrome (বা AI পত্রিকা) → Don't optimise", "Settings → Apps → Auto launch → অ্যাপটা চালু করুন", "Settings → Notifications-এ অ্যাপের নোটিফিকেশন Allow করুন"]],
  ["Samsung", ["Settings → Apps → Chrome (বা AI পত্রিকা) → Battery → Unrestricted", "Settings → Battery → Background usage limits → Never sleeping apps-এ অ্যাপটা যোগ করুন", "Settings → Notifications → App notifications-এ অ্যাপটা চালু রাখুন"]],
];
const appSheet = (root) => `<div class="sheet" id="asheet" role="dialog" aria-modal="true" aria-labelledby="asheet-h" hidden><div class="sheet-bg" data-close></div><div class="sheet-panel"><div class="sheet-head"><h2 id="asheet-h">সেটিংস</h2><button type="button" class="x" data-close aria-label="বন্ধ করুন">×</button></div>
<fieldset class="set-fs"><legend>লেখার মাপ</legend><div class="opts">${[["s", "ছোট"], ["m", "মাঝারি"], ["l", "বড়"]].map(([v, l]) => `<label><input type="radio" name="fs" value="${v}"${v === "m" ? " checked" : ""}><span>${l}</span></label>`).join("")}</div></fieldset>
<div class="set-row"><div><b>নোটিফিকেশন</b><span>বড় খবর এলেই ফোনে জানাব। যখন খুশি বন্ধ করা যায়।</span></div>${pushCta("set-btn", "চালু করুন").replace('data-alt="', 'data-alt="Telegram-এ পান" data-alt0="')}</div>
<div class="set-row" data-app-install hidden><div><b>অ্যাপ ইনস্টল করুন</b><span>হোম স্ক্রিন থেকে এক ট্যাপে খুলবে, নেট না থাকলেও শেষ খবরগুলো পড়া যাবে।</span></div><button type="button" class="set-btn" data-app-install hidden>${AI.down}ইনস্টল</button></div>
<p class="set-ios" data-ios-hint hidden>iPhone-এ: Safari-র নিচের ${AI.ios} Share বোতামে ট্যাপ করুন, তারপর "Add to Home Screen" বেছে নিন।</p>
<h3 class="set-h">সেভ করা খবর</h3><div data-saved></div>
<h3 class="set-h">নোটিফিকেশন আসছে না?</h3><p class="set-lead">কিছু ফোন ব্যাটারি বাঁচাতে নোটিফিকেশন আটকে দেয়। নিজের ফোনের নাম বেছে ধাপগুলো মিলিয়ে নিন।</p>
<div class="fix">${FIX.map(([n, s]) => `<details><summary>${n}</summary><ol>${s.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></details>`).join("")}</div>
<p class="fix-n">ফোনের মডেল আর Android ভার্সন অনুযায়ী মেনুর নাম সামান্য আলাদা হতে পারে। মূল কথা দুটো: ব্যাটারি অপটিমাইজেশন বন্ধ, আর Autostart চালু।</p>
<a class="set-web" href="${root}">পুরো ওয়েবসাইট খুলুন</a></div></div>`;
const appPage = () => {
  const root = "../";
  const list = posts.slice(0, APP_N);
  const lead = list[0];
  const leadSrc = lead ? (lead.photo ? root + lead.photo : lead.cover && !/^https?:/.test(lead.cover) ? root + lead.cover : "") : "";
  const invite = waHref(`রোজের AI খবর সহজ বাংলায়, এক স্ক্রিনে এক কার্ড। আমি Unique AI পত্রিকায় পড়ছি, আপনিও দেখুন:\n${SITE}/app/?utm_source=whatsapp&utm_medium=invite`);
  const title = `আজকের AI খবর কার্ডে | ${cfg.siteName}`;
  const desc = "আজকের AI খবর এক স্ক্রিনে এক কার্ডে: উপরে টানলেই পরের খবর, আর প্রতিটা কার্ডের পেছনে আজই করার মতো একটা কাজ।";
  return `<!doctype html>
<html lang="bn" data-fs="m">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="${SITE}/app/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(cfg.siteName)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}/app/">
<meta property="og:image" content="${esc(abs("assets/og-default.png"))}">
<meta property="og:locale" content="bn_IN">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="${APP_BG}">
<meta name="color-scheme" content="light">
<meta name="application-name" content="${esc(cfg.shortName || cfg.siteName)}">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="${esc(cfg.shortName || cfg.siteName)}">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="manifest" href="${root}manifest.webmanifest">
<link rel="icon" href="${root}assets/app/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="${root}assets/app/icon-192.png" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="${root}assets/app/apple-touch-icon.png">
<link rel="preload" href="${root}assets/fonts/anek-bangla-bengali-800-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${root}assets/fonts/hind-siliguri-bengali-400-normal.woff2" as="font" type="font/woff2" crossorigin>
${leadSrc ? `<link rel="preload" as="image" href="${esc(leadSrc)}" fetchpriority="high">\n` : ""}<link rel="stylesheet" href="${root}assets/style.css?v=${VER}">
<link rel="stylesheet" href="${root}assets/app.css?v=${VER}">
</head>
<body class="k-app" data-root="${root}" data-site="${esc(SITE)}" data-v="${VER}" data-sb="${esc(cfg.supabaseUrl || "")}" data-sbk="${esc(cfg.supabaseKey || "")}" data-free="${esc(host(cfg.freeClassUrl))}" data-main="${esc(host(cfg.mainSiteUrl))}" data-push="${cfg.pushEnabled ? 1 : 0}" data-push-api="${esc(cfg.pushApi || "")}" data-briefs="${esc(cfg.briefsApi || "")}" data-daily="${esc(DAILY)}" data-tl="${TL_JSON}">
<div class="app">
<header class="atop"><div class="a-brand"><img src="${root}assets/app/icon-192.png" alt="" width="36" height="36"><div><h1><small>Unique</small> AI পত্রিকা</h1><p class="a-count"><b><span class="a-cur" data-cur>${bnNum(1)}</span> / <span data-total>${bnNum(list.length)}</span></b> আজকের</p></div></div><span class="a-unread" data-unread>${bnNum(list.length)}টা না-পড়া</span><button type="button" class="a-gear" data-sheet="asheet" aria-label="সেটিংস">${AI.gear}</button></header>
<div class="a-prog" data-prog aria-hidden="true">${list.map(() => "<i></i>").join("")}<i class="end"></i></div>
<main class="feedx" id="feed" tabindex="0" aria-label="আজকের খবরের কার্ড। পরের খবরের জন্য উপরে টানুন বা নিচের তীর চাপুন।">
${list.map((p, i) => appCard(p, i, list.length, root)).join("\n")}
<section class="slide" id="c-end" data-id="end" data-kind="end" aria-label="আজকের সব খবর শেষ"><div class="endc">
<span class="e-ok">${AI.check}</span><h2>আজকের সব খবর শেষ ✓</h2><p class="e-sub">ভালো পড়লেন। নতুন খবর এলেই এখানে পাবেন।</p>
<div class="e-streak" data-streak-box><p data-streak-t><b>স্ট্রিক শুরু করুন</b> · টানা ৭ দিন আজকের AI প্রশ্ন খেললে সার্টিফিকেট</p><ol class="e-dots" aria-hidden="true">${[1, 2, 3, 4, 5, 6, 7].map((d) => `<li>${bnNum(d)}</li>`).join("")}</ol><a class="e-cert" href="${root}certificate/" data-cert hidden>সার্টিফিকেট নিন</a></div>
<div class="e-grid"><a class="e-b" href="${root}quiz/"><b>আজকের AI প্রশ্ন</b><span>৫টা প্রশ্ন, ১ মিনিট</span></a><a class="e-b" href="${root}prompt/"><b>দিনের প্রম্পট</b><span>কপি করে কাজে লাগান</span></a>
<a class="e-b e-wa" href="${esc(invite)}" target="_blank" rel="noopener">${ICON.wa}<b>বন্ধুকে WhatsApp-এ পাঠান</b></a>
<a class="e-b e-class" href="${ug(cfg.freeClassUrl, "app-end")}" target="_blank" rel="noopener"><i><b>ফ্রি ৪ দিনের ক্লাস</b><span>Unique Gurukul-এ হাতে-কলমে AI শিখুন</span></i>${AI.next}</a></div>
<button type="button" class="e-inst" data-app-install hidden>${AI.down}অ্যাপ ইনস্টল করুন</button>
<button type="button" class="e-top" data-top>আবার প্রথম খবরে যান</button>
</div></section>
</main>
<noscript><p class="a-ns">কার্ডগুলো উপরে টেনে পড়ুন। সব সুবিধার জন্য ব্রাউজারে JavaScript চালু রাখুন।</p></noscript>
</div>
${briefTpl(root)}
<div class="ainst" id="ainst" role="dialog" aria-labelledby="ainst-h" hidden><div class="ainst-h"><img src="${root}assets/app/icon-192.png" alt="" width="48" height="48"><div><b id="ainst-h">অ্যাপ ইনস্টল করুন</b><span>${esc(cfg.siteName)} হোম স্ক্রিনে রাখুন</span></div></div>
<ul><li>এক ট্যাপে খোলে</li><li>নেট ছাড়াও শেষ খবর</li><li>লগইন লাগে না</li></ul>
<p class="ainst-ios" data-ios-hint hidden>Safari-র নিচের ${AI.ios} Share বোতামে ট্যাপ করুন, তারপর "Add to Home Screen" বেছে নিন।</p>
<div class="ainst-act"><button type="button" class="ab ab-line" data-ainst-x>এখন নয়</button><button type="button" class="ab ab-go" data-ainst-go>${AI.down}অ্যাপ ইনস্টল করুন</button></div></div>
<div class="coach" id="coach" role="dialog" aria-modal="true" aria-labelledby="coach-h" hidden><div class="coach-spot"></div><div class="coach-card">${AI.hand}<p class="coach-n"></p><h2 id="coach-h"></h2><p></p><div class="coach-f"><span class="coach-dots" aria-hidden="true"><i></i><i></i><i></i></span><button type="button" class="coach-skip">বাদ দিন</button><button type="button" class="coach-next">পরের টিপ</button></div></div></div>
<div class="atoast" id="atoast" role="status" aria-live="polite"></div>
${appSheet(root)}
${pushSheet()}
<script src="${root}assets/site.js?v=${VER}" defer></script>
<script src="${root}assets/daily.js?v=${VER}" defer></script>
<script src="${root}assets/app.js?v=${VER}" defer></script>
</body>
</html>`;
};
write("app/index.html", appPage());

// ---- PWA: manifest + service worker ----
write("manifest.webmanifest", JSON.stringify({
  id: "/app/",
  name: cfg.siteName,
  short_name: cfg.shortName || "AI পত্রিকা",
  description: cfg.description,
  lang: "bn",
  dir: "ltr",
  start_url: "/app/?src=pwa",
  scope: "/",
  display: "standalone",
  orientation: "portrait",
  theme_color: APP_BG,
  background_color: APP_BG,
  categories: ["news", "education"],
  icons: [
    { src: "/assets/app/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/assets/app/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/assets/app/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    { src: "/assets/app/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
  shortcuts: [
    { name: "আজকের খবর কার্ডে", url: "/app/?src=pwa-shortcut", icons: [{ src: "/assets/app/icon-192.png", sizes: "192x192" }] },
    { name: "সর্বশেষ খবর", url: "/?source=pwa-shortcut", icons: [{ src: "/assets/app/icon-192.png", sizes: "192x192" }] },
    { name: "সতর্কতা ও স্ক্যাম", url: "/type/scam-alert/?source=pwa-shortcut", icons: [{ src: "/assets/app/icon-192.png", sizes: "192x192" }] },
    { name: "খবর খুঁজুন", url: "/search/?source=pwa-shortcut", icons: [{ src: "/assets/app/icon-192.png", sizes: "192x192" }] },
  ],
}, null, 1));
const PRECACHE = [
  "./", "app/", "offline/", "flash/", "quiz/", "prompt/", "prompts-50/", ...(BZ.length ? ["bazar/"] : []), `assets/style.css?v=${VER}`, `assets/site.js?v=${VER}`, `assets/daily.js?v=${VER}`, `assets/quiz.js?v=${VER}`, `assets/app.css?v=${VER}`, `assets/app.js?v=${VER}`,
  ...["bengali-400", "bengali-600", "bengali-700", "latin-400", "latin-600", "latin-700"].map((f) => `assets/fonts/hind-siliguri-${f}-normal.woff2`),
  "assets/fonts/anek-bangla-bengali-800-normal.woff2", "assets/fonts/anek-bangla-latin-800-normal.woff2",
  "assets/app/icon-192.png", "assets/app/badge-96.png", ...(hasMentor ? ["assets/mentor.webp"] : []), "manifest.webmanifest",
];
write("sw.js", SW_SRC.replace("__VERSION__", VER).replace("__PRECACHE__", JSON.stringify(PRECACHE)).replace("__DAILY__", JSON.stringify(DAILY)));

// sitemap, robots, feed
const urls = [
  { loc: `${SITE}/`, lastmod: posts[0]?.date },
  { loc: `${SITE}/flash/`, lastmod: posts[0]?.date },
  { loc: `${SITE}/quiz/` },
  { loc: `${SITE}/prompt/` },
  { loc: `${SITE}/prompts-50/` },
  ...(BZ.length ? [{ loc: `${SITE}/bazar/`, lastmod: BZ[0].p.date }] : []),
  { loc: `${SITE}/about/` },
  { loc: `${SITE}/contact/` },
  { loc: `${SITE}/privacy/` },
  { loc: `${SITE}/terms/` },
  ...(OWN.length ? [{ loc: `${SITE}/our-tools/` }] : []),
  ...TYPES.filter((t) => typeCount(t.key)).map((t) => ({ loc: `${SITE}/type/${t.key}/`, lastmod: posts.find((p) => p.type === t.key)?.date })),
  ...Object.keys(cfg.categories).filter((k) => posts.some((p) => p.category === k)).map((k) => ({ loc: `${SITE}/category/${k}/`, lastmod: posts.find((p) => p.category === k)?.date })),
  ...(tcatKeys.length ? [{ loc: `${SITE}/tools/` }, ...tcatKeys.map((k) => ({ loc: `${SITE}/tools/${k}/`, lastmod: postsOfCat(k)[0]?.date }))] : []),
  ...toolPages.map((t) => ({ loc: `${SITE}/tool/${t.key}/`, lastmod: t.lastmod })),
  ...posts.filter((p) => text(p.body_html).split(" ").length >= 150).map((p) => ({ loc: `${SITE}/posts/${p.slug}/`, lastmod: p.updated || p.date, image: p.photo ? abs(p.photo) : p.cover ? abs(p.cover) : null })),
];
write(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls
    .map((u) => `<url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}${u.image ? `<image:image><image:loc>${esc(u.image)}</image:loc></image:image>` : ""}</url>`)
    .join("\n")}\n</urlset>\n`
);
write("robots.txt", `User-agent: *\nAllow: /\nDisallow: /offline/\n\nSitemap: ${SITE}/sitemap.xml\n`);
write(
  "feed.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>\n<title>${esc(cfg.siteName)}</title>\n<link>${SITE}/</link>\n<atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>\n<description>${esc(cfg.description)}</description>\n<language>bn</language>\n${posts
    .slice(0, 30)
    .map((p) => `<item><title>${esc(p.title)}</title><link>${SITE}/posts/${p.slug}/</link><guid>${SITE}/posts/${p.slug}/</guid><pubDate>${new Date(p.date).toUTCString()}</pubDate><category>${esc(typeLabel(p.type))}</category><description>${esc(p.excerpt)}</description></item>`)
    .join("\n")}\n</channel></rss>\n`
);

console.log(`Built ${posts.length} post(s) → ${OUT}/`);
