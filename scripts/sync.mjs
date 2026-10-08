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
  const post = { slug: p.slug, title: p.title, date: p.date, category: p.category, excerpt: p.excerpt, meta_description: p.meta_description, card_headline: p.card_headline || p.title, tags: p.tags || [], cover: `assets/covers/${p.slug}.png`, cover_alt: p.card_headline || p.title, body_html: p.body_html };
  const next = JSON.stringify(post, null, 2) + "\n";
  if (!existsSync(file) || readFileSync(file, "utf8") !== next) { writeFileSync(file, next); changed++; }
}
console.log(`sync: ${data.posts?.length ?? 0} পোস্ট, ${changed} নতুন/বদল`);
