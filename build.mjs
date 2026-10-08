// Unique Gurukul blog builder. No dependencies: `node build.mjs` turns posts/*.json into a static site in dist/.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, cpSync, existsSync } from "node:fs";
import { join } from "node:path";

const cfg = JSON.parse(readFileSync("site.config.json", "utf8"));
const SITE = cfg.siteUrl.replace(/\/+$/, "");
const OUT = "dist";

const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const bnDate = (d) => new Intl.DateTimeFormat("bn-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(d));
const isoDate = (d) => new Date(d).toISOString();
const text = (html = "") => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const abs = (p) => (/^https?:\/\//.test(p) ? p : `${SITE}/${p.replace(/^\/+/, "")}`);
const catName = (k) => cfg.categories[k] || k;

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
    posts.push(p);
  }
}
posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)));

// ---- templates ----
function layout({ root, title, description, canonical, ogImage, ogType = "website", jsonLd, body }) {
  const img = abs(ogImage || "assets/og-default.png");
  const nav = Object.entries(cfg.categories)
    .map(([k, v]) => `<a class="cat-link" href="${root}category/${k}/">${esc(v)}</a>`)
    .join("");
  return `<!doctype html>
<html lang="bn">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="${esc(cfg.siteName)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:locale" content="bn_IN">
<meta name="twitter:card" content="summary_large_image">
<link rel="alternate" type="application/rss+xml" title="${esc(cfg.siteName)}" href="${root}feed.xml">
<link rel="icon" href="${root}assets/favicon.svg" type="image/svg+xml">
<link rel="preload" href="${root}assets/fonts/hind-siliguri-bengali-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${root}assets/style.css">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>` : ""}
</head>
<body>
<header class="site-header"><div class="wrap">
<a class="brand" href="${root}">${cfg.logoUrl ? `<img src="${esc(cfg.logoUrl)}" alt="${esc(cfg.brand)} লোগো" width="40" height="40" onerror="this.remove()">` : ""}<span>${esc(cfg.brand)}<small>ব্লগ</small></span></a>
<nav class="nav" aria-label="মূল মেনু">${nav}<a class="btn" href="${esc(cfg.ctaUrl)}">${esc(cfg.ctaButton)}</a></nav>
</div></header>
<main>
${body}
</main>
<footer class="site-footer"><div class="wrap">
<span>© ${new Date().getFullYear()} ${esc(cfg.brand)}</span>
<nav aria-label="নিচের মেনু"><a href="${root}">ব্লগ হোম</a><a href="${esc(cfg.mainSiteUrl)}">মূল ওয়েবসাইট</a><a href="${root}feed.xml">RSS</a></nav>
</div></footer>
</body>
</html>`;
}

function card(p, root) {
  const thumb = p.cover
    ? `<img src="${esc(/^https?:/.test(p.cover) ? p.cover : root + p.cover.replace(/^\/+/, ""))}" alt="${esc(p.cover_alt || p.title)}" loading="lazy" width="1200" height="630">`
    : `<div class="ph"><b>${esc(catName(p.category))}</b><span>${esc(p.title)}</span></div>`;
  return `<a class="card" href="${root}posts/${p.slug}/">
<div class="thumb">${thumb}</div>
<div class="card-body">
<div class="meta"><span class="tag">${esc(catName(p.category))}</span><time datetime="${p.date}">${bnDate(p.date)}</time></div>
<h3>${esc(p.title)}</h3>
<p>${esc(p.excerpt)}</p>
<span class="more">পুরোটা পড়ুন →</span>
</div></a>`;
}

function chips(root, active) {
  return `<div class="chips"><a class="chip${active ? "" : " active"}" href="${root}">সব পোস্ট</a>${Object.entries(cfg.categories)
    .map(([k, v]) => `<a class="chip${active === k ? " active" : ""}" href="${root}category/${k}/">${esc(v)}</a>`)
    .join("")}</div>`;
}

const listing = (items, root) =>
  items.length ? `<div class="grid">${items.map((p) => card(p, root)).join("\n")}</div>` : `<div class="empty">এই বিভাগে এখনও কোনো পোস্ট নেই। শিগগিরই আসছে।</div>`;

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

// home
write(
  "index.html",
  layout({
    root: "./",
    title: `${cfg.siteName} | ${cfg.tagline}`,
    description: cfg.description,
    canonical: `${SITE}/`,
    jsonLd: { "@context": "https://schema.org", "@type": "Blog", name: cfg.siteName, url: `${SITE}/`, description: cfg.description, inLanguage: "bn", publisher: { "@type": "Organization", name: cfg.brand, url: cfg.mainSiteUrl } },
    body: `<section class="hero"><div class="wrap"><span class="eyebrow">${esc(cfg.brand)} ব্লগ</span><h1>${esc(cfg.tagline)}</h1><p>${esc(cfg.description)}</p></div></section>
<div class="wrap">${chips("./")}<h2 class="section-title">নতুন পোস্ট</h2>${listing(posts, "./")}</div>`,
  })
);

// categories
for (const [k, v] of Object.entries(cfg.categories)) {
  const items = posts.filter((p) => p.category === k);
  write(
    `category/${k}/index.html`,
    layout({
      root: "../../",
      title: `${v} | ${cfg.siteName}`,
      description: `${v} বিষয়ে ${cfg.brand}-এর সব পোস্ট, সহজ বাংলায়।`,
      canonical: `${SITE}/category/${k}/`,
      body: `<section class="hero"><div class="wrap"><span class="eyebrow">বিভাগ</span><h1>${esc(v)}</h1><p>${esc(v)} বিষয়ে সব পোস্ট এক জায়গায়।</p></div></section>
<div class="wrap">${chips("../../", k)}<h2 class="section-title">${esc(v)}</h2>${listing(items, "../../")}</div>`,
    })
  );
}

// posts
for (const p of posts) {
  const root = "../../";
  const url = `${SITE}/posts/${p.slug}/`;
  const coverSrc = p.cover ? (/^https?:/.test(p.cover) ? p.cover : root + p.cover.replace(/^\/+/, "")) : null;
  const related = posts.filter((x) => x.slug !== p.slug && x.category === p.category).slice(0, 3);
  write(
    `posts/${p.slug}/index.html`,
    layout({
      root,
      title: `${p.meta_title || p.title} | ${cfg.brand}`,
      description: p.meta_description,
      canonical: url,
      ogImage: p.cover || undefined,
      ogType: "article",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: p.title,
        description: p.meta_description,
        datePublished: isoDate(p.date),
        dateModified: isoDate(p.updated || p.date),
        inLanguage: "bn",
        mainEntityOfPage: url,
        image: abs(p.cover || "assets/og-default.png"),
        author: { "@type": "Organization", name: cfg.brand, url: cfg.mainSiteUrl },
        publisher: { "@type": "Organization", name: cfg.brand, url: cfg.mainSiteUrl },
      },
      body: `<article class="article">
<div class="crumbs"><a href="${root}">ব্লগ</a> › <a href="${root}category/${p.category}/">${esc(catName(p.category))}</a></div>
<div class="meta"><a class="tag" href="${root}category/${p.category}/">${esc(catName(p.category))}</a><time datetime="${p.date}">${bnDate(p.date)}</time></div>
<h1>${esc(p.title)}</h1>
<p class="lead">${esc(p.excerpt)}</p>
${coverSrc ? `<div class="cover"><img src="${esc(coverSrc)}" alt="${esc(p.cover_alt || p.title)}" width="1200" height="630"></div>` : ""}
<div class="prose">${p.body_html}</div>
<aside class="cta"><h2>${esc(cfg.ctaTitle)}</h2><p>${esc(cfg.ctaText)}</p><a href="${esc(cfg.ctaUrl)}">${esc(cfg.ctaButton)}</a></aside>
</article>
${related.length ? `<section class="related"><h2 class="section-title">আরও পড়ুন</h2><div class="grid">${related.map((x) => card(x, root)).join("\n")}</div></section>` : ""}`,
    })
  );
}

// 404 (absolute paths, because it can be served from any depth)
const base = new URL(SITE + "/").pathname;
write(
  "404.html",
  layout({
    root: base,
    title: `পাতাটা পাওয়া যায়নি | ${cfg.siteName}`,
    description: cfg.description,
    canonical: `${SITE}/`,
    body: `<div class="wrap"><div class="empty" style="margin-top:56px"><h1 style="margin:0 0 8px">পাতাটা পাওয়া যায়নি</h1><p>ঠিকানাটা ভুল বা পোস্টটা সরানো হয়েছে।</p><p><a href="${base}">ব্লগের হোমে ফিরে যান</a></p></div></div>`,
  })
);

// sitemap, robots, feed
const urls = [
  { loc: `${SITE}/`, lastmod: posts[0]?.date },
  ...Object.keys(cfg.categories).map((k) => ({ loc: `${SITE}/category/${k}/` })),
  ...posts.map((p) => ({ loc: `${SITE}/posts/${p.slug}/`, lastmod: p.updated || p.date })),
];
write(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `<url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`)
    .join("\n")}\n</urlset>\n`
);
write("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
write(
  "feed.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>\n<title>${esc(cfg.siteName)}</title>\n<link>${SITE}/</link>\n<description>${esc(cfg.description)}</description>\n<language>bn</language>\n${posts
    .slice(0, 30)
    .map((p) => `<item><title>${esc(p.title)}</title><link>${SITE}/posts/${p.slug}/</link><guid>${SITE}/posts/${p.slug}/</guid><pubDate>${new Date(p.date).toUTCString()}</pubDate><description>${esc(p.excerpt)}</description></item>`)
    .join("\n")}\n</channel></rss>\n`
);

console.log(`Built ${posts.length} post(s) → ${OUT}/`);
