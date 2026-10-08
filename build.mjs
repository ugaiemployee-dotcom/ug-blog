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
    p.minutes = Math.max(1, Math.round(text(p.body_html).split(" ").length / 180));
    posts.push(p);
  }
}
posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)));

// ---- shared pieces ----
const ORG = { "@type": "EducationalOrganization", "@id": `${cfg.mainSiteUrl}/#org`, name: cfg.brand, url: cfg.mainSiteUrl, logo: logoAbs, foundingDate: cfg.founded, founder: { "@type": "Person", name: cfg.mentorName }, sameAs: [cfg.freeClassUrl] };
const crumbs = (items) => ({ "@type": "BreadcrumbList", itemListElement: items.map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })) });

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
<div class="topbar"><div class="wrap"><span>🎓 AI শিখে আয় শুরু করতে চান? ৪ দিনের ফ্রি ক্লাসে যোগ দিন</span><a href="${esc(cfg.freeClassUrl)}">ফ্রি ক্লাসে নাম লেখান →</a></div></div>
<header class="site-header"><div class="wrap">
<a class="brand" href="${root}">${logo ? `<img src="${esc(logo)}" alt="${esc(cfg.brand)} লোগো" width="42" height="42" onerror="this.remove()">` : ""}<span>${esc(cfg.brand)}<small>ব্লগ</small></span></a>
<nav class="nav" aria-label="মূল মেনু">${nav}<a class="cat-link" href="${root}about/">আমাদের কথা</a><a class="btn btn-gold" href="${esc(cfg.freeClassUrl)}">ফ্রি ক্লাস</a><a class="btn" href="${esc(cfg.mainSiteUrl)}">কোর্স দেখুন</a></nav>
</div></header>
<main id="main">
${body}
</main>
<footer class="site-footer"><div class="wrap">
<div class="f-col f-about"><b>${esc(cfg.brand)}</b><p>${esc(cfg.footerAbout)}</p></div>
<div class="f-col"><b>বিভাগ</b>${Object.entries(cfg.categories).map(([k, v]) => `<a href="${root}category/${k}/">${esc(v)}</a>`).join("")}</div>
<div class="f-col"><b>দরকারি লিংক</b><a href="${esc(cfg.mainSiteUrl)}">মূল ওয়েবসাইট: ${esc(host(cfg.mainSiteUrl))}</a><a href="${esc(cfg.freeClassUrl)}">ফ্রি ক্লাস: ${esc(host(cfg.freeClassUrl))}</a><a href="${root}about/">আমাদের কথা</a><a href="${root}feed.xml">RSS ফিড</a></div>
</div><div class="f-bottom"><div class="wrap">© ${new Date().getFullYear()} ${esc(cfg.brand)} · সব অধিকার সংরক্ষিত</div></div></footer>
</body>
</html>`;
}

function card(p, root, big = false) {
  const thumb = p.cover
    ? `<img src="${esc(/^https?:/.test(p.cover) ? p.cover : root + p.cover.replace(/^\/+/, ""))}" alt="${esc(p.cover_alt || p.title)}" ${big ? 'fetchpriority="high"' : 'loading="lazy"'} width="1200" height="630">`
    : `<div class="ph"><b>${esc(catName(p.category))}</b><span>${esc(p.title)}</span></div>`;
  return `<a class="card${big ? " card-big" : ""}" href="${root}posts/${p.slug}/">
<div class="thumb">${thumb}</div>
<div class="card-body">
<div class="meta"><span class="tag">${esc(catName(p.category))}</span><time datetime="${p.date}">${bnDate(p.date)}</time><span>${bnNum(p.minutes)} মিনিটে পড়ুন</span></div>
<${big ? "h2" : "h3"}>${esc(p.title)}</${big ? "h2" : "h3"}>
<p>${esc(p.excerpt)}</p>
<span class="more">পুরোটা পড়ুন →</span>
</div></a>`;
}

const chips = (root, active) =>
  `<div class="chips"><a class="chip${active ? "" : " active"}" href="${root}">সব পোস্ট</a>${Object.entries(cfg.categories).map(([k, v]) => `<a class="chip${active === k ? " active" : ""}" href="${root}category/${k}/">${esc(v)}</a>`).join("")}</div>`;

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
const pages = Math.max(1, Math.ceil(Math.max(0, posts.length - 1) / PER_PAGE));
for (let page = 1; page <= pages; page++) {
  const root = page === 1 ? "./" : "../../";
  const rest = posts.slice(1 + (page - 1) * PER_PAGE, 1 + page * PER_PAGE);
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
        { "@type": "Blog", name: cfg.siteName, url: `${SITE}/`, inLanguage: "bn", publisher: { "@id": ORG["@id"] }, blogPost: posts.slice(0, 10).map((p) => ({ "@type": "BlogPosting", headline: p.title, url: `${SITE}/posts/${p.slug}/`, datePublished: isoDate(p.date) })) },
      ] : [],
      body: `${page === 1 ? `<section class="hero"><div class="wrap"><span class="eyebrow">${esc(cfg.brand)} ব্লগ</span><h1>${esc(cfg.tagline)}</h1><p>${esc(cfg.heroText)}</p><div class="hero-cta"><a class="btn-lg btn-gold" href="${esc(cfg.freeClassUrl)}">ফ্রি ক্লাসে যোগ দিন</a><a class="btn-lg btn-ghost" href="${esc(cfg.mainSiteUrl)}">কোর্স দেখুন</a></div></div></section>` : ""}
<div class="wrap">${chips(root)}
${page === 1 && posts[0] ? `<h2 class="section-title">সর্বশেষ</h2>${card(posts[0], root, true)}` : ""}
${rest.length || page > 1 ? `<h2 class="section-title">${page === 1 ? "আরও পোস্ট" : `পুরনো পোস্ট, পাতা ${bnNum(page)}`}</h2>${grid(rest, root)}` : ""}
${!posts.length ? grid([], root) : ""}
${pager(root === "./" ? "./" : "../../", page, pages)}</div>
${promo()}`,
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
  const coverSrc = p.cover ? (/^https?:/.test(p.cover) ? p.cover : root + p.cover.replace(/^\/+/, "")) : null;
  const related = [...posts.filter((x) => x.slug !== p.slug && x.category === p.category), ...posts.filter((x) => x.slug !== p.slug && x.category !== p.category)].slice(0, 3);
  // লেখার মাঝখানে (দ্বিতীয় h2-এর আগে) ফ্রি ক্লাসের ছোট ব্যানার
  const inline = `<aside class="inline-cta"><span>🎓 এই ধরনের টুল হাতে-কলমে শিখতে চান?</span><a href="${esc(cfg.freeClassUrl)}">৪ দিনের ফ্রি ক্লাসে যোগ দিন →</a></aside>`;
  let n = 0;
  const bodyHtml = p.body_html.replace(/<h2>/g, (m) => (++n === 2 ? inline + m : m));
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
          image: [abs(p.cover || "assets/og-default.png")],
          author: { "@type": "Person", name: cfg.mentorName, jobTitle: cfg.mentorTitle, url: `${SITE}/about/`, worksFor: { "@id": ORG["@id"] } },
          publisher: { "@id": ORG["@id"] },
        },
      ],
      body: `<article class="article">
<nav class="crumbs" aria-label="ব্রেডক্রাম্ব"><a href="${root}">ব্লগ</a> › <a href="${root}category/${p.category}/">${esc(catName(p.category))}</a></nav>
<div class="meta"><a class="tag" href="${root}category/${p.category}/">${esc(catName(p.category))}</a><time datetime="${p.date}">${bnDate(p.date)}</time><span>${bnNum(p.minutes)} মিনিটে পড়ুন</span></div>
<h1>${esc(p.title)}</h1>
<p class="lead">${esc(p.excerpt)}</p>
${coverSrc ? `<div class="cover"><img src="${esc(coverSrc)}" alt="${esc(p.cover_alt || p.title)}" width="1200" height="630" fetchpriority="high"></div>` : ""}
<div class="prose">${bodyHtml}</div>
${p.tags.length ? `<div class="tags">${p.tags.map((t) => `<span>#${esc(t)}</span>`).join("")}</div>` : ""}
<div class="author"><div class="avatar" aria-hidden="true">${esc(cfg.mentorName.split(" ").map((w) => w[0]).join("").slice(0, 2))}</div><div><b>${esc(cfg.mentorName)}</b><span>${esc(cfg.mentorTitle)}</span><p>${esc(cfg.mentorBio)}</p></div></div>
<aside class="cta"><h2>${esc(cfg.ctaTitle)}</h2><p>${esc(cfg.ctaText)}</p><div class="cta-row"><a class="btn-lg btn-gold" href="${esc(cfg.freeClassUrl)}">ফ্রি ক্লাসে যোগ দিন</a><a class="btn-lg btn-white" href="${esc(cfg.mainSiteUrl)}">সব কোর্স দেখুন</a></div></aside>
</article>
${related.length ? `<section class="related"><h2 class="section-title">আরও পড়ুন</h2><div class="grid">${related.map((x) => card(x, root)).join("\n")}</div></section>` : ""}`,
    })
  );
}

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
<article class="article"><div class="prose">${cfg.aboutHtml}</div>
<div class="author"><div class="avatar" aria-hidden="true">${esc(cfg.mentorName.split(" ").map((w) => w[0]).join("").slice(0, 2))}</div><div><b>${esc(cfg.mentorName)}</b><span>${esc(cfg.mentorTitle)}</span><p>${esc(cfg.mentorBio)}</p></div></div>
<aside class="cta"><h2>${esc(cfg.ctaTitle)}</h2><p>${esc(cfg.ctaText)}</p><div class="cta-row"><a class="btn-lg btn-gold" href="${esc(cfg.freeClassUrl)}">ফ্রি ক্লাসে যোগ দিন</a><a class="btn-lg btn-white" href="${esc(cfg.mainSiteUrl)}">সব কোর্স দেখুন</a></div></aside></article>`,
  })
);

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
  ...Object.keys(cfg.categories).map((k) => ({ loc: `${SITE}/category/${k}/`, lastmod: posts.find((p) => p.category === k)?.date })),
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
