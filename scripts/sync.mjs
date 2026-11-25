// Approve করা পোস্টগুলো AI নিউজ এমপ্লয়ি থেকে এনে posts/ ফোল্ডারে বসায়।
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
const cfg = JSON.parse(readFileSync("site.config.json", "utf8"));
if (!cfg.feedUrl) { console.log("feedUrl নেই, sync বাদ"); process.exit(0); }
let data;
try {
  const r = await fetch(cfg.feedUrl, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error("HTTP " + r.status);
  data = await r.json();
} catch (e) {
  console.log("feed আনা যায়নি, আগের পোস্টই থাকবে:", e.message);
  process.exit(0);
}
function cleanText(x, max) {
  if (typeof x !== "string") return "";
  return x.replace(/<[^>]*>/g, " ").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}
function cleanAction(a) {
  if (!a || typeof a !== "object" || !["prompt", "steps", "scam"].includes(a.kind)) return undefined;
  const out = { kind: a.kind };
  const title = cleanText(a.title, 60); if (title) out.title = title;
  const steps = Array.isArray(a.steps) ? a.steps.map((s) => cleanText(s, 160)).filter(Boolean).slice(0, 5) : [];
  if (steps.length) out.steps = steps;
  const prompt = cleanText(a.prompt, 900); if (prompt) out.prompt = prompt;
  const note = cleanText(a.note, 200); if (note) out.note = note;
  if (a.kind === "prompt" && !prompt) return undefined;
  if (a.kind !== "prompt" && !steps.length) return undefined;
  return out;
}
mkdirSync("posts", { recursive: true });
let changed = 0;
for (const p of data.posts ?? []) {
  if (!p.slug || !/^[a-z0-9-]+$/.test(p.slug) || !p.title || !p.body_html) continue;
  const file = `posts/${p.slug}.json`;
  const old = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const post = { slug: p.slug, title: p.title, meta_title: p.meta_title || old.meta_title || undefined, date: p.date, category: p.category, excerpt: p.excerpt, meta_description: p.meta_description, card_headline: p.card_headline || p.title, tags: p.tags || [], key_points: p.key_points?.length ? p.key_points : old.key_points || [], quick_facts: p.quick_facts?.length ? p.quick_facts : old.quick_facts || [], faq: p.faq?.length ? p.faq : old.faq || [], cover: `assets/covers/${p.slug}.png`, cover_alt: p.card_headline || p.title, body_html: p.body_html };
  // পত্রিকার ঐচ্ছিক ঘর: খবরের ধরন, কাদের জন্য, ভারতে চালু কি না, দাম, নোটিফিকেশনের লাইন
  for (const k of ["news_type", "audience", "india", "price", "push_line"]) { const v = p[k] ?? old[k]; if (v != null && v !== "") post[k] = v; }
  // পাঠকের লাভ আর "আজই করুন" অংশ (যাচাই করে, HTML বাদ দিয়ে)
  const benefit = cleanText(p.benefit, 90) || cleanText(old.benefit, 90);
  if (benefit) post.benefit = benefit;
  const action = cleanAction(p.action) || cleanAction(old.action);
  if (action) post.action = action;
  // আপনার পাঠানো ছবি (থাকলে) নামিয়ে রাখি
  if (p.photo_url && /^https:\/\//.test(p.photo_url)) {
    const ext = (p.photo_url.split("?")[0].match(/\.(jpe?g|png|webp)$/i)?.[1] || "jpg").toLowerCase();
    const dest = `assets/photos/${p.slug}.${ext}`;
    const prev = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
    if (prev.photo_url !== p.photo_url || !existsSync(dest)) {
      try {
        const r = await fetch(p.photo_url, { signal: AbortSignal.timeout(30000) });
        if (r.ok) { mkdirSync("assets/photos", { recursive: true }); writeFileSync(dest, Buffer.from(await r.arrayBuffer())); }
      } catch (e) { console.log("ছবি নামানো যায়নি:", p.slug, e.message); }
    }
    if (existsSync(dest)) { post.photo = dest; post.photo_url = p.photo_url; post.photo_alt = p.card_headline || p.title; }
  }
  const next = JSON.stringify(post, null, 2) + "\n";
  if (!existsSync(file) || readFileSync(file, "utf8") !== next) { writeFileSync(file, next); changed++; }
}
console.log(`sync: ${data.posts?.length ?? 0} পোস্ট, ${changed} নতুন/বদল`);
