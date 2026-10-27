# CloseCircle — Private Instagram-like app for 20 people

A complete, ready-to-run private social app built for a small closed group (max 20 by default).

## ✅ What it can do
- 🔒 **Invite-only signup** — nobody joins without your private code (default `FRIENDS20`, admin can change it in the app). Hard limit of 20 members.
- 🖼️ **Posts feed** — upload photo/video + caption, like ❤️, comment 💬, delete your post
- ⭕ **Stories** — photo/video stories that auto-disappear in 24 hours, with viewer/seen rings
- 💬 **Chat** — 1-to-1 DMs **and** an "Everyone" group chat, in real time
- 📷 **Photo/video in chat** — send media inside any conversation
- 🟢 **Online status** + typing indicator + unread badges
- 👤 **Profiles** — photo, bio, follow/unfollow, post grid
- ♡ **Activity** — likes, comments, follows, messages
- 📱 **Installable on Android** — works as a full-screen app with its own home-screen icon (PWA), no Play Store needed. Android APK source path is also documented in `INSTALL_ANDROID.md`.
- 👑 **Admin** — first/demo admin can see & change the invite code. Demo admin: `priya`

> 📦 First time here? See **[HOW_TO_UPLOAD_TO_GITHUB.md](./HOW_TO_UPLOAD_TO_GITHUB.md)** for uploading this repo to GitHub and deploying it free on Render.

## 🚀 Run it locally (2 minutes)
```bash
npm install
npm start
```
Open http://localhost:4173

**Demo login (already seeded):**
- Username: `priya`  •  Password: `demo123`  (admin)
- Other demo users: `arjunpat`, `sneha`, `Rohan Mehta`, `kavya` — all password `demo123`
- Invite code for *new* signups: `FRIENDS20`

> Before giving it to your real 20 people, delete `data/db.json` to start fresh (or keep demo users), and set a new `JWT_SECRET` and `INVITE_CODE` (see `.env.example`).

## 📱 Install on Android phones (easiest — recommended for 20 people)
Each person:
1. Opens your app link in **Chrome on Android**
2. Taps menu **⋮ → Install app / Add to Home screen**
3. CloseCircle appears as a real app icon and opens full-screen

No Play Store, no APK file to share, updates are automatic when you update the server.

If you specifically want a `.apk` file, see **[INSTALL_ANDROID.md](./INSTALL_ANDROID.md)** — it wraps this exact app with Capacitor in Android Studio.

## 🌐 Put it online so your 20 people can use it from anywhere
You need **one small server** (because your friends' phones must share photos/messages). For 20 people this is tiny — free tiers are usually enough to start.

**Option A — Render (free to start)**
1. Push this folder to a GitHub repo
2. render.com → New → Blueprint / Web Service → connect the repo (this repo includes `render.yaml`)
3. Set `INVITE_CODE` to your secret code, `JWT_SECRET` is auto-generated
4. Deploy → you get a public link like `https://closecircle.onrender.com` → share with your 20 people

**Option B — Railway / Fly.io / a small VPS**
- Use the included `Dockerfile`: `docker build -t closecircle . && docker run -p 4173:4173 -v closecircle-data:/app/data -v closecircle-uploads:/app/uploads closecircle`

**Important about storage:** posts/stories/chat are stored in `data/db.json` and photos/videos in `uploads/`. On your host, attach a **persistent disk/volume** for those two folders, otherwise data resets on redeploy. For 20 people a 1–5 GB disk is plenty to start. Back up `data/` + `uploads/` regularly.

## ⚙️ Settings (environment variables)
| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `4173` | Server port |
| `INVITE_CODE` | `FRIENDS20` | Code required to sign up |
| `MAX_USERS` | `20` | Maximum members allowed |
| `JWT_SECRET` | change me! | Secret for login sessions — set a long random value in production |

## 🗂️ How it works
```
Android phone (installed app) ─┐
Android phone ────────────────┼─►  CloseCircle server (Node.js)  ─► data/db.json + uploads/
Android phone ────────────────┘         │
                                  Socket.IO = live chat / online status
```
- **Backend:** Node.js + Express + Socket.IO (`server.js`)
- **Frontend:** `public/` (HTML/CSS/JS, installable PWA: `manifest.webmanifest` + `sw.js`)
- **Database:** a single JSON file — perfect and simple for 20 users, no database server to manage. If you outgrow it later, move to Postgres/Supabase.
- **Passwords** are hashed (bcrypt), logins use JWT (30-day sessions).

## 🔐 Safety checklist before real use
1. Change `JWT_SECRET` and the invite code; change/remove demo accounts (`demo123`)
2. Only share the invite code with your 20 people
3. Use HTTPS (Render/Railway give this free) — required for Android install & camera/file access
4. Back up `data/db.json` + `uploads/`
5. Agree group rules with members; admin can delete posts

## ✨ Easy next upgrades
Push notifications, Reels-style vertical video feed, story replies, voice notes, video calls (via WebRTC/Jitsi), Supabase/Postgres storage, Play Store release.
