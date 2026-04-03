# ✦ USFLIX — Shree & Ritanshu's Private Netflix

A never-ending love series. No cancellations. No finales.

---

## 🚀 Deploy to Vercel (Step by Step)

### Step 1 — Install Vercel CLI
Open your terminal and run:
```bash
npm install -g vercel
```

### Step 2 — Login to Vercel
```bash
vercel login
```
It'll open a browser — just click confirm.

### Step 3 — Go into the project folder
```bash
cd usflix
```

### Step 4 — Deploy!
```bash
vercel
```
Follow the prompts:
- Set up and deploy? → **Y**
- Which scope? → your account
- Link to existing project? → **N**
- Project name? → `usflix` (or anything cute)
- Which directory is your code? → `.` (just press Enter)

You'll get a live URL like: `usflix-xyz.vercel.app` 🎉

---

## 💾 Add Permanent Storage (so memories never disappear)

After deploying, add these two free Vercel add-ons:

### Vercel KV (saves your episodes list)
```bash
vercel storage create kv
```
Then link it:
```bash
vercel env pull
```

### Vercel Blob (saves your video files)
Go to your Vercel dashboard → Storage → Create → Blob Store
Then in your project settings, it'll auto-connect.

---

## 🎬 How Video Uploads Work

1. Open your USFLIX site
2. Scroll to "Add a New Episode"
3. Fill in the title, date, note, mood
4. Click "Browse files" and pick a video from your phone or laptop
5. Hit Save — it uploads to Vercel Blob and lives there forever

---

## 📁 File Structure

```
usflix/
├── public/
│   └── index.html        ← The whole beautiful frontend
├── api/
│   └── episodes.js       ← Serverless backend (saves episodes + videos)
├── vercel.json           ← Vercel config
├── package.json          ← Dependencies
└── README.md             ← This file
```

---

## 💌 Made with love for Shree & Ritanshu
*No cancellations. No finales. Just us.*
