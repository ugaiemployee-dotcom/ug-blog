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
mkdirSync("posts", { recursive: true });
let changed = 0;
for (const p of data.posts ?? []) {
  if (!p.slug || !/^[a-z0-9-]+$/.test(p.slug) || !p.title || !p.body_html) continue;
  const file = `posts/${p.slug}.json`;
  const old = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const post = { slug: p.slug, title: p.title, meta_title: p.meta_title || old.meta_title || undefined, date: p.date, category: p.category, excerpt: p.excerpt, meta_description: p.meta_description, card_headline: p.card_headline || p.title, tags: p.tags || [], key_points: p.key_points?.length ? p.key_points : old.key_points || [], quick_facts: p.quick_facts?.length ? p.quick_facts : old.quick_facts || [], faq: p.faq?.length ? p.faq : old.faq || [], cover: `assets/covers/${p.slug}.png`, cover_alt: p.card_headline || p.title, body_html: p.body_html };
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
