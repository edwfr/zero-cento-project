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
