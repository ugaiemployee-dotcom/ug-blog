# Unique AI পত্রিকা

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
| `news_type` | ঐচ্ছিক: `new-tool`, `update`, `free-offer`, `jobs-income`, `education`, `govt-policy`, `scam-alert`, `india-bengal`, `research`। না থাকলে প্রথম ট্যাগ বা বিষয় থেকে ধরা হয় |
| `audience` | ঐচ্ছিক তালিকা: `student`, `teacher`, `business`, `creator`, `jobseeker`। না থাকলে ট্যাগ থেকে |
| `india` / `price` | ঐচ্ছিক: `available`/`soon`/`no` আর `free`/`freemium`/`paid`। না থাকলে quick_facts-এর "ভারতে" আর "খরচ" থেকে |
| `push_line` | ঐচ্ছিক: নোটিফিকেশনের লাইন (না থাকলে card_headline) |

সাইটের নাম, ঠিকানা, বিভাগ ও বোতামের লিংক বদলাতে `site.config.json` দেখুন। ডোমেইন বদলাতে শুধু `site.config.json`-এর `siteUrl` আর `CNAME` ফাইল বদলান। নোটিফিকেশন চালু করতে `pushEnabled: true` করুন (ব্যাকএন্ড তৈরি হওয়ার পরে)।

নিজের কম্পিউটারে দেখতে: `node build.mjs`, তারপর `dist/index.html` খুলুন।
