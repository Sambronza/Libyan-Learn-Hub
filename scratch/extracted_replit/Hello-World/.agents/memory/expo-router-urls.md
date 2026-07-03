---
name: Expo Router URL format
description: How Expo Router maps tab group file paths to web URLs
---

In Expo Router's web mode, route group parentheses are stripped from URLs.

**Rule:** `app/(tabs)/academy.tsx` → URL is `/academy`, NOT `/(tabs)/academy`

**Why:** Expo Router uses "route groups" (parentheses folders) as layout organizers that don't appear in the final URL. Navigating to `/(tabs)/academy` directly shows a blank screen because the URL doesn't match any registered route.

**How to apply:** When screenshotting or linking to tab screens in the mobile app, use `/academy`, `/courses`, `/profile` etc., not `/(tabs)/academy`.
