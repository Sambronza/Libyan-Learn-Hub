---
name: Expo tab badge crash
description: tabBarBadge with emoji characters causes blank tab screen in Expo web
---

**Rule:** Do not use emoji characters as `tabBarBadge` values in Expo Router tab layouts when the app runs on web.

**Why:** `tabBarBadge: "✨"` with custom `tabBarBadgeStyle` (including `lineHeight`) causes the entire tab screen to render blank on web. No error is surfaced in the browser console — the screen just silently shows white.

**How to apply:** If a badge is needed, use a number or short plain string (e.g. `tabBarBadge: "NEW"`), or omit the badge entirely. Remove `lineHeight` from `tabBarBadgeStyle` as it may also contribute.
