import { defaultCache } from '@serwist/next/worker'
import { Serwist, NetworkFirst, StaleWhileRevalidate } from 'serwist'

declare const self: Window &
    typeof globalThis & {
        __SW_MANIFEST: (string | { url: string; revision: string | null })[]
    }

const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: true,
    runtimeCaching: [
        // Cache API responses (network-first for fresh data, 5 min)
        {
            matcher: /\/api\/(?!auth)/,
            handler: new NetworkFirst({
                cacheName: 'api-cache',
                networkTimeoutSeconds: 5,
                plugins: [
                    {
                        cacheWillUpdate: async ({ response }) =>
                            response?.status === 200 ? response : null,
                    },
                ],
            }),
        },
        // Cache images with stale-while-revalidate
        {
            matcher: /\.(png|jpe?g|gif|webp|svg|ico)$/,
            handler: new StaleWhileRevalidate({
                cacheName: 'images-cache',
            }),
        },
        // Cache Google Fonts
        {
            matcher: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/,
            handler: new StaleWhileRevalidate({
                cacheName: 'fonts-cache',
            }),
        },
        // Default cache strategies
        ...defaultCache,
    ],
})

serwist.addEventListeners()
