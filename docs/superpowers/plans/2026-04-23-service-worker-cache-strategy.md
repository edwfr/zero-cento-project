# Service Worker Cache Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the service worker to never cache HTML documents or API responses, and use CacheFirst for all truly immutable assets (Next.js static chunks, fonts, app images).

**Architecture:** Replace the current `src/sw.ts` with explicit, intentional caching rules. Filter `__SW_MANIFEST` to exclude HTML pages (precache only `_next/static/` and known static file extensions). Remove API caching entirely (NetworkOnly). Add explicit NetworkOnly for navigation requests. Use CacheFirst + ExpirationPlugin for fonts, app images, and external images. Remove `...defaultCache` (Workbox defaults can silently cache HTML).

**Tech Stack:** Serwist v9, `serwist` npm package (`CacheFirst`, `NetworkOnly`, `StaleWhileRevalidate`, `ExpirationPlugin` all exported from `serwist`)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/sw.ts` | Service worker runtime caching strategy |
| Modify | `implementation-docs/CHANGELOG.md` | Changelog entry |

No new files. No unit tests for service worker (SW cannot be tested in jsdom; manual DevTools verification is the standard).

---

## Current State (for reference)

`src/sw.ts` currently:
- Precaches `self.__SW_MANIFEST` (includes HTML pages — bad)
- Caches API responses with `NetworkFirst` (data changes frequently — bad)
- Uses `...defaultCache` (Workbox defaults silently cache HTML — bad)
- Images → `StaleWhileRevalidate` (no expiration limits)
- Fonts → `StaleWhileRevalidate` (fonts are immutable, `CacheFirst` is better)

---

## Task 1: Rewrite `src/sw.ts`

**Files:**
- Modify: `src/sw.ts`

- [ ] **Step 1: Replace the full content of `src/sw.ts`**

```typescript
import {
    CacheFirst,
    ExpirationPlugin,
    NetworkOnly,
    Serwist,
    StaleWhileRevalidate,
} from 'serwist'

declare const self: Window &
    typeof globalThis & {
        __SW_MANIFEST: (string | { url: string; revision: string | null })[]
    }

// Precache only immutable assets: Next.js hashed chunks and known static file types.
// HTML pages are intentionally excluded — always fetch fresh from network.
const staticEntries = self.__SW_MANIFEST.filter((entry) => {
    const url = typeof entry === 'string' ? entry : entry.url
    return (
        url.startsWith('/_next/static/') ||
        /\.(png|jpe?g|gif|webp|svg|ico|json|woff2?|ttf|otf|eot)$/i.test(url)
    )
})

const serwist = new Serwist({
    precacheEntries: staticEntries,
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: true,
    runtimeCaching: [
        // HTML navigation → NetworkOnly: always fetch fresh, never serve stale HTML.
        // Stale HTML references old JS chunk hashes → broken app after deploy.
        {
            matcher: ({ request }) => request.mode === 'navigate',
            handler: new NetworkOnly(),
        },
        // API routes → NetworkOnly: data changes frequently, caching causes stale reads.
        {
            matcher: /\/api\//,
            handler: new NetworkOnly(),
        },
        // Next.js static chunks → CacheFirst: content-hashed URLs are immutable.
        // Already precached above; this runtime rule covers any cache misses.
        {
            matcher: /^\/_next\/static\//,
            handler: new CacheFirst({
                cacheName: 'next-static',
                plugins: [
                    new ExpirationPlugin({
                        maxAgeSeconds: 365 * 24 * 60 * 60,
                    }),
                ],
            }),
        },
        // App images (/images/*) → CacheFirst: static files, change only on deploy.
        {
            matcher: /\/images\//,
            handler: new CacheFirst({
                cacheName: 'app-images',
                plugins: [
                    new ExpirationPlugin({
                        maxEntries: 60,
                        maxAgeSeconds: 30 * 24 * 60 * 60,
                    }),
                ],
            }),
        },
        // Google Fonts CSS → CacheFirst: URLs are versioned by Google.
        {
            matcher: /^https:\/\/fonts\.googleapis\.com\//,
            handler: new CacheFirst({
                cacheName: 'google-fonts-stylesheets',
                plugins: [
                    new ExpirationPlugin({
                        maxAgeSeconds: 365 * 24 * 60 * 60,
                    }),
                ],
            }),
        },
        // Google Fonts files → CacheFirst: font file URLs are immutable.
        {
            matcher: /^https:\/\/fonts\.gstatic\.com\//,
            handler: new CacheFirst({
                cacheName: 'google-fonts-webfonts',
                plugins: [
                    new ExpirationPlugin({
                        maxAgeSeconds: 365 * 24 * 60 * 60,
                    }),
                ],
            }),
        },
        // YouTube thumbnails → StaleWhileRevalidate: external, can change.
        {
            matcher: /^https:\/\/(?:img\.youtube\.com|i\.ytimg\.com)\//,
            handler: new StaleWhileRevalidate({
                cacheName: 'external-images',
                plugins: [
                    new ExpirationPlugin({
                        maxEntries: 100,
                        maxAgeSeconds: 7 * 24 * 60 * 60,
                    }),
                ],
            }),
        },
    ],
})

serwist.addEventListeners()
```

- [ ] **Step 2: Run type-check**

```bash
npm run type-check 2>&1 | grep -v "layout.tsx"
```

Expected output: no errors (2 pre-existing errors in `layout.tsx` about `Metadata`/`Viewport` are unrelated — ignore those).

If new errors appear, fix them before proceeding.

- [ ] **Step 3: Verify build compiles SW**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds, `public/sw.js` generated. If build fails due to SW compilation error, fix before committing.

Note: SW is disabled in development (`disable: process.env.NODE_ENV === 'development'` in `next.config.mjs`), so `npm run dev` won't exercise it.

- [ ] **Step 4: Commit**

```bash
git add src/sw.ts
git commit -m "feat(sw): cache only immutable assets; never cache HTML or API responses"
```

---

## Task 2: Manual Verification Steps (non-blocking)

**No files changed.** This task documents how to verify the SW works correctly in production mode.

- [ ] **Step 5: Build and serve in production mode**

```bash
npm run build && npx serve@latest out 2>/dev/null || npm start
```

Open `http://localhost:3000` in Chrome.

- [ ] **Step 6: Inspect SW in DevTools**

1. DevTools → Application → Service Workers
2. Verify SW is registered and status is "activated and is running"
3. Application → Cache Storage — verify these caches exist:
   - `next-static` (JS/CSS chunks)
   - `app-images` (if any `/images/` requests made)
   - `google-fonts-*` (if fonts loaded)
4. Verify these caches do NOT exist:
   - `api-cache` (removed)
   - `images-cache` (removed, replaced with `app-images`)
   - `fonts-cache` (removed, replaced with `google-fonts-*`)

- [ ] **Step 7: Verify HTML not cached**

1. DevTools → Network → filter by "Doc"
2. Reload page — document request should show "(from network)" NOT "(from ServiceWorker)"
3. Alternatively: Application → Cache Storage — no HTML URLs should appear in any cache

- [ ] **Step 8: Verify API not cached**

1. DevTools → Network → filter by "Fetch/XHR"
2. Make any API call (navigate to a page with data)
3. All `/api/*` requests should show "(from network)" — not from SW cache

---

## Task 3: Update CHANGELOG

**Files:**
- Modify: `implementation-docs/CHANGELOG.md`

- [ ] **Step 9: Prepend entry to `implementation-docs/CHANGELOG.md`**

Add at the very top (before existing content):

```markdown
## [Unreleased] - 2026-04-23

### Changed
- Service worker no longer caches HTML documents or API responses (both are now NetworkOnly).
- Immutable assets (`_next/static/`, fonts, app images) use CacheFirst with ExpirationPlugin.
- YouTube thumbnails use StaleWhileRevalidate with 7-day expiry and 100-entry limit.
- Removed `...defaultCache` (Workbox defaults were silently caching HTML navigation responses).
- `__SW_MANIFEST` precache filtered to exclude HTML pages; now includes only `_next/static/` and known static file extensions.
```

- [ ] **Step 10: Commit**

```bash
git add implementation-docs/CHANGELOG.md
git commit -m "docs: changelog for service worker cache strategy overhaul"
```

---

## Self-Review

**Spec coverage:**
- ✅ HTML never cached → `navigate` mode → `NetworkOnly`
- ✅ API never cached → `/api/` → `NetworkOnly`
- ✅ `__SW_MANIFEST` filtered to exclude HTML
- ✅ `_next/static/` → `CacheFirst` (immutable, content-hashed)
- ✅ App images → `CacheFirst`
- ✅ Google Fonts → `CacheFirst`
- ✅ External images (YouTube) → `StaleWhileRevalidate`
- ✅ `...defaultCache` removed

**Placeholder scan:** None.

**Type consistency:** All imports from `serwist` — verified `CacheFirst`, `NetworkOnly`, `ExpirationPlugin`, `StaleWhileRevalidate`, `Serwist` all exported from `serwist` v9 (`node_modules/serwist/dist/index.d.ts` confirmed).

**Edge cases covered:**
- Deploy safety: HTML + `_next/static/` always fresh or hash-matched → no chunk mismatch
- `navigationPreload: true` kept → SW startup doesn't block navigation even with NetworkOnly
- `staticEntries` filter is conservative (allowlist by prefix/extension) — safe default
