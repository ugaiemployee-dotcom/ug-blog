# Unique Gurukul ব্লগ

`posts/` ফোল্ডারে একটা `.json` ফাইল যোগ হলেই নতুন পোস্ট তৈরি হয়। `main` শাখায় push হলে GitHub Actions নিজে থেকে সাইট বানিয়ে GitHub Pages-এ প্রকাশ করে।

## পোস্ট ফাইলের গঠন (`posts/<slug>.json`)

| ঘর | কাজ |
|---|---|
| `slug` | ঠিকানার অংশ, ইংরেজি ছোট হরফ ও হাইফেন |
| `title` | পোস্টের শিরোনাম |
| `date` | `YYYY-MM-DD` |
| `category` | `ai-tools`, `vibe-coding`, `automation`, `ai-income` |
| `excerpt` | ১-২ লাইনের সারাংশ |
| `meta_description` | Google-এর জন্য বর্ণনা |
| `cover` | ছবির পথ (যেমন `assets/covers/x.png`) বা `null` |
| `body_html` | পোস্টের মূল লেখা, HTML |
| `status` | `draft` দিলে প্রকাশ হবে না |

সাইটের নাম, ঠিকানা, বিভাগ ও বোতামের লিংক বদলাতে `site.config.json` দেখুন। নিজের ডোমেইনে নিতে `siteUrl` বদলে মূল ফোল্ডারে `CNAME` ফাইল যোগ করুন।

নিজের কম্পিউটারে দেখতে: `node build.mjs`, তারপর `dist/index.html` খুলুন।
