// Unique AI পত্রিকা: নতুন খবরের Web Push পাঠায় (deploy-এর পরে চলে)।
// নিরাপত্তা: সিক্রেট শুধু env থেকে (PATRIKA_PUSH_SECRET), কখনো লগ হয় না।
// "নতুন" ঠিক করা: সবচেয়ে নতুন ৫টা পোস্ট (শেষ ২ দিনের) পাঠানো হয়; সার্ভারের sent-log
// নিশ্চিত করে প্রতিটা slug জীবনে একবারই যায়, তাই বারবার চালালেও ডুপ্লিকেট হয় না।
import { readFileSync, readdirSync, existsSync } from "node:fs";

const cfg = JSON.parse(readFileSync("site.config.json", "utf8"));
const secret = process.env.PATRIKA_PUSH_SECRET || "";
const enabled = cfg.pushEnabled === true || process.env.PUSH_ENABLED === "true";
if (!enabled) { console.log("push: বন্ধ (pushEnabled false), কিছু পাঠানো হল না"); process.exit(0); }
if (process.env.PUSH_ENABLED === "false") { console.log("push: repo variable দিয়ে বন্ধ"); process.exit(0); }
if (!secret) { console.log("push: PATRIKA_PUSH_SECRET নেই, বাদ"); process.exit(0); }

const SITE = String(cfg.siteUrl || "").replace(/\/+$/, "");
const API = cfg.pushApi || `${String(cfg.supabaseUrl || "").replace(/\/+$/, "")}/functions/v1/patrika-push`;
if (!/^https:\/\//.test(SITE) || !/^https:\/\//.test(API)) { console.log("push: siteUrl/pushApi ঠিক নেই, বাদ"); process.exit(0); }

const nf = (s) => String(s ?? "").normalize("NFC").trim();
const TYPES = cfg.newsTypes || [];
const TYPE = new Set(TYPES.map((t) => t.key));
const TYPE_BY_LABEL = Object.fromEntries(TYPES.map((t) => [nf(t.label), t.key]));
const newsType = (p) => (TYPE.has(p.news_type) ? p.news_type : TYPE_BY_LABEL[nf((p.tags || [])[0])] || cfg.typeFromCategory?.[p.category] || null);

const MAX = Number(process.env.PUSH_MAX_POSTS || 5);
const cutoff = Date.now() - 2 * 864e5; // শুধু শেষ ২ দিনের পোস্ট
const posts = (existsSync("posts") ? readdirSync("posts") : [])
  .filter((f) => f.endsWith(".json"))
  .map((f) => { try { return JSON.parse(readFileSync(`posts/${f}`, "utf8")); } catch { return null; } })
  .filter((p) => p && /^[a-z0-9-]+$/.test(p.slug || "") && p.title && p.date && new Date(p.date).getTime() >= cutoff)
  .sort((a, b) => String(b.date).localeCompare(String(a.date)))
  .slice(0, MAX)
  .map((p) => ({
    slug: p.slug,
    title: p.title,
    push_line: p.push_line || p.card_headline || p.title,
    news_type: newsType(p),
    url: `${SITE}/posts/${p.slug}/`,
    image: p.photo ? `${SITE}/${p.photo}` : p.cover ? `${SITE}/${p.cover}` : undefined,
  }));

if (!posts.length) { console.log("push: নতুন পোস্ট নেই"); process.exit(0); }

let pending = posts;
let failed = false;
for (let round = 1; round <= 6 && pending.length; round++) {
  let j;
  try {
    const r = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ug-secret": secret },
      body: JSON.stringify({ action: "send", posts: pending }),
      signal: AbortSignal.timeout(120000),
    });
    j = await r.json().catch(() => ({}));
    if (!r.ok) { console.log(`push: সার্ভার ${r.status} ${j.error || ""}`); failed = true; break; }
  } catch (e) { console.log("push: অনুরোধ ব্যর্থ:", e.message); failed = true; break; }
  for (const x of j.posts || []) console.log(`push: ${x.slug} → ${x.status} (sent ${x.sent}, cap ${x.skipped_cap}, gone ${x.gone}, failed ${x.failed}${x.remaining ? `, বাকি ${x.remaining}` : ""})`);
  if (j.quiet_hours) console.log("push: রাতের নীরব সময় (২২:৩০–০৭:০০ IST), এই পোস্টগুলো আর পাঠানো হবে না");
  const left = new Set((j.posts || []).filter((x) => ["partial", "not_started", "busy"].includes(x.status)).map((x) => x.slug));
  pending = pending.filter((p) => left.has(p.slug));
  if (pending.length) await new Promise((res) => setTimeout(res, 5000));
}
if (pending.length && !failed) console.log(`push: ${pending.length}টা পোস্ট পুরো যায়নি, পরের deploy-এ আবার চেষ্টা হবে`);
process.exit(failed ? 1 : 0);
