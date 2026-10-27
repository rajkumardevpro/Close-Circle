# How to upload CloseCircle to GitHub (easy way — no coding)

This folder is 100% ready for GitHub. Total: ~20 small files. 
`node_modules` is **intentionally not included** — GitHub/Render creates it automatically from `package.json`. Do not add it back.

## Method 1 — Website only (recommended for beginners)

1. Download `CloseCircle-GitHub-Ready.zip` to your computer/phone and **extract/unzip it**
2. Open the extracted **`closecircle-github`** folder — you should directly see `server.js`, `package.json`, `public/`, `README.md` (not another folder inside a folder)
3. Go to **github.com** → log in → click **+** (top-right) → **New repository**
4. Repository name: `closecircle` → select **Public** (needed for free Render deploy) → **do NOT** tick "Add a README" → click **Create repository**
5. On the next page click the link: **"uploading an existing file"**
6. Open your extracted folder, **select ALL files and folders inside it** (`.env.example`, `Dockerfile`, `public/`, `server.js`, everything) and drag them onto the GitHub page
   - ⚠️ Important: upload the *contents* of the folder — **not the .zip file itself**
   - If `.gitignore` or `.env.example` don't appear, that can happen because they start with a dot. On Windows: File Explorer → View → Show → Hidden items. If you miss just these two, the app still works.
7. Scroll down → click green **Commit changes**
8. ✅ Done! Your code is now on GitHub, e.g. `github.com/YOUR-USERNAME/closecircle`

## Method 2 — With Git (if you have Git installed)

```bash
cd closecircle-github
git init
git add .
git commit -m "CloseCircle v1 - private social app for 20"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/closecircle.git
git push -u origin main
```
(Create the empty repository on github.com first, same as step 3–4 above.)

## Next step — put it online free on Render (so your 20 people can use it)

1. Go to **render.com** → sign up with GitHub
2. **New → Web Service** → connect your `closecircle` repository
3. Render will detect the included `render.yaml` (Blueprint), or set manually:
   - Build Command: `npm install`
   - Start Command: `node server.js`
4. Add Environment Variables: `INVITE_CODE` = your secret code, `MAX_USERS` = `20` (JWT secret is auto-generated)
5. Click **Deploy** → wait 2–3 minutes → you get a permanent link like `https://closecircle.onrender.com`
6. Share that link + invite code only with your 20 people. On Android: open in Chrome → ⋮ → **Install app**

> GitHub alone cannot *run* this app (GitHub only stores code — it is not a server). Render (step above) is the server that runs it 24x7.

## What's in this repository

| File / folder | Purpose |
|---|---|
| `server.js` | Server — login, posts, stories, live chat |
| `public/` | The app screens (what users see) |
| `package.json` / `package-lock.json` | List of libraries to install |
| `render.yaml` | One-click deploy settings for Render |
| `Dockerfile` | Alternative deploy (Railway / Fly.io / VPS) |
| `.env.example` | Example settings (invite code, secret) — copy to `.env` for local use, never commit `.env` |
| `.gitignore` | Keeps `node_modules`, secrets & uploads out of GitHub |
| `data/` , `uploads/` | Empty in GitHub (`.gitkeep`) — the server fills them at runtime |
| `INSTALL_ANDROID.md` | Install on Android + optional APK build |

## Common mistakes to avoid
- ❌ Uploading the `.zip` file to GitHub → ✅ extract first, upload contents
- ❌ Uploading `node_modules` (thousands of files, upload will fail) → ✅ it's excluded already
- ❌ Uploading the folder-inside-a-folder (`closecircle-github/closecircle-github/server.js`) → ✅ `server.js` should be visible on your repo's main page
