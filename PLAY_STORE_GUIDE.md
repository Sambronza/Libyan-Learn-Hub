# 📱 Publishing EduLibya to Google Play — Step by Step

iOS is skipped for now (Apple requires a $99/year account). Android needs a
**one-time $25** Google Play developer fee.

## 1. Create the Google Play developer account (~15 min)
1. Go to https://play.google.com/console/signup
2. Sign in with the Google account you want to own the app (use a business
   account you won't lose access to).
3. Choose account type (Personal is fine to start), pay the **$25 one-time fee**.
4. Complete identity verification (Google may take 1–2 days to verify).

## 2. Build the production Android app (AAB)
From your machine (needs your Expo account `essamku.usa` logged in):

```bash
cd artifacts/lms-mobile
npx eas login                       # once
npx eas build -p android --profile production
```

- EAS builds in the cloud and **manages the signing key for you** (keep it that
  way — losing a local keystore means you can never update the app).
- The result is an `.aab` file — download it from the link EAS prints
  (or from https://expo.dev → your project → Builds).
- `autoIncrement` is already configured, so every build bumps the version code
  automatically.

## 3. Create the app in Play Console
1. Play Console → **Create app**
   - Name: `EduLibya`
   - Default language: Arabic
   - App type: App, Free
2. Complete the **required declarations** (Dashboard shows a checklist):
   - **Privacy policy URL** — REQUIRED. Host a simple page (e.g.
     `https://eduonline.net.ly/privacy`) describing what data you collect.
     ⚠️ Because the app collects **face images and biometric identifiers**,
     the policy MUST mention this explicitly and explain why (account
     security/identity verification) and how users can delete their data.
   - **Data safety form** — declare: email, name, phone (Account info),
     face images (Biometric — used for app functionality/security, encrypted
     in transit, deletable on request), payment info (wallet).
   - Content rating questionnaire (Education app → usually rated 3+).
   - Target audience: 13+ (safest — under-13 triggers heavy Families policy).
   - Ads declaration: No ads.

## 4. Upload and release
1. Play Console → **Testing → Internal testing** → Create release →
   upload the `.aab` → add your own email as a tester → roll out.
   Install it from the tester link and smoke-test on a real phone
   (login, purchase with a test wallet, face capture, video playback).
2. When happy: **Production → Create release** → upload the same `.aab` →
   fill the store listing:
   - Short description (80 chars, Arabic): e.g. "منصة التعلم الليبية — دورات، جلسات مباشرة، ودروس خصوصية"
   - Full description, screenshots (min 2 phone screenshots), app icon 512×512,
     feature graphic 1024×500.
3. Submit for review. First review usually takes **1–7 days**.

## 5. After approval
1. Copy the Play Store URL:
   `https://play.google.com/store/apps/details?id=com.essamku.learn`
2. Set it in the web app env (Vercel → Environment Variables):
   `VITE_ANDROID_APP_URL=https://play.google.com/store/apps/details?id=com.essamku.learn`
   → the "Open in app" banner on the mobile website starts pointing there
   automatically (it stays hidden until this is set).

## Updating the app later
```bash
npx eas build -p android --profile production   # new build, auto-versioned
```
Upload the new `.aab` in Play Console → Production → New release. (You can also
look into `eas submit -p android` to automate uploads later.)

## iOS (when you can afford it)
The project is already configured (`bundleIdentifier: com.essamku.learn`).
When you get the $99/year Apple Developer account:
```bash
npx eas build -p ios --profile production
npx eas submit -p ios
```
Note: Apple reviews biometric/face features strictly — the same privacy policy
requirements apply, plus a purpose string (already handled by the expo-camera
plugin config).
