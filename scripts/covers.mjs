// প্রতিটা পোস্টের জন্য Unique AI পত্রিকা-র নিউজ কার্ড (1200x630 PNG) বানায়: assets/covers/<slug>.png
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
const cfg = JSON.parse(readFileSync("site.config.json", "utf8"));
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
mkdirSync("assets/covers", { recursive: true });

// লোগো একবার নামিয়ে রাখি
if (!existsSync("assets/logo.webp") && cfg.logoSourceUrl) {
  try {
    const r = await fetch(cfg.logoSourceUrl, { signal: AbortSignal.timeout(20000) });
    if (r.ok) writeFileSync("assets/logo.webp", Buffer.from(await r.arrayBuffer()));
  } catch (e) { console.log("লোগো নামানো যায়নি:", e.message); }
}
const logo = existsSync("assets/logo.webp") ? "data:image/webp;base64," + readFileSync("assets/logo.webp").toString("base64") : "";
const b64 = (f) => "data:font/woff2;base64," + readFileSync("assets/fonts/" + f).toString("base64");
const fonts = [600, 700].map((w) => `@font-face{font-family:HS;font-weight:${w};src:url(${b64(`hind-siliguri-bengali-${w}-normal.woff2`)}) format("woff2")}@font-face{font-family:HSL;font-weight:${w};src:url(${b64(`hind-siliguri-latin-${w}-normal.woff2`)}) format("woff2")}`).join("");

const todo = [];
for (const f of readdirSync("posts").filter((f) => f.endsWith(".json"))) {
  const p = JSON.parse(readFileSync("posts/" + f, "utf8"));
  const out = `assets/covers/${p.slug}.png`;
  if (p.slug && (process.argv.includes("--all") || !existsSync(out))) todo.push({ p, out });
}
if (!todo.length) { console.log("covers: নতুন কিছু নেই"); process.exit(0); }

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const { p, out } of todo) {
  const head = p.card_headline || p.title;
  const size = head.length > 46 ? 64 : head.length > 30 ? 74 : 86;
  // খবরের ধরন: প্রথম ট্যাগ ধরনের নাম হলে সেটা, নইলে বিষয় থেকে
  const types = cfg.newsTypes || [];
  const tkey = types.some((t) => t.key === p.news_type) ? p.news_type : (types.find((t) => t.label === String((p.tags || [])[0] || "").trim()) || {}).key || cfg.typeFromCategory?.[p.category];
  const label = (types.find((t) => t.key === tkey) || {}).label || cfg.categories[p.category] || "AI খবর";
  const tc = { "scam-alert": "#B42318", "free-offer": "#067647", "jobs-income": "#7E5410" }[tkey] || "#5D16E9";
  await page.setContent(`<html><head><style>
${fonts}
*{box-sizing:border-box}
body{margin:0;width:1200px;height:630px;font-family:HSL,HS;color:#17131F;background:#fff;position:relative;overflow:hidden}
.top{position:absolute;left:72px;right:72px;top:50px;display:flex;align-items:flex-end;padding-bottom:18px;border-bottom:6px double #17131F}
.wm{line-height:1}.wm small{display:block;font-size:20px;font-weight:600;color:#5D16E9;letter-spacing:.1em;margin-bottom:6px}.wm b{font-size:46px;font-weight:700}
.chip{margin-left:auto;display:flex;align-items:center;gap:12px;color:${tc};font-size:28px;font-weight:700}
.chip i{width:16px;height:16px;background:${tc}}
h1{position:absolute;left:72px;right:72px;top:198px;margin:0;font-size:${size}px;line-height:1.34;font-weight:700;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.foot{position:absolute;left:72px;right:72px;bottom:46px;display:flex;align-items:center;gap:22px;font-size:25px;font-weight:600;color:#3B3647;padding-top:20px;border-top:2px solid #C9922A}
.foot b{margin-left:auto;color:#5D16E9;font-weight:700}
.bar{position:absolute;left:0;bottom:0;width:100%;height:12px;background:#5D16E9}
</style></head><body>
<div class="top"><div class="wm"><small>Unique</small><b>AI পত্রিকা</b></div><div class="chip"><i></i>${esc(label)}</div></div>
<h1>${esc(head)}</h1>
<div class="foot"><span>${esc(cfg.motto || "AI-এর খবর, বাংলার আলোয়")}</span><b>${esc(cfg.siteUrl.replace(/^https?:\/\//, "").replace(/\/+$/, ""))}</b></div>
<div class="bar"></div></body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  await page.screenshot({ path: out });
  console.log("cover:", out);
}
await browser.close();
