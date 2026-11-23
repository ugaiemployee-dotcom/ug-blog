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
const TYPE_BY_LABEL = Object.fromEntries(TYPES.map((t) => [t.label, t.key]));
const AUD = cfg.audiences || {};
const AUD_BY_LABEL = Object.fromEntries(Object.entries(AUD).map(([k, v]) => [v, k]));
const INDIA = { available: "ভারতে চালু ✅", soon: "ভারতে শীঘ্রই", no: "ভারতে এখনও নেই" };
const PRICE = { free: "ফ্রি", freemium: "আংশিক ফ্রি", paid: "পেইড" };
const indiaFrom = (v = "") => {
  if (!v || /বলা নেই/.test(v)) return null;
  if (/শীঘ্রই/.test(v)) return "soon";
  if (/এখনও|নয়|হয়নি|নেই/.test(v)) return "no";
  if (/চালু/.test(v)) return "available";
  return null;
};
const priceFrom = (v = "") => {
  if (!v || /বলা নেই/.test(v)) return null;
  if (/আংশিক ফ্রি/.test(v) || (/ফ্রি/.test(v) && /টাকা/.test(v))) return "freemium";
  if (/টাকা লাগে/.test(v)) return "paid";
  if (/ফ্রি/.test(v)) return "free";
  return null;
};
function deriveMeta(p) {
  const tags = p.tags.map((t) => String(t).trim());
  p.type = TYPE[p.news_type] ? p.news_type : TYPE_BY_LABEL[tags[0]] || cfg.typeFromCategory?.[p.category] || TYPES[0]?.key;
  const aud = Array.isArray(p.audience) ? p.audience : tags.map((t) => AUD_BY_LABEL[t]);
  p.aud = [...new Set(aud.filter((a) => AUD[a]))];
  const fact = (l) => (p.quick_facts.find((f) => String(f.label).trim() === l) || {}).value || "";
  p.india = INDIA[p.india] ? p.india : indiaFrom(String(fact("ভারতে")));
  p.price = PRICE[p.price] ? p.price : priceFrom(String(fact("খরচ")));
  p.push_line = p.push_line || p.card_headline || p.title;
  p.tags = p.tags.filter((t) => !TYPE_BY_LABEL[String(t).trim()] && !AUD_BY_LABEL[String(t).trim()]);
  p.pinned = p.type === "scam-alert" && NOW - new Date(p.date).getTime() < 3 * 864e5;
}
const typeLabel = (k) => TYPE[k]?.label || "";

// ---- AI tool library (icons + matching) ----
const TOOLS = existsSync("data/tools.json") ? JSON.parse(readFileSync("data/tools.json", "utf8")).map((t) => ({ ...t, re: new RegExp(t.match, "i") })) : [];
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
const ownSection = () => OWN.length ? `<section class="own-tools"><div class="wrap"><p class="lede">বিভিন্ন বিভাগে Unique Gurukul-এর ৪০টিরও বেশি নিজস্ব AI টুল আছে, আরও তৈরি হচ্ছে। তার মধ্যে কয়েকটা:</p><div class="own-grid">${OWN.map(ownCard).join("")}<div class="own own-more"><b>আরও টুল আসছে</b><p>বাকি টুলগুলো একে একে এখানে যোগ হবে।</p><a class="btn" href="${esc(cfg.mainSiteUrl)}">Unique Gurukul-এর ওয়েবসাইট</a></div></div></div></section>` : "";

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

// ---- asset version (cache-busting + service worker) ----
const CSS = readFileSync("src/style.css", "utf8");
const JS = readFileSync("assets/site.js", "utf8");
const SW_SRC = readFileSync("src/sw.js", "utf8");
const VER = createHash("sha1").update(CSS + JS + SW_SRC + JSON.stringify(cfg)).digest("hex").slice(0, 10);

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
  filter: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
};
const shareRow = (url, title) => {
  const u = encodeURIComponent(url), t = encodeURIComponent(title);
  return `<div class="share"><b>খবরটা শেয়ার করুন</b><div class="share-btns"><a class="s-wa" href="https://wa.me/?text=${t}%20${u}" target="_blank" rel="noopener">${ICON.wa}WhatsApp</a><button type="button" class="s-native" data-share-title="${esc(title)}" data-share-url="${esc(url)}" hidden>${ICON.share}শেয়ার</button><a href="https://t.me/share/url?url=${u}&amp;text=${t}" target="_blank" rel="noopener">Telegram</a><a href="https://www.facebook.com/sharer/sharer.php?u=${u}" target="_blank" rel="noopener">Facebook</a><button type="button" data-copy="${esc(url)}">লিংক কপি</button></div></div>`;
};

// খবরের ধরন + ভারতে চালু + দাম
const tlabel = (p) => `<span class="tl t-${p.type}">${esc(typeLabel(p.type))}</span>`;
const kicker = (p) => `<div class="kicker">${tlabel(p)}<time datetime="${p.date}">${bnDate(p.date)}</time></div>`;
const badges = (p) => {
  const b = [];
  if (p.india) b.push(`<li class="b-in b-${p.india}">${INDIA[p.india]}</li>`);
  if (p.price) b.push(`<li class="b-pr b-${p.price}">${PRICE[p.price]}</li>`);
  return b.length ? `<ul class="badges" aria-label="এক নজরে">${b.join("")}</ul>` : "";
};
const dataAttrs = (p) => `data-t="${p.type}" data-a="${p.aud.join(" ")}" data-i="${p.india || ""}" data-p="${p.price || ""}"`;
const photoTag = (p, root, attrs) => p.photo ? `<img src="${root}${esc(p.photo)}" alt="${esc(p.photo_alt || p.title)}" width="${p.photoSize[0]}" height="${p.photoSize[1]}" ${attrs}>` : "";

// তালিকার একটা খবর
const story = (p, root) => `<article class="story${p.type === "scam-alert" ? " is-alert" : ""}" ${dataAttrs(p)}><a href="${root}posts/${p.slug}/"><div class="story-tx">${kicker(p)}<h3>${esc(p.title)}</h3><p>${esc(p.excerpt)}</p>${badges(p)}</div>${p.photo ? `<div class="story-pic">${photoTag(p, root, 'loading="lazy" decoding="async"')}</div>` : ""}</a></article>`;
const storyList = (items, root, id = "") =>
  items.length ? `<div class="feed"${id ? ` id="${id}"` : ""}>${items.map((p) => story(p, root)).join("\n")}</div>` : `<div class="feed"${id ? ` id="${id}"` : ""}><p class="empty">এই ধরনের খবর এখনও আসেনি। নতুন খবর এলেই এখানে দেখাবে।</p></div>`;

// খবরের ধরনের সারি (স্টিকি, পাশে স্ক্রল হয়)
const secBar = (root, active, { filter = false, sticky = false } = {}) =>
  `<div class="secbar${sticky ? " is-sticky" : ""}"><div class="wrap secbar-in"><nav class="chips" aria-label="খবরের ধরন"><a class="chip${active ? "" : " on"}" href="${root}"${active ? "" : ' aria-current="page"'} data-type="">সব খবর</a>${TYPES.map((t) => `<a class="chip t-${t.key}${active === t.key ? " on" : ""}" href="${root}type/${t.key}/" data-type="${t.key}"${active === t.key ? ' aria-current="page"' : ""}>${esc(t.label)}</a>`).join("")}</nav>${filter ? `<button type="button" class="filter-btn" data-sheet="fsheet" aria-haspopup="dialog">${ICON.filter}<span>ফিল্টার</span><i data-fcount hidden></i></button>` : ""}</div></div>`;

const radioGroup = (name, legend, opts) => `<fieldset><legend>${legend}</legend><div class="opts">${[["", "সব"], ...opts].map(([v, l], i) => `<label><input type="radio" name="${name}" value="${v}"${i ? "" : " checked"}><span>${esc(l)}</span></label>`).join("")}</div></fieldset>`;
const filterSheet = () => `<div class="sheet" id="fsheet" role="dialog" aria-modal="true" aria-labelledby="fsheet-h" hidden><div class="sheet-bg" data-close></div><form class="sheet-panel" id="fform"><div class="sheet-head"><h2 id="fsheet-h">ফিল্টার</h2><button type="button" class="x" data-close aria-label="বন্ধ করুন">×</button></div>
${radioGroup("aud", "কাদের জন্য", Object.entries(AUD))}
${radioGroup("india", "ভারতে", [["available", "চালু"], ["soon", "শীঘ্রই"], ["no", "এখনও নেই"]])}
${radioGroup("price", "খরচ", Object.entries(PRICE))}
<p class="sheet-note">যে খবরে এই তথ্য নেই, সেটা ভারত বা খরচের ফিল্টারে বাদ যায়। কাদের জন্য, তা না লেখা থাকলে খবরটা সবার জন্য ধরা হয়।</p>
<div class="sheet-foot"><button type="reset" class="btn-line">সব মুছুন</button><button type="submit" class="btn">খবর দেখুন</button></div></form></div>`;
const pushSheet = () => `<div class="sheet" id="psheet" role="dialog" aria-modal="true" aria-labelledby="psheet-h" hidden><div class="sheet-bg" data-close></div><form class="sheet-panel" id="pform"><div class="sheet-head"><h2 id="psheet-h">নোটিফিকেশন</h2><button type="button" class="x" data-close aria-label="বন্ধ করুন">×</button></div>
<fieldset><legend>কোন খবর এলে জানাব? সর্বোচ্চ ৫টা বেছে নিন</legend><div class="opts">${TYPES.map((t, i) => `<label><input type="checkbox" name="topic" value="${t.key}"${["new-tool", "free-offer", "scam-alert"].includes(t.key) ? " checked" : ""}><span>${esc(t.label)}</span></label>`).join("")}</div></fieldset>
<p class="sheet-note" data-push-msg role="status" aria-live="polite">দিনে খুব বেশি নোটিফিকেশন পাঠানো হয় না। যেকোনো সময় বন্ধ করতে পারবেন।</p>
<div class="sheet-foot"><button type="button" class="btn-line" data-push-off hidden>বন্ধ করুন</button><button type="submit" class="btn" data-push-on>নোটিফিকেশন চালু করুন</button></div></form></div>`;
const installCard = (root) => `<div class="install" id="install" role="dialog" aria-labelledby="install-h" hidden><img src="${root}assets/app/icon-192.png" alt="" width="48" height="48"><div class="install-tx"><b id="install-h">AI পত্রিকা ফোনে রাখুন</b><p data-std>অ্যাপের মতো এক ট্যাপে খুলবে। নেট না থাকলেও আগে খোলা খবর পড়া যাবে।</p><p data-ios hidden>Safari-র নিচের Share বোতামে ট্যাপ করে "Add to Home Screen" বেছে নিন।</p></div><div class="install-act"><button type="button" class="btn" data-install>ইনস্টল করুন</button><button type="button" class="btn-text" data-install-x>এখন নয়</button></div></div>`;

const wordmark = (root, tag = "a") => `<a class="wordmark" href="${root}"><small>Unique</small><span>AI পত্রিকা</span></a>`;
const CSP = `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; font-src 'self'; connect-src 'self' ${new URL(cfg.supabaseUrl || cfg.pushApi).origin}; manifest-src 'self'; worker-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'`;

function layout({ root, title, description, canonical, ogImage, ogType = "website", jsonLd = [], body, extraHead = "", noindex = false, kind = "page", active = "", filter = false, preload = "" }) {
  const img = abs(ogImage || "assets/og-default.png");
  const ld = [{ "@context": "https://schema.org", "@graph": [ORG, PUB, ...jsonLd] }];
  const home = kind === "home";
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
<link rel="preload" href="${root}assets/fonts/hind-siliguri-bengali-700-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${root}assets/fonts/hind-siliguri-bengali-400-normal.woff2" as="font" type="font/woff2" crossorigin>
${preload}<link rel="stylesheet" href="${root}assets/style.css?v=${VER}">
${ld.map((x) => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, "\\u003c")}</script>`).join("\n")}
</head>
<body class="k-${kind}" data-root="${root}" data-v="${VER}" data-sb="${esc(cfg.supabaseUrl || "")}" data-sbk="${esc(cfg.supabaseKey || "")}" data-free="${esc(host(cfg.freeClassUrl))}" data-main="${esc(host(cfg.mainSiteUrl))}" data-push="${cfg.pushEnabled ? 1 : 0}" data-push-api="${esc(cfg.pushApi || "")}">
<a class="skip" href="#main">মূল লেখায় যান</a>
${kind === "article" ? '<div class="progress" aria-hidden="true"><i></i></div>' : ""}
<header class="mast${home ? " mast-full" : ""}"><div class="wrap">
<div class="mast-bar">${home ? "" : wordmark(root)}<span class="dateline" data-today>${dparts(NOW, true)}</span><span class="mast-act"><a class="icon-btn" href="${root}search/">${ICON.search}<span>খুঁজুন</span></a><button class="icon-btn" type="button" data-sheet="psheet" data-push-open hidden>${ICON.bell}<span>নোটিফিকেশন</span></button></span></div>
${home ? `<h1 class="masthead">${wordmark(root)}</h1><p class="motto"><span>${esc(cfg.motto)}</span></p>` : ""}
</div></header>
${secBar(root, active, { filter, sticky: filter })}
<main id="main">
${body}
</main>
<footer class="foot"><div class="wrap foot-in">
<div class="foot-brand">${wordmark(root)}<p class="foot-motto">${esc(cfg.motto)}</p><p>${esc(cfg.footerAbout)}</p></div>
<nav class="foot-col" aria-label="খবরের ধরন"><b>খবরের ধরন</b>${TYPES.map((t) => `<a href="${root}type/${t.key}/">${esc(t.label)}</a>`).join("")}</nav>
<nav class="foot-col" aria-label="বিষয়"><b>বিষয়</b>${Object.entries(cfg.categories).map(([k, v]) => `<a href="${root}category/${k}/">${esc(v)}</a>`).join("")}<a href="${root}tools/">সব AI টুলের তালিকা</a><a href="${root}our-tools/">Unique Gurukul-এর টুল</a></nav>
<nav class="foot-col" aria-label="পত্রিকা"><b>পত্রিকা</b><a href="${root}about/">আমাদের কথা</a><a href="${root}contact/">যোগাযোগ</a><a href="${root}privacy/">গোপনীয়তা নীতি</a><a href="${root}terms/">শর্ত ও দাবিত্যাগ</a><a href="${root}feed.xml">RSS ফিড</a></nav>
</div><div class="foot-pub"><div class="wrap"><p><a href="${esc(cfg.mainSiteUrl)}">${esc(cfg.brand)}</a>-এর একটি উদ্যোগ</p><p>© ${bnNum(new Date().getFullYear()).replace(/,/g, "")} ${esc(cfg.brand)}। সব অধিকার সংরক্ষিত।</p></div></div></footer>
${filter ? filterSheet() : ""}
${pushSheet()}
${installCard(root)}
<script src="${root}assets/site.js?v=${VER}" defer></script>
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
writeFileSync(join(OUT, "assets/style.css"), CSS);
writeFileSync(join(OUT, ".nojekyll"), "");
if (existsSync("CNAME")) cpSync("CNAME", join(OUT, "CNAME"));

const feedHead = (title) => `<div class="feed-head"><h2 id="feed-title" data-default="${esc(title)}">${esc(title)}</h2><span class="feed-count" data-feed-count aria-live="polite"></span><button type="button" class="btn-text" data-clear hidden>ফিল্টার মুছুন</button></div>`;
const typeIndex = (root) => `<section class="rail-box"><h2>খবরের ধরন</h2><ul class="type-index">${TYPES.map((t) => `<li><a href="${root}type/${t.key}/"><span class="tl t-${t.key}">${esc(t.label)}</span><em>${bnNum(typeCount(t.key))}</em></a></li>`).join("")}</ul></section>`;
const toolIndex = (root) => Object.keys(TCATS).length ? `<section class="rail-box"><h2>কাজ অনুযায়ী AI টুল</h2><ul class="tool-index">${Object.entries(TCATS).filter(([k]) => toolsIn(k).length).map(([k, v]) => `<li><a href="${root}tools/${k}/"><span class="ti-ic">${toolsIn(k).filter((t) => t.icon).slice(0, 3).map((t) => toolIcon(t, root, 18)).join("")}</span>${esc(v.name)}</a></li>`).join("")}</ul><a class="rail-more" href="${root}tools/">সব AI টুলের তালিকা</a></section>` : "";
const pushBox = () => `<section class="rail-box rail-push" data-push-box hidden><h2>বড় খবর এলেই জানুন</h2><p>যে ধরনের খবর চান, শুধু সেটাই আসবে।</p><button type="button" class="btn" data-sheet="psheet">নোটিফিকেশন চালু করুন</button></section>`;

// home + pagination
const HEAD = 5; // প্রথম পাতায়: ১টা বড় খবর + পাশে ৪টা
const pages = Math.max(1, Math.ceil(Math.max(0, posts.length - HEAD) / PER_PAGE));
const pinned = posts.filter((p) => p.pinned);
for (let page = 1; page <= pages; page++) {
  const root = page === 1 ? "./" : "../../";
  const rest = posts.slice(HEAD + (page - 1) * PER_PAGE, HEAD + page * PER_PAGE);
  const url = page === 1 ? `${SITE}/` : `${SITE}/page/${page}/`;
  const lead = posts[0];
  const leadPic = page === 1 && lead?.photo ? `<link rel="preload" as="image" href="${root}${esc(lead.photo)}" fetchpriority="high">\n` : "";
  write(
    page === 1 ? "index.html" : `page/${page}/index.html`,
    layout({
      root,
      kind: page === 1 ? "home" : "list",
      filter: true,
      preload: leadPic,
      title: page === 1 ? `${cfg.siteName} | ${cfg.tagline}` : `${cfg.siteName} | পাতা ${bnNum(page)}`,
      description: cfg.description,
      canonical: url,
      jsonLd: page === 1 ? [
        { "@type": "WebSite", "@id": `${SITE}/#website`, name: cfg.siteName, alternateName: cfg.shortName, url: `${SITE}/`, inLanguage: "bn", description: cfg.description, publisher: { "@id": PUB["@id"] }, potentialAction: { "@type": "SearchAction", target: `${SITE}/search/?q={search_term_string}`, "query-input": "required name=search_term_string" } },
        { "@type": "FAQPage", mainEntity: cfg.homeFaq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
        { "@type": "ItemList", name: "সর্বশেষ খবর", itemListElement: posts.slice(0, 10).map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}/posts/${p.slug}/`, name: p.title })) },
      ] : [],
      body: `${page === 1 && pinned.length ? `<div class="wrap">${pinned.map((p) => `<a class="alert-bar" href="./posts/${p.slug}/"><b>সতর্কতা</b><span>${esc(p.title)}</span></a>`).join("")}</div>` : ""}
${page === 1 && lead ? `<section class="front wrap" id="front" aria-label="প্রধান খবর">
<article class="lead${lead.type === "scam-alert" ? " is-alert" : ""}" ${dataAttrs(lead)}><a href="./posts/${lead.slug}/">${lead.photo ? `<figure class="lead-pic">${photoTag(lead, root, 'fetchpriority="high" decoding="async"')}</figure>` : ""}<div class="lead-tx">${kicker(lead)}<h2>${esc(lead.title)}</h2><p class="dek">${esc(lead.excerpt)}</p>${!lead.photo && lead.key_points.length ? `<ul class="lead-points">${lead.key_points.slice(0, 3).map((k) => `<li>${esc(k)}</li>`).join("")}</ul>` : ""}${badges(lead)}<span class="read">পুরো খবর পড়ুন<i aria-hidden="true"></i></span></div></a></article>
<div class="side">${posts.slice(1, HEAD).map((p, i) => `<article class="side-story${p.type === "scam-alert" ? " is-alert" : ""}" ${dataAttrs(p)}><a href="./posts/${p.slug}/">${kicker(p)}<h3>${esc(p.title)}</h3>${i === 0 ? `<p>${esc(p.excerpt)}</p>` : ""}${badges(p)}</a></article>`).join("")}</div>
</section>` : ""}
<div class="wrap paper">
<div class="paper-main">
${page === 1 ? `<section class="aud-pick" id="audpick" aria-labelledby="audpick-h" hidden><div><h2 id="audpick-h">আপনি কে?</h2><p>বেছে নিলে আপনার কাজের খবর আগে দেখাব। পরে ফিল্টার থেকে বদলাতে পারবেন।</p></div><div class="aud-opts">${Object.entries(AUD).map(([k, v]) => `<button type="button" data-aud="${k}">${esc(v)}</button>`).join("")}<button type="button" class="btn-text" data-aud-skip>এখন নয়</button></div></section>` : ""}
${feedHead(page === 1 ? "সর্বশেষ খবর" : `পুরনো খবর, পাতা ${bnNum(page)}`)}
${storyList(rest, root, "feed")}
<div class="feed-more" data-more hidden><button type="button" class="btn-line">আরও খবর দেখুন</button></div>
${pager(root, page, pages)}
</div>
<aside class="rail" aria-label="আরও">${pushBox()}${typeIndex(root)}${toolIndex(root)}</aside>
</div>
${page === 1 ? `<section class="seo-block"><div class="wrap seo-in"><div class="prose">${cfg.homeSeoHtml}</div>
<div><div class="tool-cloud"><h2>টুল অনুযায়ী খবর</h2><div class="tools-row">${TOOLS.filter((t) => posts.some((p) => p.tools.includes(t))).map((t) => toolChip(t, root)).join("") || "<span>শিগগিরই আসছে</span>"}</div></div>
<section class="faq"><h2>সাধারণ প্রশ্ন</h2>${cfg.homeFaq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</section></div></div></section>` : ""}`,
    })
  );
}

const pageHead = (kicker, h1, lead, extra = "") => `<section class="page-head"><div class="wrap">${kicker ? `<p class="page-k">${kicker}</p>` : ""}<h1>${h1}</h1>${lead ? `<p>${lead}</p>` : ""}${extra}</div></section>`;

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
      body: `${pageHead(`<span class="tl t-${t.key}">খবরের ধরন</span>`, esc(t.label), esc(t.text), `<p class="page-count">${bnNum(items.length)}টি খবর</p>`)}
<div class="wrap paper"><div class="paper-main">${feedHead(`${t.label}: সব খবর`)}${storyList(items, "../../", "feed")}<div class="feed-more" data-more hidden><button type="button" class="btn-line">আরও খবর দেখুন</button></div></div>
<aside class="rail" aria-label="আরও">${pushBox()}${typeIndex("../../")}</aside></div>`,
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
      title: `${v}: খবর ও গাইড | ${cfg.siteName}`,
      description: desc,
      canonical: `${SITE}/category/${k}/`,
      jsonLd: [crumbs([["হোম", `${SITE}/`], [v, `${SITE}/category/${k}/`]]), { "@type": "CollectionPage", name: v, url: `${SITE}/category/${k}/`, inLanguage: "bn" }],
      body: `${pageHead("বিষয়", esc(v), esc(cfg.categoryText?.[k] || `${v} বিষয়ে সব খবর এক জায়গায়।`), `<p class="page-count">${bnNum(items.length)}টি খবর</p>`)}
<div class="wrap paper"><div class="paper-main">${feedHead(`${v}: সব খবর`)}${storyList(items, "../../", "feed")}<div class="feed-more" data-more hidden><button type="button" class="btn-line">আরও খবর দেখুন</button></div></div>
<aside class="rail" aria-label="আরও">${typeIndex("../../")}${toolIndex("../../")}</aside></div>`,
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
      body: `<article class="article${p.type === "scam-alert" ? " is-alert" : ""}" data-slug="${p.slug}">
<header class="a-head">
<nav class="crumbs" aria-label="ব্রেডক্রাম্ব"><a href="${root}">হোম</a><span aria-hidden="true">/</span><a href="${root}type/${p.type}/">${esc(typeLabel(p.type))}</a></nav>
<h1>${esc(p.title)}</h1>
<p class="dek">${esc(p.excerpt)}</p>
${p.india || p.price || p.aud.length ? `<div class="a-badges">${badges(p)}${p.aud.length ? `<p class="a-aud"><span>কাদের জন্য:</span>${p.aud.map((a) => `<b>${esc(AUD[a])}</b>`).join("")}</p>` : ""}</div>` : ""}
<div class="byline">${hasMentor ? `<img src="${root}assets/mentor.webp" alt="" width="40" height="40">` : ""}<p><b>${esc(cfg.mentorName)}</b><span><time datetime="${p.date}">${bnDate(p.date)}</time>, ${bnNum(p.minutes)} মিনিটে পড়া</span></p><button type="button" class="s-native icon-share" data-share-title="${esc(p.title)}" data-share-url="${esc(url)}" hidden aria-label="খবরটা শেয়ার করুন">${ICON.share}</button></div>
</header>
${p.photo ? `<figure class="a-photo">${photoTag(p, root, 'fetchpriority="high" decoding="async"')}</figure>` : ""}
<div class="a-body">
${p.key_points.length ? `<section class="glance"><h2>এক নজরে</h2><ul>${p.key_points.map((k) => `<li>${esc(k)}</li>`).join("")}</ul></section>` : ""}
${p.quick_facts.length ? `<dl class="facts">${p.quick_facts.map((f) => `<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join("")}</dl>` : ""}
${p.tools.length ? `<div class="tools-row tools-top"><span>এই খবরে:</span>${p.tools.map((t) => toolChip(t, root)).join("")}</div>` : ""}
${toc}
<div class="prose">${richBody}</div>
${p.faq.length ? `<section class="faq"><h2>সাধারণ প্রশ্ন</h2>${p.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</section>` : ""}
<aside class="learn"><h2>${esc(cfg.learnTitle)}</h2><p>${esc(cfg.learnText)}</p><a href="${esc(cfg.freeClassUrl)}">ফ্রি ক্লাসের বিস্তারিত দেখুন</a></aside>
${shareRow(url, p.title)}
${p.tags.length ? `<ul class="tags" aria-label="ট্যাগ">${p.tags.map((t) => `<li>#${esc(t)}</li>`).join("")}</ul>` : ""}
${authorBox(root)}
${next && next !== p ? `<nav class="next" aria-label="পরের খবর"><a href="${root}posts/${next.slug}/"><span>পরের খবর</span>${kicker(next)}<b>${esc(next.title)}</b></a></nav>` : ""}
</div>
</article>
${related.length ? `<section class="related"><div class="wrap"><h2>আরও পড়ুন</h2>${storyList(related, root)}</div></section>` : ""}`,
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
write("search.json", JSON.stringify(posts.map((p) => ({ s: p.slug, t: p.title, e: p.excerpt, c: catName(p.category), y: p.type, l: typeLabel(p.type), a: p.aud, i: p.india || "", p: p.price || "", d: bnDate(p.date), dt: p.date, k: [...p.tags, ...p.tools.map((t) => t.name)].join(" "), ph: p.photo || "", w: p.photoSize?.[0] || 0, h: p.photoSize?.[1] || 0 }))));
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
<article class="article"><div class="a-body">${existsSync("assets/mentor-about.webp") ? `<figure class="about-photo"><img src="../assets/mentor-about.webp" alt="${esc(cfg.mentorName)}, ${esc(cfg.mentorTitle)}" width="860" height="800" loading="lazy"><figcaption><b>${esc(cfg.mentorName)}</b>${esc(cfg.mentorTitle)}</figcaption></figure>` : ""}<div class="prose">${cfg.aboutHtml}</div>
<section class="diff"><h2>${esc(cfg.diff.title)}</h2><p class="muted">${esc(cfg.diff.lead)}</p>
<div class="diff-table" role="table"><div class="diff-row diff-head" role="row"><span role="columnheader"></span><span role="columnheader">সাধারণ AI কোর্স</span><span role="columnheader">${esc(cfg.brand)}</span></div>
${cfg.diff.rows.map((r) => `<div class="diff-row" role="row"><b role="cell">${esc(r[0])}</b><span role="cell" class="no">${esc(r[1])}</span><span role="cell" class="yes">${esc(r[2])}</span></div>`).join("")}</div></section>
${authorBox("../")}
<aside class="learn"><h2>${esc(cfg.learnTitle)}</h2><p>${esc(cfg.learnText)}</p><a href="${esc(cfg.freeClassUrl)}">ফ্রি ক্লাসের বিস্তারিত দেখুন</a></aside></div></article>`,
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
<ul><li>পত্রিকা পড়তে অ্যাকাউন্ট খুলতে হয় না, নাম, ফোন নম্বর বা ইমেইল দিতে হয় না।</li><li>পত্রিকা নিজে আপনার ব্রাউজারে কোনো কুকি বসায় না।</li><li>আমরা আপনার তথ্য কাউকে বিক্রি করি না।</li></ul>
<h2>আপনার ফোনেই যা থাকে</h2>
<p>আপনি "আপনি কে?" প্রশ্নে কী বেছেছেন, কোন ফিল্টার রেখেছেন, কটা খবর পড়েছেন, এগুলো শুধু আপনার ফোন বা কম্পিউটারের ব্রাউজারে (localStorage) জমা থাকে, আমাদের কাছে আসে না। নেট না থাকলেও যাতে আগে খোলা খবর পড়া যায়, সেজন্য পত্রিকার পাতা আর ছবি আপনার ব্রাউজারেই রেখে দেওয়া হয়। ব্রাউজারের সাইট ডেটা মুছে দিলে এসব মুছে যায়।</p>
<h2>নোটিফিকেশন</h2>
<p>আপনি নিজে "নোটিফিকেশন চালু করুন" বোতামে ট্যাপ করে অনুমতি দিলে তবেই নোটিফিকেশন আসে। তখন আপনার ব্রাউজার একটা ঠিকানা (subscription) তৈরি করে, যেটা আর আপনি কোন ধরনের খবর চেয়েছেন, শুধু সেটুকু আমাদের সার্ভারে (Supabase) জমা থাকে, যাতে খবর পাঠানো যায়। এতে আপনার নাম বা ফোন নম্বর থাকে না। নোটিফিকেশন বন্ধ করলে সেই ঠিকানা মুছে দেওয়া হয়।</p>
<h2>আমরা কী গুনে রাখি</h2>
<p>পত্রিকা থেকে কেউ Unique Gurukul-এর ফ্রি ক্লাস বা মূল ওয়েবসাইটের লিংকে ক্লিক করলে আমরা তিনটা জিনিস গুনে রাখি: কোন পাতা থেকে ক্লিক হল, কোন লিংকে, আর কখন। কে ক্লিক করলেন তা আমরা রাখি না। আপনার নাম, IP ঠিকানা বা ফোনের তথ্য এই হিসেবে থাকে না।</p>
<p>ওই লিংকগুলোর শেষে একটা ছোট চিহ্ন জোড়া থাকে (যেমন <strong>utm_source=patrika</strong>), যাতে আমাদের অন্য সাইট বুঝতে পারে আপনি পত্রিকা থেকে এসেছেন।</p>
<h2>যে পরিষেবাগুলো ব্যবহার করি</h2>
<ul><li><strong>GitHub Pages:</strong> পত্রিকার পাতাগুলো এখান থেকে আপনার কাছে পৌঁছয়। যেকোনো ওয়েবসাইটের মতো, পাতা পাঠানোর সময় তাদের সার্ভারে আপনার IP ঠিকানা সাময়িকভাবে ধরা পড়ে। এটা GitHub-এর নিজের নীতি অনুযায়ী চলে।</li><li><strong>Supabase:</strong> উপরে বলা ক্লিকের গোনাগুনতি আর নোটিফিকেশনের ঠিকানা এখানে জমা থাকে।</li></ul>
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
<p>AI-এর নতুন খবর আর আপডেট রোজ পেতে আমাদের চ্যানেলে যোগ দিন: <a href="https://t.me/uniquegurukulfamily" rel="noopener">t.me/uniquegurukulfamily</a></p>
<h2>কোর্স ও ভর্তি</h2>
<ul><li>৪ দিনের ফ্রি AI ক্লাস: <a href="${esc(cfg.freeClassUrl)}">${esc(host(cfg.freeClassUrl))}</a></li><li>সব কোর্স আর বিস্তারিত: <a href="${esc(cfg.mainSiteUrl)}">${esc(host(cfg.mainSiteUrl))}</a></li></ul>
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
    body: `${pageHead("", "পাতাটা পাওয়া যায়নি", "ঠিকানাটা ভুল, অথবা খবরটা সরানো হয়েছে।", `<p><a class="btn" href="${base}">আজকের খবরে ফিরে যান</a></p>`)}`,
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
    body: `${pageHead("", "আপনি অফলাইনে আছেন", "ইন্টারনেট ফিরলেই নতুন খবর দেখাবে। এর মধ্যে আগে খোলা খবরগুলো পড়তে পারেন।", `<p><button type="button" class="btn" data-reload>আবার চেষ্টা করুন</button></p>`)}
<div class="wrap narrow"><h2 class="sec-h">ফোনে রাখা খবর</h2><div id="offline-list" class="feed"><p class="empty">এখনও কোনো খবর ফোনে রাখা নেই। নেট ফিরলে যে খবর খুলবেন, সেটা পরে অফলাইনেও পড়া যাবে।</p></div></div>`,
  })
);

// ---- PWA: manifest + service worker ----
write("manifest.webmanifest", JSON.stringify({
  id: "/",
  name: cfg.siteName,
  short_name: cfg.shortName || "AI পত্রিকা",
  description: cfg.description,
  lang: "bn",
  dir: "ltr",
  start_url: "/?source=pwa",
  scope: "/",
  display: "standalone",
  orientation: "portrait",
  theme_color: "#5D16E9",
  background_color: "#FFFFFF",
  categories: ["news", "education"],
  icons: [
    { src: "/assets/app/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/assets/app/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/assets/app/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    { src: "/assets/app/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
  shortcuts: [
    { name: "সর্বশেষ খবর", url: "/?source=pwa-shortcut", icons: [{ src: "/assets/app/icon-192.png", sizes: "192x192" }] },
    { name: "সতর্কতা ও স্ক্যাম", url: "/type/scam-alert/?source=pwa-shortcut", icons: [{ src: "/assets/app/icon-192.png", sizes: "192x192" }] },
    { name: "খবর খুঁজুন", url: "/search/?source=pwa-shortcut", icons: [{ src: "/assets/app/icon-192.png", sizes: "192x192" }] },
  ],
}, null, 1));
const PRECACHE = [
  "./", "offline/", `assets/style.css?v=${VER}`, `assets/site.js?v=${VER}`,
  ...["bengali-400", "bengali-600", "bengali-700", "latin-400", "latin-600", "latin-700"].map((f) => `assets/fonts/hind-siliguri-${f}-normal.woff2`),
  "assets/app/icon-192.png", "assets/app/badge-96.png", ...(hasMentor ? ["assets/mentor.webp"] : []), "manifest.webmanifest",
];
write("sw.js", SW_SRC.replace("__VERSION__", VER).replace("__PRECACHE__", JSON.stringify(PRECACHE)));

// sitemap, robots, feed
const urls = [
  { loc: `${SITE}/`, lastmod: posts[0]?.date },
  { loc: `${SITE}/about/` },
  { loc: `${SITE}/contact/` },
  { loc: `${SITE}/privacy/` },
  { loc: `${SITE}/terms/` },
  ...(OWN.length ? [{ loc: `${SITE}/our-tools/` }] : []),
  ...TYPES.filter((t) => typeCount(t.key)).map((t) => ({ loc: `${SITE}/type/${t.key}/`, lastmod: posts.find((p) => p.type === t.key)?.date })),
  ...Object.keys(cfg.categories).map((k) => ({ loc: `${SITE}/category/${k}/`, lastmod: posts.find((p) => p.category === k)?.date })),
  ...(tcatKeys.length ? [{ loc: `${SITE}/tools/` }, ...tcatKeys.map((k) => ({ loc: `${SITE}/tools/${k}/`, lastmod: postsOfCat(k)[0]?.date }))] : []),
  ...toolPages.map((t) => ({ loc: `${SITE}/tool/${t.key}/`, lastmod: t.lastmod })),
  ...posts.map((p) => ({ loc: `${SITE}/posts/${p.slug}/`, lastmod: p.updated || p.date, image: p.photo ? abs(p.photo) : p.cover ? abs(p.cover) : null })),
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
