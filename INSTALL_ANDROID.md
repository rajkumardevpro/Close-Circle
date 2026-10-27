# Install CloseCircle on Android

You have **two** ways. Way 1 is what most private groups of 20 should use.

---

## ✅ Way 1 — Install as an app from the link (no APK, recommended)
This is a real install: icon on home screen, full-screen, opens like Instagram. It is how the app in this folder is designed to be used.

**For each of your 20 people (30 seconds):**
1. Send them your app link (your live server URL, must be `https://…`)
2. They open it in **Chrome (Android)**
3. Tap **⋮ (menu) → Install app** (or "Add to Home screen") → **Install**
4. Open **CloseCircle** from the home screen and sign up with the invite code

Advantages: no Play Store review, no APK warnings, when you update the server everyone gets the update automatically.

> The test/preview link from a coding session is temporary. For permanent use by your 20 people, first deploy the server (see README → "Put it online"), then share that permanent `https://` link.

---

## 📦 Way 2 — Build a real `.apk` file (Capacitor + Android Studio)
Use this if you specifically need an APK to send on WhatsApp / upload to Play Store. This wraps the same CloseCircle web app in a native Android shell. Your server still needs to be deployed online first — the APK connects to it.

**You need:** a computer with [Android Studio](https://developer.android.com/studio) (free, includes the Android SDK + Java 17).

```bash
# in the closecircle folder, on your computer
npm install
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init CloseCircle com.yourname.closecircle --web-dir=public
```

Then edit the generated `capacitor.config.json` so the app loads your live server (so chat/photos work):

```json
{
  "appId": "com.yourname.closecircle",
  "appName": "CloseCircle",
  "webDir": "public",
  "server": { "url": "https://YOUR-SERVER-URL", "cleartext": false }
}
```

```bash
npx cap add android
npx cap sync android
npx cap open android
```

In Android Studio:
1. Wait for Gradle sync to finish
2. Replace the app icon with `public/icons/icon-1024.png` (right-click `res` → New → Image Asset)
3. **Build → Build App Bundle(s) / APK(s) → Build APK(s)**
4. The file appears at `android/app/build/outputs/apk/debug/app-debug.apk`
5. Send that APK to your 20 people, or build a *signed release* APK/AAB for Play Store (Build → Generate Signed Bundle/APK)

Installing a shared APK: Android will ask to allow "Install unknown apps" — that's normal for direct APKs. The Play Store route avoids that warning but needs a $25 developer account and review.

---

## Which should you choose?
| | Way 1: Install from link | Way 2: APK |
|---|---|---|
| Time | 30 seconds per person | ~30–60 min first build |
| Play Store needed | No | No (but needed to avoid "unknown apps" warning) |
| Updates | Automatic | Send a new APK every update |
| Works on iPhone too | Yes | No, Android only |

For a private group of 20, **Way 1 wins** almost every time.
