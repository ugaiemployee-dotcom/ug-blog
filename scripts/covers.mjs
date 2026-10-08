// প্রতিটা পোস্টের জন্য ব্র্যান্ডেড নিউজ কার্ড (1200x630 PNG) বানায়: assets/covers/<slug>.png
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
  const size = head.length > 46 ? 62 : head.length > 30 ? 72 : 84;
  await page.setContent(`<html><head><style>
${fonts}
*{box-sizing:border-box}
body{margin:0;width:1200px;height:630px;font-family:HSL,HS;color:#fff;background:linear-gradient(135deg,#6A24F2 0%,#5D16E9 45%,#4A0FC2 100%);position:relative;overflow:hidden}
.ring{position:absolute;border-radius:50%;border:2px solid rgba(255,255,255,.10)}
.r1{width:620px;height:620px;right:-180px;top:-220px}.r2{width:420px;height:420px;right:-80px;top:-120px;border-color:rgba(240,190,92,.28)}
.dots{position:absolute;left:0;bottom:16px;width:100%;height:210px;background-image:radial-gradient(rgba(255,255,255,.10) 2px,transparent 2px);background-size:26px 26px;-webkit-mask-image:linear-gradient(transparent,#000)}
.top{position:absolute;left:72px;top:56px;right:72px;display:flex;align-items:center;gap:18px}
.logo{height:76px;width:76px;background:#fff;border-radius:18px;display:flex;align-items:center;justify-content:center;padding:8px}
.logo img{max-width:100%;max-height:100%}
.brand{font-size:32px;font-weight:700;line-height:1.2}.brand small{display:block;font-size:20px;font-weight:600;color:#F0BE5C}
.chip{margin-left:auto;background:#F0BE5C;color:#231A3A;font-size:26px;font-weight:700;padding:8px 26px;border-radius:999px}
h1{position:absolute;left:72px;right:72px;top:190px;margin:0;font-size:${size}px;line-height:1.32;font-weight:700;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.foot{position:absolute;left:72px;right:72px;bottom:52px;display:flex;align-items:center;font-size:27px;font-weight:600;color:#EEE6FF}
.foot b{margin-left:auto;color:#fff;font-weight:700}
.bar{position:absolute;left:0;bottom:0;width:100%;height:16px;background:linear-gradient(90deg,#C9922A,#F0BE5C,#C9922A)}
</style></head><body>
<div class="ring r1"></div><div class="ring r2"></div><div class="dots"></div>
<div class="top">${logo ? `<div class="logo"><img src="${logo}"></div>` : ""}<div class="brand">${esc(cfg.brand)}<small>AI আপডেট</small></div><div class="chip">${esc(cfg.categories[p.category] || "AI খবর")}</div></div>
<h1>${esc(head)}</h1>
<div class="foot"><span>সহজ বাংলায় AI-এর খবর</span><b>${esc(cfg.mainSiteUrl.replace(/^https?:\/\//, ""))}</b></div>
<div class="bar"></div></body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  await page.screenshot({ path: out });
  console.log("cover:", out);
}
await browser.close();
