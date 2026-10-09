// Unique Gurukul blog builder. No dependencies: `node build.mjs` turns posts/*.json into a static site in dist/.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, cpSync, existsSync } from "node:fs";
import { join } from "node:path";

const cfg = JSON.parse(readFileSync("site.config.json", "utf8"));
const SITE = cfg.siteUrl.replace(/\/+$/, "");
const OUT = "dist";
const PER_PAGE = 12;

const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const bnDate = (d) => new Intl.DateTimeFormat("bn-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(d));
const bnNum = (n) => new Intl.NumberFormat("bn-IN").format(n);
const isoDate = (d) => new Date(d).toISOString();
const text = (html = "") => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const abs = (p) => (/^https?:\/\//.test(p) ? p : `${SITE}/${p.replace(/^\/+/, "")}`);
const catName = (k) => cfg.categories[k] || k;
const host = (u) => u.replace(/^https?:\/\//, "").replace(/\/+$/, "");
const hasLogo = existsSync("assets/logo.webp");
const logoAbs = hasLogo ? abs("assets/logo.webp") : cfg.logoSourceUrl;

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
  const inner = `<span class="tr-ic">${toolIcon(t, root)}</span><span class="tr-tx"><b>${esc(t.name)}</b><span>${esc(t.desc || "")}</span></span><em>${n ? `${bnNum(n)}টি আপডেট →` : "আপডেট এলে এখানে"}</em>`;
  return n ? `<a class="trow" href="${root}tool/${t.key}/">${inner}</a>` : `<div class="trow trow-off">${inner}</div>`;
};
const catTiles = (root) => `<div class="tcat-grid">${Object.entries(TCATS).filter(([k]) => toolsIn(k).length).map(([k, v]) => `<a class="tcat" href="${root}tools/${k}/"><span class="tcat-ic">${toolsIn(k).slice(0, 4).map((t) => toolIcon(t, root, 22)).join("")}</span><b>${esc(v.name)}</b><span>${esc(v.text)}</span><em>${bnNum(toolsIn(k).length)}টি টুল${postsOfCat(k).length ? ` · ${bnNum(postsOfCat(k).length)}টি আপডেট` : ""} →</em></a>`).join("")}</div>`;
// তারিখ ধরে আপডেটের তালিকা
const timeline = (items, root) => `<ol class="tline">${items.map((p) => `<li><time datetime="${p.date}">${bnDate(p.date)}</time><a href="${root}posts/${p.slug}/"><b>${esc(p.title)}</b><span>${esc(p.excerpt)}</span></a></li>`).join("")}</ol>`;

// আলপনা + সার্কিট: বাংলার আলপনার নকশা, যার পাপড়ির ডগা থেকে সার্কিটের রেখা বেরোয়
function alpona() {
  const P = (n, r, fn) => Array.from({ length: n }, (_, i) => fn((360 / n) * i, i)).join("");
  const petal = (len, w) => `M0 0 C ${w} ${-len * 0.35}, ${w} ${-len * 0.8}, 0 ${-len} C ${-w} ${-len * 0.8}, ${-w} ${-len * 0.35}, 0 0Z`;
  return `<svg class="alpona" viewBox="-300 -300 600 600" aria-hidden="true"><g fill="none" stroke-linecap="round" stroke-linejoin="round">
<g class="al-a" stroke="#5D16E9" stroke-width="2.2">
<circle r="34"/><circle r="52" stroke-dasharray="2 9"/>
${P(8, 0, (a) => `<path transform="rotate(${a}) translate(0 -52)" d="${petal(86, 30)}"/>`)}
${P(8, 0, (a) => `<path transform="rotate(${a + 22.5}) translate(0 -70)" d="${petal(58, 18)}"/>`)}
<circle r="150"/>
${P(16, 0, (a) => `<path transform="rotate(${a}) translate(0 -150)" d="M-29 0 A29 29 0 0 1 29 0"/>`)}
</g>
<g class="al-b" stroke="#C9922A" stroke-width="2.2">
${P(8, 0, (a) => `<circle transform="rotate(${a})" cx="0" cy="-96" r="5" fill="#F0BE5C"/>`)}
${P(16, 0, (a) => `<circle transform="rotate(${a + 11.25})" cx="0" cy="-166" r="3.5" fill="#F0BE5C"/>`)}
</g>
<g class="al-c" stroke="#5D16E9" stroke-width="1.8">
${P(8, 0, (a, i) => `<g transform="rotate(${a + 22.5})"><path d="M0 -180 V-${218 + (i % 2) * 22} h${i % 2 ? 26 : -26} v-${24 + (i % 3) * 8}"/><rect x="${(i % 2 ? 26 : -26) - 5}" y="-${247 + (i % 2) * 22 + (i % 3) * 8}" width="10" height="10" rx="2" fill="#5D16E9"/><circle cx="0" cy="-180" r="4" fill="#fff"/></g>`)}
</g></g></svg>`;
}
const CAT_ICON = {
  "ai-tools": '<path d="M12 2l2.4 6.2L21 9l-5 4.3L17.5 20 12 16.4 6.5 20 8 13.3 3 9l6.6-.8z"/>',
  "vibe-coding": '<path d="M8 6l-6 6 6 6M16 6l6 6-6 6M14 3l-4 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  "automation": '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  "ai-income": '<path d="M3 17l6-6 4 4 8-8M15 7h6v6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
};
const catIcon = (k) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">${CAT_ICON[k] || CAT_ICON["ai-tools"]}</svg>`;

// ---- Unique Gurukul-এর নিজস্ব AI টুল ----
const OWN = existsSync("data/own-tools.json") ? JSON.parse(readFileSync("data/own-tools.json", "utf8")) : [];
const ownCard = (t) => `<a class="own" href="${esc(t.url)}?utm_source=blog&utm_medium=own-tools" target="_blank" rel="noopener"><div class="own-top"><i aria-hidden="true">${esc(t.name.replace(/^AI /, "")[0])}</i><div><span class="tag">${esc(t.category)}</span><b>${esc(t.name)}</b></div></div><em>${esc(t.tagline)}</em><p>${esc(t.desc)}</p><ul>${t.points.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><span class="more">টুলটা দেখুন →</span></a>`;
const ownSection = (root, full) => OWN.length ? `<section class="own-tools"><div class="wrap"><h2 class="section-title">Unique Gurukul-এর নিজস্ব AI টুল</h2><p class="diff-lead">বিভিন্ন বিভাগে আমাদের ৪০টিরও বেশি নিজস্ব AI টুল আছে, আরও তৈরি হচ্ছে। তার মধ্যে কয়েকটা:</p><div class="own-grid">${OWN.map(ownCard).join("")}<div class="own own-more"><b>আরও টুল আসছে</b><p>বাকি টুলগুলো একে একে এখানে যোগ হবে। ক্লাসে এই টুলগুলো হাতে-কলমে ব্যবহার করা শেখানো হয়।</p>${full ? `<a class="btn-lg btn-gold" href="${esc(cfg.freeClassUrl)}">ফ্রি ক্লাসে যোগ দিন</a>` : `<a class="btn-lg" href="${root}our-tools/">সব টুল দেখুন</a>`}</div></div></div></section>` : "";

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
    p.key_points = Array.isArray(p.key_points) ? p.key_points.filter(Boolean).slice(0, 5) : [];
    p.quick_facts = Array.isArray(p.quick_facts) ? p.quick_facts.filter((f) => f && f.label && f.value).slice(0, 6) : [];
    p.faq = Array.isArray(p.faq) ? p.faq.filter((f) => f && f.q && f.a).slice(0, 5) : [];
    p.tools = toolsFor(p);
    p.minutes = Math.max(1, Math.round(text(p.body_html).split(" ").length / 180));
    posts.push(p);
  }
}
posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.slug.localeCompare(a.slug)));

// ---- shared pieces ----
const ORG = { "@type": "EducationalOrganization", "@id": `${cfg.mainSiteUrl}/#org`, name: cfg.brand, url: cfg.mainSiteUrl, logo: logoAbs, foundingDate: cfg.founded, founder: { "@type": "Person", name: cfg.mentorName }, sameAs: [cfg.freeClassUrl], email: cfg.email, address: { "@type": "PostalAddress", streetAddress: cfg.address?.street, addressLocality: cfg.address?.locality, addressRegion: "West Bengal", postalCode: cfg.address?.pin, addressCountry: "IN" }, areaServed: [{ "@type": "State", name: "West Bengal" }, { "@type": "Country", name: "India" }], knowsLanguage: ["bn", "en"], description: cfg.orgDescription };
const crumbs = (items) => ({ "@type": "BreadcrumbList", itemListElement: items.map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })) });

const hasMentor = existsSync("assets/mentor.webp");
const authorBox = (root) => `<div class="author">${hasMentor ? `<img class="avatar" src="${root}assets/mentor.webp" alt="${esc(cfg.mentorName)}" width="72" height="72" loading="lazy">` : `<div class="avatar" aria-hidden="true">${esc(cfg.mentorName.split(" ").map((w) => w[0]).join("").slice(0, 2))}</div>`}<div><b>${esc(cfg.mentorName)}</b><span>${esc(cfg.mentorTitle)}</span><p>${esc(cfg.mentorBio)}</p><a href="${root}about/">আরও জানুন →</a></div></div>`;
const shareRow = (url, title) => {
  const u = encodeURIComponent(url), t = encodeURIComponent(title);
  return `<div class="share"><span>শেয়ার করুন:</span><a class="s-wa" href="https://wa.me/?text=${t}%20${u}" target="_blank" rel="noopener">WhatsApp</a><a class="s-tg" href="https://t.me/share/url?url=${u}&text=${t}" target="_blank" rel="noopener">Telegram</a><a class="s-fb" href="https://www.facebook.com/sharer/sharer.php?u=${u}" target="_blank" rel="noopener">Facebook</a><button type="button" class="s-copy" data-copy="${esc(url)}">লিংক কপি</button></div>`;
};

function layout({ root, title, description, canonical, ogImage, ogType = "website", jsonLd = [], body, extraHead = "", noindex = false }) {
  const img = abs(ogImage || "assets/og-default.png");
  const nav = Object.entries(cfg.categories).map(([k, v]) => `<a class="cat-link" href="${root}category/${k}/">${esc(v)}</a>`).join("");
  const logo = hasLogo ? `${root}assets/logo.webp` : cfg.logoSourceUrl;
  const ld = [{ "@context": "https://schema.org", "@graph": [ORG, ...jsonLd] }];
  return `<!doctype html>
<html lang="bn">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
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
${extraHead}
<link rel="alternate" type="application/rss+xml" title="${esc(cfg.siteName)}" href="${root}feed.xml">
<link rel="icon" href="${root}assets/${hasLogo ? "logo.webp" : "favicon.svg"}" type="${hasLogo ? "image/webp" : "image/svg+xml"}">
<link rel="preload" href="${root}assets/fonts/hind-siliguri-bengali-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${root}assets/style.css">
${ld.map((x) => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, "\\u003c")}</script>`).join("\n")}
</head>
<body>
<a class="skip" href="#main">মূল লেখায় যান</a>
<div class="progress" aria-hidden="true"><i></i></div>
<header class="site-header"><div class="wrap">
<a class="brand" href="${root}">${logo ? `<img src="${esc(logo)}" alt="${esc(cfg.brand)} লোগো" width="42" height="42" onerror="this.remove()">` : ""}<span>${esc(cfg.brand)}<small>ব্লগ</small></span></a>
<nav class="nav" aria-label="মূল মেনু">${nav}<a class="cat-link" href="${root}tools/">সব AI টুল</a><a class="cat-link" href="${root}our-tools/">আমাদের টুল</a><a class="search-link" href="${root}search/" aria-label="খুঁজুন"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg></a><a class="btn btn-gold" href="${esc(cfg.freeClassUrl)}">ফ্রি ক্লাস</a></nav>
</div></header>
<main id="main">
${body}
</main>
<footer class="site-footer"><div class="wrap">
<div class="f-col f-about"><b>${esc(cfg.brand)}</b><p>${esc(cfg.footerAbout)}</p></div>
<div class="f-col"><b>বিভাগ</b>${Object.entries(cfg.categories).map(([k, v]) => `<a href="${root}category/${k}/">${esc(v)}</a>`).join("")}</div>
<div class="f-col"><b>দরকারি লিংক</b><a href="${esc(cfg.mainSiteUrl)}">মূল ওয়েবসাইট: ${esc(host(cfg.mainSiteUrl))}</a><a href="${esc(cfg.freeClassUrl)}">ফ্রি ক্লাস: ${esc(host(cfg.freeClassUrl))}</a><a href="${root}tools/">সব AI টুলের তালিকা</a><a href="${root}our-tools/">আমাদের AI টুল</a><a href="${root}about/">আমাদের কথা</a><a href="${root}contact/">যোগাযোগ</a><a href="${root}feed.xml">RSS ফিড</a></div>
</div><div class="f-bottom"><div class="wrap">© ${new Date().getFullYear()} ${esc(cfg.brand)} · সব অধিকার সংরক্ষিত · <a href="${root}privacy/">গোপনীয়তা নীতি</a> · <a href="${root}terms/">শর্ত ও দাবিত্যাগ</a> · <a href="${root}contact/">যোগাযোগ</a></div></div></footer>
<script>window.UG=${JSON.stringify({ u: cfg.supabaseUrl || "", k: cfg.supabaseKey || "", free: host(cfg.freeClassUrl), main: host(cfg.mainSiteUrl) })};</script>
<script src="${root}assets/site.js" defer></script>
</body>
</html>`;
}

// কার্ডের ছবি: আসল ছবি থাকলে সেটা, না থাকলে ব্র্যান্ড-কার্ড
const picOf = (p, root) => {
  const src = p.photo || p.cover;
  return src ? (/^https?:/.test(src) ? src : root + src.replace(/^\/+/, "")) : null;
};
function card(p, root, big = false) {
  const pic = picOf(p, root);
  const thumb = pic
    ? `<img src="${esc(pic)}" alt="${esc(p.photo_alt || p.cover_alt || p.title)}" ${big ? 'fetchpriority="high"' : 'loading="lazy"'} width="1200" height="630">`
    : `<div class="ph"><b>${esc(catName(p.category))}</b><span>${esc(p.title)}</span></div>`;
  return `<a class="card${big ? " card-big" : ""}" href="${root}posts/${p.slug}/">
<div class="thumb">${thumb}</div>
<div class="card-body">
<div class="meta"><span class="tag">${esc(catName(p.category))}</span><time datetime="${p.date}">${bnDate(p.date)}</time><span>${bnNum(p.minutes)} মিনিটে পড়ুন</span></div>
<${big ? "h2" : "h3"}>${esc(p.title)}</${big ? "h2" : "h3"}>
<p>${esc(p.excerpt)}</p>
${p.tools.length ? `<div class="tools-row">${p.tools.map((t) => toolChip(t, root, false)).join("")}</div>` : ""}
<span class="more">পুরোটা পড়ুন →</span>
</div></a>`;
}

const chips = (root, active) =>
  `<div class="chips"><a class="chip${active ? "" : " active"}" href="${root}">সব পোস্ট</a>${Object.entries(cfg.categories).map(([k, v]) => `<a class="chip${active === k ? " active" : ""}" href="${root}category/${k}/">${esc(v)}</a>`).join("")}</div>`;

// পাশের তালিকার ছোট সারি
const row = (p, root) => {
  const pic = picOf(p, root);
  return `<a class="nrow" href="${root}posts/${p.slug}/">${pic ? `<img src="${esc(pic)}" alt="" loading="lazy" width="240" height="126">` : `<i class="nrow-ph"></i>`}<div><span class="tag">${esc(catName(p.category))}</span><b>${esc(p.title)}</b><time datetime="${p.date}">${bnDate(p.date)}</time></div></a>`;
};

const grid = (items, root) =>
  items.length ? `<div class="grid">${items.map((p) => card(p, root)).join("\n")}</div>` : `<div class="empty">এই বিভাগে এখনও কোনো পোস্ট নেই। শিগগিরই আসছে।</div>`;

const promo = () => `<section class="promo"><div class="wrap">
<div class="promo-box"><span class="eyebrow">সম্পূর্ণ ফ্রি</span><h2>৪ দিনের ফ্রি ক্লাস: AI Income System</h2><p>AI দিয়ে কাজ আর আয় কীভাবে শুরু করবেন, হাতে-কলমে শিখুন। কোডিং জানার দরকার নেই।</p><a class="btn-lg btn-gold" href="${esc(cfg.freeClassUrl)}">ফ্রি ক্লাসে যোগ দিন</a></div>
<div class="promo-box alt"><span class="eyebrow">${esc(cfg.brand)}</span><h2>AI, ওয়েবসাইট ও অটোমেশনের কোর্স</h2><p>২০১৭ সাল থেকে ${esc(cfg.studentCount)} শিক্ষার্থীর ভরসা। সব কোর্স আর বিস্তারিত দেখুন মূল ওয়েবসাইটে।</p><a class="btn-lg" href="${esc(cfg.mainSiteUrl)}">${esc(host(cfg.mainSiteUrl))} দেখুন</a></div>
</div></section>`;

function pager(root, page, pages) {
  if (pages <= 1) return "";
  const href = (n) => (n === 1 ? root : `${root}page/${n}/`);
  return `<nav class="pager" aria-label="পাতা">${page > 1 ? `<a href="${href(page - 1)}">← নতুন পোস্ট</a>` : "<span></span>"}<span>পাতা ${bnNum(page)} / ${bnNum(pages)}</span>${page < pages ? `<a href="${href(page + 1)}">পুরনো পোস্ট →</a>` : "<span></span>"}</nav>`;
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
cpSync("src/style.css", join(OUT, "assets/style.css"));
writeFileSync(join(OUT, ".nojekyll"), "");
if (existsSync("CNAME")) cpSync("CNAME", join(OUT, "CNAME"));

// home + pagination
const HEAD = 5; // প্রথম পাতায়: ১টা বড় খবর + পাশে ৪টা
const pages = Math.max(1, Math.ceil(Math.max(0, posts.length - HEAD) / PER_PAGE));
const todayBn = new Intl.DateTimeFormat("bn-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(new Date());
for (let page = 1; page <= pages; page++) {
  const root = page === 1 ? "./" : "../../";
  const rest = posts.slice(HEAD + (page - 1) * PER_PAGE, HEAD + page * PER_PAGE);
  const url = page === 1 ? `${SITE}/` : `${SITE}/page/${page}/`;
  write(
    page === 1 ? "index.html" : `page/${page}/index.html`,
    layout({
      root,
      title: page === 1 ? `${cfg.siteName} | ${cfg.tagline}` : `${cfg.siteName} | পাতা ${bnNum(page)}`,
      description: cfg.description,
      canonical: url,
      jsonLd: page === 1 ? [
        { "@type": "WebSite", "@id": `${SITE}/#website`, name: cfg.siteName, url: `${SITE}/`, inLanguage: "bn", description: cfg.description, publisher: { "@id": ORG["@id"] } },
        { "@type": "FAQPage", mainEntity: cfg.homeFaq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
        { "@type": "Blog", name: cfg.siteName, url: `${SITE}/`, inLanguage: "bn", publisher: { "@id": ORG["@id"] }, blogPost: posts.slice(0, 10).map((p) => ({ "@type": "BlogPosting", headline: p.title, url: `${SITE}/posts/${p.slug}/`, datePublished: isoDate(p.date) })) },
      ] : [],
      body: `${page === 1 ? `<section class="desk"><div class="wrap">
<div class="desk-text">
<span class="crown"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M3 18h18v2H3zm0-2l-1-9 5.5 4L12 4l4.5 7L22 7l-1 9z"/></svg>${esc(cfg.heroBadge)}</span>
<h1>${cfg.heroTitleHtml}</h1>
<p>${esc(cfg.heroText)}</p>
<form class="desk-search" action="./search/" method="get"><input type="search" name="q" placeholder="কী শিখতে চান? যেমন: ChatGPT" aria-label="ব্লগে খুঁজুন"><button type="submit">খুঁজুন</button></form>
<div class="desk-cta"><a class="btn-lg btn-gold" href="${esc(cfg.freeClassUrl)}">ফ্রি ক্লাসে যোগ দিন</a><a class="btn-lg btn-line" href="${esc(cfg.mainSiteUrl)}">কোর্স দেখুন</a></div>
</div>
<div class="desk-demo">
${alpona()}
<div class="who" id="who">
<div class="who-head"><b>আপনি কে? বেছে নিন</b><span>AI আপনার জন্য কী করবে, দেখুন</span></div>
<div class="who-tabs" role="tablist">${cfg.personas.map((x, i) => `<button type="button" role="tab" aria-selected="${i === 0}" data-who="${x.key}"><i>${x.emoji}</i>${esc(x.label)}</button>`).join("")}</div>
${cfg.personas.map((x, i) => `<div class="who-panel${i === 0 ? " on" : ""}" data-panel="${x.key}" role="tabpanel"><p class="who-lead">${esc(x.label)} হিসেবে AI দিয়ে আপনি পারবেন:</p><ul>${x.uses.map((u) => `<li>${esc(u)}</li>`).join("")}</ul><div class="who-prompt"><span>এখনই চেষ্টা করুন, এই প্রম্পটটা ChatGPT-তে দিন</span><q>${esc(x.prompt)}</q><button type="button" data-copy="${esc(x.prompt)}">প্রম্পট কপি করুন</button></div></div>`).join("")}
</div>
<div class="desk-latest"><span class="desk-label"><i></i>আজকের AI ডেস্ক</span>
${posts.slice(0, 2).map((p) => `<a href="./posts/${p.slug}/"><span class="tag">${esc(catName(p.category))}</span><b>${esc(p.title)}</b><em>→</em></a>`).join("")}
</div>
</div>
</div>
<div class="ticker" aria-hidden="true"><div class="ticker-track">${[0, 1].map(() => TOOLS.filter((t) => t.icon).slice(0, 26).map((t) => `<span><img src="./${t.icon}" alt="" width="20" height="20" loading="lazy">${esc(t.name)}</span>`).join("")).join("")}</div></div>
</section>
<section class="trust"><div class="wrap">${(cfg.stats || []).map((x) => `<div><b>${esc(x.value)}</b><span>${esc(x.label)}</span></div>`).join("")}</div></section>
` : ""}
<div class="wrap">
${page === 1 && posts[0] ? `<section class="news" id="news"><div class="news-head"><h2 class="section-title">আজকের AI খবর</h2><span class="news-date"><i></i>${todayBn}</span></div>
${chips(root)}
<div class="news-grid">${card(posts[0], root, true)}${posts.length > 1 ? `<div class="news-side"><b class="news-side-title">সর্বশেষ আপডেট</b>${posts.slice(1, HEAD).map((p) => row(p, root)).join("")}</div>` : ""}</div></section>` : chips(root)}
${rest.length || page > 1 ? `<h2 class="section-title">${page === 1 ? "আরও খবর ও গাইড" : `পুরনো পোস্ট, পাতা ${bnNum(page)}`}</h2>${grid(rest, root)}` : ""}
${!posts.length ? grid([], root) : ""}
${pager(root === "./" ? "./" : "../../", page, pages)}</div>
${page === 1 && Object.keys(TCATS).length ? `<section class="tcats"><div class="wrap"><h2 class="section-title">কাজ অনুযায়ী AI টুল</h2><p class="tcats-lead">ছবি, ভিডিও, ভয়েস, অ্যাপ বানানো: যে কাজের টুল খুঁজছেন, সেই বিভাগে যান। প্রতিটা টুলের নতুন আপডেট তারিখ ধরে সাজানো।</p>${catTiles("./")}</div></section>` : ""}
${page === 1 ? `<section class="topics"><div class="wrap"><h2 class="section-title">যা নিয়ে পড়বেন</h2><div class="topic-grid">${Object.entries(cfg.categories).map(([k, v]) => `<a class="topic" href="./category/${k}/"><i>${catIcon(k)}</i><b>${esc(v)}</b><span>${esc(cfg.categoryText?.[k] || "")}</span><em>${posts.some((p) => p.category === k) ? `${bnNum(posts.filter((p) => p.category === k).length)}টি পোস্ট →` : "শিগগিরই আসছে"}</em></a>`).join("")}</div></div></section>
<section class="about-strip"><div class="wrap"><div><b>${esc(cfg.brand)} কারা?</b><p>${esc(cfg.diff.lead)} ২০১৭ সাল থেকে ${esc(cfg.studentCount)} শিক্ষার্থী আমাদের সাথে শিখেছেন।</p></div><div class="about-links"><a href="./about/">কেন আমরা আলাদা →</a><a href="./our-tools/">আমাদের ${bnNum(40)}+ নিজস্ব AI টুল →</a></div></div></section>` : ""}
${page === 1 && hasMentor ? `<section class="mentor-band"><div class="wrap"><img src="./assets/mentor-about.webp" alt="${esc(cfg.mentorName)}" width="860" height="800" loading="lazy"><div><span class="eyebrow">মেন্টর</span><h2>${esc(cfg.mentorName)}</h2><b>${esc(cfg.mentorTitle)}</b><p>${esc(cfg.mentorBio)}</p><a class="btn-lg" href="./about/">আমাদের কথা পড়ুন</a></div></div></section>` : ""}
${promo()}
${page === 1 ? `<section class="seo-block"><div class="wrap"><div class="prose">${cfg.homeSeoHtml}</div>
<div class="tool-cloud"><h2 class="section-title">টুল অনুযায়ী পড়ুন</h2><div class="tools-row">${TOOLS.filter((t) => posts.some((p) => p.tools.includes(t))).map((t) => toolChip(t, root)).join("") || "<span>শিগগিরই আসছে</span>"}</div></div>
<section class="faq"><h2>সাধারণ প্রশ্ন</h2>${cfg.homeFaq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</section></div></section>` : ""}`,
    })
  );
}

// categories
for (const [k, v] of Object.entries(cfg.categories)) {
  const items = posts.filter((p) => p.category === k);
  const desc = `${v} বিষয়ে ${cfg.brand}-এর সব খবর ও গাইড, সহজ বাংলায়। ${cfg.categoryText?.[k] || ""}`.trim();
  write(
    `category/${k}/index.html`,
    layout({
      root: "../../",
      title: `${v}: খবর ও গাইড | ${cfg.siteName}`,
      description: desc,
      canonical: `${SITE}/category/${k}/`,
      jsonLd: [crumbs([["ব্লগ", `${SITE}/`], [v, `${SITE}/category/${k}/`]]), { "@type": "CollectionPage", name: v, url: `${SITE}/category/${k}/`, inLanguage: "bn" }],
      body: `<section class="hero hero-sm"><div class="wrap"><span class="eyebrow">বিভাগ</span><h1>${esc(v)}</h1><p>${esc(cfg.categoryText?.[k] || `${v} বিষয়ে সব পোস্ট এক জায়গায়।`)}</p></div></section>
<div class="wrap">${chips("../../", k)}<h2 class="section-title">${esc(v)}</h2>${grid(items, "../../")}</div>
${promo()}`,
    })
  );
}

// posts
for (const p of posts) {
  const root = "../../";
  const url = `${SITE}/posts/${p.slug}/`;
  const coverSrc = picOf(p, root);
  const related = [...posts.filter((x) => x.slug !== p.slug && x.category === p.category), ...posts.filter((x) => x.slug !== p.slug && x.category !== p.category)].slice(0, 3);
  let n = 0;
  const heads = [];
  const bodyHtml = p.body_html.replace(/<h2>([\s\S]*?)<\/h2>/g, (m, t) => { n++; heads.push(text(t)); return `<h2 id="s${n}">${t}</h2>`; });
  // blockquote: মেন্টরের মতামত আলাদা বাক্সে, বাকি সব কপি করার মতো প্রম্পট
  const richBody = bodyHtml.replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, (m, inner) => {
    const mentor = inner.match(/^\s*(?:<p>)?\s*<strong>মেন্টরের মতামত[^<]*<\/strong>\s*/);
    if (mentor) return `<aside class="mentor-note">${hasMentor ? `<img src="${root}assets/mentor.webp" alt="${esc(cfg.mentorName)}" width="56" height="56" loading="lazy">` : ""}<div><b>মেন্টরের মতামত</b><span>${esc(cfg.mentorName)}, ${esc(cfg.mentorTitle)}</span><p>${inner.replace(mentor[0], "").replace(/<\/?p>/g, " ").trim()}</p></div></aside>`;
    return `<div class="pbox"><span>কপি করে ব্যবহার করুন</span><q>${inner.replace(/<\/?p>/g, " ").trim()}</q><button type="button" data-copy="${esc(text(inner))}">প্রম্পট কপি করুন</button></div>`;
  });
  const toc = heads.length >= 4 ? `<nav class="toc" aria-label="সূচিপত্র"><b>এই লেখায় যা আছে</b><ol>${heads.map((h, i) => `<li><a href="#s${i + 1}">${esc(h)}</a></li>`).join("")}</ol></nav>` : "";
  write(
    `posts/${p.slug}/index.html`,
    layout({
      root,
      title: `${p.meta_title || p.title} | ${cfg.brand}`,
      description: p.meta_description,
      canonical: url,
      ogImage: p.cover || undefined,
      ogType: "article",
      extraHead: `<meta property="article:published_time" content="${isoDate(p.date)}">\n<meta property="article:section" content="${esc(catName(p.category))}">${p.tags.map((t) => `\n<meta property="article:tag" content="${esc(t)}">`).join("")}`,
      jsonLd: [
        crumbs([["ব্লগ", `${SITE}/`], [catName(p.category), `${SITE}/category/${p.category}/`], [p.title, url]]),
        {
          "@type": "BlogPosting",
          headline: p.title,
          description: p.meta_description,
          datePublished: isoDate(p.date),
          dateModified: isoDate(p.updated || p.date),
          inLanguage: "bn",
          mainEntityOfPage: url,
          articleSection: catName(p.category),
          keywords: p.tags.join(", "),
          wordCount: text(p.body_html).split(" ").length,
          image: [...(p.photo ? [abs(p.photo)] : []), abs(p.cover || "assets/og-default.png")],
          author: { "@type": "Person", name: cfg.mentorName, jobTitle: cfg.mentorTitle, url: `${SITE}/about/`, worksFor: { "@id": ORG["@id"] } },
          publisher: { "@id": ORG["@id"] },
        },
        ...(p.faq.length ? [{ "@type": "FAQPage", mainEntity: p.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }] : []),
      ],
      body: `<article class="article">
<nav class="crumbs" aria-label="ব্রেডক্রাম্ব"><a href="${root}">ব্লগ</a> › <a href="${root}category/${p.category}/">${esc(catName(p.category))}</a></nav>
<div class="meta"><a class="tag" href="${root}category/${p.category}/">${esc(catName(p.category))}</a><time datetime="${p.date}">${bnDate(p.date)}</time><span>${bnNum(p.minutes)} মিনিটে পড়ুন</span></div>
<h1>${esc(p.title)}</h1>
<p class="lead">${esc(p.excerpt)}</p>
${coverSrc ? `<div class="cover"><img src="${esc(coverSrc)}" alt="${esc(p.photo_alt || p.cover_alt || p.title)}" width="1200" height="630" fetchpriority="high"></div>` : ""}
${p.tools.length ? `<div class="tools-row tools-top"><span>এই পোস্টে:</span>${p.tools.map((t) => toolChip(t, root)).join("")}</div>` : ""}
${p.key_points.length ? `<section class="glance"><h2>${catIcon(p.category)} এক নজরে</h2><ul>${p.key_points.map((k) => `<li>${esc(k)}</li>`).join("")}</ul></section>` : ""}
${p.quick_facts.length ? `<section class="facts" aria-label="দ্রুত তথ্য">${p.quick_facts.map((f) => `<div><span>${esc(f.label)}</span><b>${esc(f.value)}</b></div>`).join("")}</section>` : ""}
${toc}
<div class="prose">${richBody}</div>
${p.faq.length ? `<section class="faq"><h2>সাধারণ প্রশ্ন</h2>${p.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</section>` : ""}
${shareRow(url, p.title)}
${p.tags.length ? `<div class="tags">${p.tags.map((t) => `<span>#${esc(t)}</span>`).join("")}</div>` : ""}
${authorBox(root)}
<aside class="cta"><h2>${esc(cfg.ctaTitle)}</h2><p>${esc(cfg.ctaText)}</p><div class="cta-row"><a class="btn-lg btn-gold" href="${esc(cfg.freeClassUrl)}">ফ্রি ক্লাসে যোগ দিন</a><a class="btn-lg btn-white" href="${esc(cfg.mainSiteUrl)}">সব কোর্স দেখুন</a></div></aside>
</article>
${related.length ? `<section class="related"><h2 class="section-title">আরও পড়ুন</h2><div class="grid">${related.map((x) => card(x, root)).join("\n")}</div></section>` : ""}`,
    })
  );
}

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
      title: `${t.name} বাংলায়: খবর, নতুন ফিচার ও গাইড | ${cfg.brand}`,
      description: desc,
      canonical: `${SITE}/tool/${t.key}/`,
      jsonLd: [crumbs([["ব্লগ", `${SITE}/`], ...(tc ? [[tc.name, `${SITE}/tools/${t.cat}/`]] : []), [t.name, `${SITE}/tool/${t.key}/`]]), { "@type": "CollectionPage", name: `${t.name} বাংলায়`, url: `${SITE}/tool/${t.key}/`, inLanguage: "bn", about: { "@type": "SoftwareApplication", name: t.name } }],
      body: `<section class="hero hero-sm"><div class="wrap"><span class="eyebrow">টুল</span><h1>${esc(t.name)} বাংলায়</h1><p>${esc(desc)}</p></div></section>
<div class="wrap">${tc ? `<nav class="crumbs crumbs-top" aria-label="ব্রেডক্রাম্ব"><a href="../../">ব্লগ</a> › <a href="../../tools/">সব AI টুল</a> › <a href="../../tools/${t.cat}/">${esc(tc.name)}</a></nav>` : ""}
<h2 class="section-title">${esc(t.name)}-এর আপডেট, তারিখ ধরে</h2>${timeline(items, "../../")}
<h2 class="section-title">${esc(t.name)} নিয়ে সব পোস্ট</h2>${grid(items, "../../")}
${sibs.length ? `<h2 class="section-title">একই ধরনের আরও টুল</h2><div class="tools-row tools-sib">${sibs.map((x) => toolChip(x, "../../")).join("")}</div>` : ""}</div>
${promo()}`,
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
      title: `সব AI টুলের তালিকা বাংলায়: ছবি, ভিডিও, ভয়েস, কোডিং | ${cfg.brand}`,
      description: `ছবি তৈরি, ভিডিও তৈরি, ভয়েস, অ্যাপ বানানো আর অটোমেশনের ${bnNum(TOOLS.length)}টি AI টুল বিভাগ ধরে, প্রতিটার পরিচয় আর নতুন আপডেট সহজ বাংলায়।`,
      canonical: `${SITE}/tools/`,
      jsonLd: [crumbs([["ব্লগ", `${SITE}/`], ["সব AI টুল", `${SITE}/tools/`]]), { "@type": "CollectionPage", name: "সব AI টুলের তালিকা", url: `${SITE}/tools/`, inLanguage: "bn" }],
      body: `<section class="hero hero-sm"><div class="wrap"><span class="eyebrow">AI টুলের তালিকা</span><h1>সব AI টুল, কাজ অনুযায়ী</h1><p>কোন কাজের জন্য কোন AI টুল, এক জায়গায়। প্রতিটা টুলের এক লাইনের পরিচয়, আর নতুন ফিচার এলে তার আপডেট।</p></div></section>
<div class="wrap"><div class="chips tchips">${tcatKeys.map((k) => `<a class="chip" href="#${k}">${esc(TCATS[k].name)}</a>`).join("")}</div>
${tcatKeys.map((k) => `<section class="tsec" id="${k}"><div class="tsec-head"><h2 class="section-title">${esc(TCATS[k].name)}</h2><a href="./${k}/">এই বিভাগের সব আপডেট →</a></div><p class="tcats-lead">${esc(TCATS[k].text)}</p><div class="trows">${toolsIn(k).map((t) => toolRow(t, "../")).join("")}</div></section>`).join("")}</div>
${promo()}`,
    })
  );
  for (const k of tcatKeys) {
    const v = TCATS[k];
    const items = postsOfCat(k);
    write(
      `tools/${k}/index.html`,
      layout({
        root: "../../",
        title: `${v.name}: টুলের তালিকা ও নতুন আপডেট বাংলায় | ${cfg.brand}`,
        description: `${v.text} ${toolsIn(k).slice(0, 5).map((t) => t.name).join(", ")} সহ ${bnNum(toolsIn(k).length)}টি টুলের পরিচয় আর নতুন আপডেট।`,
        canonical: `${SITE}/tools/${k}/`,
        jsonLd: [crumbs([["ব্লগ", `${SITE}/`], ["সব AI টুল", `${SITE}/tools/`], [v.name, `${SITE}/tools/${k}/`]]), { "@type": "ItemList", name: v.name, itemListElement: toolsIn(k).map((t, i) => ({ "@type": "ListItem", position: i + 1, item: { "@type": "SoftwareApplication", name: t.name, description: t.desc || undefined, applicationCategory: v.name } })) }],
        body: `<section class="hero hero-sm"><div class="wrap"><span class="eyebrow">AI টুলের বিভাগ</span><h1>${esc(v.name)}</h1><p>${esc(v.text)}</p></div></section>
<div class="wrap"><nav class="crumbs crumbs-top" aria-label="ব্রেডক্রাম্ব"><a href="../../">ব্লগ</a> › <a href="../">সব AI টুল</a></nav>
<h2 class="section-title">এই বিভাগের টুল</h2><div class="trows">${toolsIn(k).map((t) => toolRow(t, "../../")).join("")}</div>
<h2 class="section-title">নতুন আপডেট</h2>${items.length ? timeline(items, "../../") + grid(items.slice(0, 6), "../../") : `<div class="empty">এই বিভাগের টুলে নতুন কিছু এলেই এখানে তারিখ ধরে দেখাবে।</div>`}
<div class="chips tchips">${tcatKeys.filter((x) => x !== k).map((x) => `<a class="chip" href="../${x}/">${esc(TCATS[x].name)}</a>`).join("")}</div></div>
${promo()}`,
      })
    );
  }
}

// search
write("search.json", JSON.stringify(posts.map((p) => ({ s: p.slug, t: p.title, e: p.excerpt, c: catName(p.category), d: bnDate(p.date), k: [...p.tags, ...p.tools.map((t) => t.name)].join(" ") }))));
write(
  "search/index.html",
  layout({
    root: "../",
    title: `খুঁজুন | ${cfg.siteName}`,
    description: `${cfg.siteName}-এর সব পোস্টের মধ্যে খুঁজুন।`,
    canonical: `${SITE}/search/`,
    noindex: true,
    body: `<section class="hero hero-sm"><div class="wrap"><h1>ব্লগে খুঁজুন</h1><form class="search-form" onsubmit="return false"><input id="q" type="search" placeholder="যেমন: ChatGPT, ওয়েবসাইট, অটোমেশন" autocomplete="off" aria-label="খোঁজার শব্দ লিখুন"></form></div></section>
<div class="wrap"><div id="results" class="search-results" data-root="../"><p class="empty">উপরে খোঁজার শব্দ লিখুন।</p></div></div>`,
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
    jsonLd: [crumbs([["ব্লগ", `${SITE}/`], ["আমাদের AI টুল", `${SITE}/our-tools/`]]), { "@type": "ItemList", name: `${cfg.brand}-এর নিজস্ব AI টুল`, itemListElement: OWN.map((t, i) => ({ "@type": "ListItem", position: i + 1, item: { "@type": "SoftwareApplication", name: t.name, applicationCategory: "BusinessApplication", operatingSystem: "Web", url: t.url, description: t.desc, inLanguage: "bn", publisher: { "@id": ORG["@id"] } } })) }],
    body: `<section class="hero hero-sm"><div class="wrap"><span class="eyebrow">আমাদের AI টুল</span><h1>${esc(cfg.brand)}-এর নিজস্ব AI টুল</h1><p>আমরা শুধু অন্যের টুল শেখাই না, নিজেরাও বানাই। এই টুলগুলো বাংলাভাষীদের কাজের কথা ভেবে তৈরি।</p></div></section>
${ownSection("../", true)}
${promo()}`,
  })
);

// about
write(
  "about/index.html",
  layout({
    root: "../",
    title: `${cfg.brand} সম্পর্কে | ${cfg.siteName}`,
    description: cfg.aboutDescription,
    canonical: `${SITE}/about/`,
    jsonLd: [crumbs([["ব্লগ", `${SITE}/`], ["আমাদের কথা", `${SITE}/about/`]]), { "@type": "AboutPage", name: `${cfg.brand} সম্পর্কে`, url: `${SITE}/about/`, inLanguage: "bn", about: { "@id": ORG["@id"] } }, { "@type": "Person", name: cfg.mentorName, jobTitle: cfg.mentorTitle, description: cfg.mentorBio, worksFor: { "@id": ORG["@id"] } }],
    body: `<section class="hero hero-sm"><div class="wrap"><span class="eyebrow">আমাদের কথা</span><h1>${esc(cfg.brand)} সম্পর্কে</h1><p>${esc(cfg.aboutDescription)}</p></div></section>
<article class="article">${existsSync("assets/mentor-about.webp") ? `<figure class="about-photo"><img src="../assets/mentor-about.webp" alt="${esc(cfg.mentorName)}, ${esc(cfg.mentorTitle)}" width="860" height="800"><figcaption><b>${esc(cfg.mentorName)}</b>${esc(cfg.mentorTitle)}</figcaption></figure>` : ""}<div class="prose">${cfg.aboutHtml}</div>
</article>
<section class="diff"><div class="wrap"><h2 class="section-title">${esc(cfg.diff.title)}</h2><p class="diff-lead">${esc(cfg.diff.lead)}</p>
<div class="diff-table" role="table"><div class="diff-row diff-head" role="row"><span></span><span>সাধারণ AI কোর্স</span><span><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M3 18h18v2H3zm0-2l-1-9 5.5 4L12 4l4.5 7L22 7l-1 9z"/></svg>${esc(cfg.brand)}</span></div>
${cfg.diff.rows.map((r) => `<div class="diff-row" role="row"><b>${esc(r[0])}</b><span class="no">${esc(r[1])}</span><span class="yes">${esc(r[2])}</span></div>`).join("")}</div>
<div class="diff-cta"><a class="btn-lg btn-gold" href="${esc(cfg.freeClassUrl)}">ফ্রি ক্লাসে নিজে দেখে নিন</a></div></div></section>
<article class="article">
${authorBox("../")}
<aside class="cta"><h2>${esc(cfg.ctaTitle)}</h2><p>${esc(cfg.ctaText)}</p><div class="cta-row"><a class="btn-lg btn-gold" href="${esc(cfg.freeClassUrl)}">ফ্রি ক্লাসে যোগ দিন</a><a class="btn-lg btn-white" href="${esc(cfg.mainSiteUrl)}">সব কোর্স দেখুন</a></div></aside></article>`,
  })
);

// গোপনীয়তা নীতি, যোগাযোগ, শর্তাবলি
const UPDATED = "৯ অক্টোবর, ২০২৬";
const infoPage = (slug, title, lead, html, type = "WebPage") => write(
  `${slug}/index.html`,
  layout({
    root: "../",
    title: `${title} | ${cfg.siteName}`,
    description: lead,
    canonical: `${SITE}/${slug}/`,
    jsonLd: [crumbs([["ব্লগ", `${SITE}/`], [title, `${SITE}/${slug}/`]]), { "@type": type, name: title, url: `${SITE}/${slug}/`, inLanguage: "bn", publisher: { "@id": ORG["@id"] } }],
    body: `<section class="hero hero-sm"><div class="wrap"><span class="eyebrow">${esc(cfg.brand)}</span><h1>${esc(title)}</h1><p>${esc(lead)}</p></div></section>
<article class="article"><div class="prose">${html}</div></article>`,
  })
);
const mail = `<a href="mailto:${esc(cfg.email)}">${esc(cfg.email)}</a>`;
infoPage("privacy", "গোপনীয়তা নীতি", `${cfg.siteName} আপনার সম্পর্কে কী তথ্য রাখে আর কী রাখে না, সহজ বাংলায়।`, `
<p>এই পাতায় বলা আছে ${esc(cfg.siteName)} (${esc(host(SITE))}) ব্যবহার করলে আপনার কোন তথ্য আমাদের কাছে আসে আর কোনটা আসে না। শেষ হালনাগাদ: ${UPDATED}।</p>
<h2>সংক্ষেপে</h2>
<ul><li>এই ব্লগ পড়তে অ্যাকাউন্ট খুলতে হয় না, নাম, ফোন নম্বর বা ইমেইল দিতে হয় না।</li><li>ব্লগ নিজে আপনার ব্রাউজারে কোনো কুকি বসায় না।</li><li>আমরা আপনার তথ্য কাউকে বিক্রি করি না।</li></ul>
<h2>আমরা কী গুনে রাখি</h2>
<p>ব্লগ থেকে কেউ আমাদের ফ্রি ক্লাস বা মূল ওয়েবসাইটের লিংকে ক্লিক করলে আমরা তিনটা জিনিস গুনে রাখি: কোন পাতা থেকে ক্লিক হল, কোন লিংকে, আর কখন। কে ক্লিক করলেন তা আমরা রাখি না। আপনার নাম, IP ঠিকানা বা ফোনের তথ্য এই হিসেবে থাকে না। এটা শুধু এটুকু বোঝার জন্য যে কোন লেখা পাঠকের কাজে লাগছে।</p>
<p>ওই লিংকগুলোর শেষে একটা ছোট চিহ্ন জোড়া থাকে (যেমন <strong>utm_source=blog</strong>), যাতে আমাদের অন্য সাইট বুঝতে পারে আপনি ব্লগ থেকে এসেছেন।</p>
<h2>যে পরিষেবাগুলো ব্যবহার করি</h2>
<ul><li><strong>GitHub Pages:</strong> ব্লগের পাতাগুলো এখান থেকে আপনার কাছে পৌঁছয়। যেকোনো ওয়েবসাইটের মতো, পাতা পাঠানোর সময় তাদের সার্ভারে আপনার IP ঠিকানা সাময়িকভাবে ধরা পড়ে। এটা GitHub-এর নিজের নীতি অনুযায়ী চলে।</li><li><strong>Supabase:</strong> উপরে বলা ক্লিকের গোনাগুনতি এখানে জমা থাকে।</li></ul>
<p>ব্লগের ফন্ট, ছবি আর আইকন আমাদের নিজের জায়গা থেকেই আসে, বাইরের কোনো সাইট থেকে নয়।</p>
<h2>বিজ্ঞাপন</h2>
<p>এই মুহূর্তে ব্লগে বাইরের কোনো বিজ্ঞাপন নেই। ভবিষ্যতে Google AdSense-এর মতো বিজ্ঞাপন চালু হলে Google ও তার সহযোগীরা কুকি ব্যবহার করে আপনার আগ্রহ অনুযায়ী বিজ্ঞাপন দেখাতে পারে। তখন এই পাতায় তা পরিষ্কার করে জানানো হবে, আর আপনি Google-এর বিজ্ঞাপন সেটিংস থেকে তা বন্ধ করতে পারবেন।</p>
<h2>বাইরের লিংক</h2>
<p>লেখার ভেতর থেকে আপনি ${esc(host(cfg.mainSiteUrl))}, ${esc(host(cfg.freeClassUrl))} বা আমাদের অন্য টুলের সাইটে যেতে পারেন। সেখানে ভর্তি বা পেমেন্টের সময় যে তথ্য দেন, তা ওই সাইটের নিজের নিয়মে চলে। আমাদের Telegram চ্যানেলে যোগ দিলে সেটা Telegram-এর নীতি অনুযায়ী চলে।</p>
<h2>শিশুদের জন্য</h2>
<p>এই ব্লগ সাধারণ পাঠকের জন্য লেখা। আমরা জেনেশুনে কোনো শিশুর ব্যক্তিগত তথ্য সংগ্রহ করি না।</p>
<h2>নীতি বদলালে</h2>
<p>এই নীতিতে কিছু বদলালে এই পাতাতেই নতুন তারিখ সহ জানানো হবে।</p>
<h2>প্রশ্ন থাকলে</h2>
<p>গোপনীয়তা নিয়ে কিছু জানার থাকলে লিখুন: ${mail}। আরও উপায় <a href="../contact/">যোগাযোগের পাতায়</a>।</p>`);
infoPage("contact", "যোগাযোগ", `${cfg.brand}-এর সাথে যোগাযোগ করার সব উপায় এক জায়গায়।`, `
<p>ব্লগের কোনো লেখা নিয়ে প্রশ্ন, ভুল ধরিয়ে দেওয়া, বা কোর্স নিয়ে জানতে চাইলে নিচের যেকোনো উপায়ে যোগাযোগ করুন।</p>
<h2>ইমেইল</h2>
<p>${mail}<br>লেখায় কোনো তথ্য ভুল মনে হলে পোস্টের লিংকটা সহ লিখুন, আমরা দেখে ঠিক করে দেব।</p>
<h2>Telegram</h2>
<p>AI-এর নতুন খবর আর আপডেট রোজ পেতে আমাদের চ্যানেলে যোগ দিন: <a href="https://t.me/uniquegurukulfamily" rel="noopener">t.me/uniquegurukulfamily</a></p>
<h2>কোর্স ও ভর্তি</h2>
<ul><li>৪ দিনের ফ্রি AI ক্লাস: <a href="${esc(cfg.freeClassUrl)}">${esc(host(cfg.freeClassUrl))}</a></li><li>সব কোর্স আর বিস্তারিত: <a href="${esc(cfg.mainSiteUrl)}">${esc(host(cfg.mainSiteUrl))}</a></li></ul>
<h2>আমরা কোথায়</h2>
<p>${esc(cfg.brand)}, ${esc(cfg.address?.locality || "")}, পশ্চিমবঙ্গ, ভারত। ২০১৭ সাল থেকে শেখাচ্ছি।</p>
<p><a href="../about/">আমাদের কথা</a> · <a href="../privacy/">গোপনীয়তা নীতি</a> · <a href="../terms/">শর্ত ও দাবিত্যাগ</a></p>`, "ContactPage");
infoPage("terms", "শর্ত ও দাবিত্যাগ", `${cfg.siteName}-এর লেখা কীভাবে তৈরি হয়, আর তা ব্যবহারের নিয়ম।`, `
<p>শেষ হালনাগাদ: ${UPDATED}।</p>
<h2>লেখার উদ্দেশ্য</h2>
<p>এই ব্লগের সব লেখা শেখা আর জানার জন্য। AI টুলের দাম, ফিচার আর কোন দেশে চালু, এগুলো প্রায়ই বদলায়। তাই কোনো টুলে টাকা খরচ করার আগে সেই টুলের নিজের ওয়েবসাইটে একবার মিলিয়ে নিন।</p>
<h2>আমরা কীভাবে লিখি</h2>
<p>খবর জোগাড় আর প্রথম খসড়া তৈরিতে আমরা AI টুলের সাহায্য নিই। প্রতিটা লেখা প্রকাশের আগে ${esc(cfg.brand)}-এর পক্ষ থেকে পড়ে অনুমোদন করা হয়। যা আমরা নিজে পরীক্ষা করিনি, তা পরীক্ষা করেছি বলে লিখি না।</p>
<h2>ভুল থাকলে</h2>
<p>যত্ন নিয়ে লিখলেও ভুল থেকে যেতে পারে। কোনো তথ্য ভুল মনে হলে ${mail} ঠিকানায় জানান, আমরা দেখে ঠিক করব।</p>
<h2>অন্য কোম্পানির নাম ও লোগো</h2>
<p>লেখায় যে টুল বা কোম্পানির নাম আর লোগো আসে (যেমন ChatGPT, Gemini), সেগুলো তাদের নিজ নিজ মালিকের সম্পত্তি। আমরা শুধু চেনানোর জন্য ব্যবহার করি। ওই কোম্পানিগুলোর সাথে ${esc(cfg.brand)}-এর কোনো ব্যবসায়িক সম্পর্ক নেই, আর তারা এই ব্লগ অনুমোদন করেনি।</p>
<h2>আয়ের কথা</h2>
<p>"AI দিয়ে আয়" বিষয়ের লেখাগুলো সম্ভাবনা আর উপায় দেখায়। আয় নির্ভর করে আপনার পরিশ্রম, দক্ষতা আর বাজারের ওপর। আমরা কোনো নির্দিষ্ট আয়ের নিশ্চয়তা দিই না।</p>
<h2>লেখা ব্যবহার</h2>
<p>ব্লগের লেখা আর ছবি ${esc(cfg.brand)}-এর। লিংক দিয়ে শেয়ার করতে পারেন। পুরো লেখা কপি করে অন্য কোথাও ছাপতে চাইলে আগে অনুমতি নিন।</p>
<p><a href="../privacy/">গোপনীয়তা নীতি</a> · <a href="../contact/">যোগাযোগ</a></p>`);

// 404 (absolute paths, because it can be served from any depth)
const base = new URL(SITE + "/").pathname;
write(
  "404.html",
  layout({
    root: base,
    title: `পাতাটা পাওয়া যায়নি | ${cfg.siteName}`,
    description: cfg.description,
    canonical: `${SITE}/`,
    noindex: true,
    body: `<div class="wrap"><div class="empty" style="margin-top:56px"><h1 style="margin:0 0 8px">পাতাটা পাওয়া যায়নি</h1><p>ঠিকানাটা ভুল বা পোস্টটা সরানো হয়েছে।</p><p><a href="${base}">ব্লগের হোমে ফিরে যান</a></p></div></div>`,
  })
);

// sitemap, robots, feed
const urls = [
  { loc: `${SITE}/`, lastmod: posts[0]?.date },
  { loc: `${SITE}/about/` },
  { loc: `${SITE}/contact/` },
  { loc: `${SITE}/privacy/` },
  { loc: `${SITE}/terms/` },
  ...(OWN.length ? [{ loc: `${SITE}/our-tools/` }] : []),
  ...Object.keys(cfg.categories).map((k) => ({ loc: `${SITE}/category/${k}/`, lastmod: posts.find((p) => p.category === k)?.date })),
  ...(tcatKeys.length ? [{ loc: `${SITE}/tools/` }, ...tcatKeys.map((k) => ({ loc: `${SITE}/tools/${k}/`, lastmod: postsOfCat(k)[0]?.date }))] : []),
  ...toolPages.map((t) => ({ loc: `${SITE}/tool/${t.key}/`, lastmod: t.lastmod })),
  ...posts.map((p) => ({ loc: `${SITE}/posts/${p.slug}/`, lastmod: p.updated || p.date, image: p.cover ? abs(p.cover) : null })),
];
write(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls
    .map((u) => `<url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}${u.image ? `<image:image><image:loc>${esc(u.image)}</image:loc></image:image>` : ""}</url>`)
    .join("\n")}\n</urlset>\n`
);
write("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
write(
  "feed.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>\n<title>${esc(cfg.siteName)}</title>\n<link>${SITE}/</link>\n<atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>\n<description>${esc(cfg.description)}</description>\n<language>bn</language>\n${posts
    .slice(0, 30)
    .map((p) => `<item><title>${esc(p.title)}</title><link>${SITE}/posts/${p.slug}/</link><guid>${SITE}/posts/${p.slug}/</guid><pubDate>${new Date(p.date).toUTCString()}</pubDate><category>${esc(catName(p.category))}</category><description>${esc(p.excerpt)}</description></item>`)
    .join("\n")}\n</channel></rss>\n`
);

console.log(`Built ${posts.length} post(s) → ${OUT}/`);
