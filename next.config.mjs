import { withSentryConfig } from '@sentry/nextjs';
import withSerwist from '@serwist/next';

const withSerwistConfig = withSerwist({
    swSrc: 'src/sw.ts',
    swDest: 'public/sw.js',
    disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    turbopack: {},
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'img.youtube.com',
            },
            {
                protocol: 'https',
                hostname: 'i.ytimg.com',
            },
        ],
    },
};

export default withSentryConfig(withSerwistConfig(nextConfig), {
    org: process.env.SENTRY_ORG ?? 'zerocento',
    project: process.env.SENTRY_PROJECT ?? 'javascript-nextjs',
    authToken: process.env.SENTRY_AUTH_TOKEN,
    silent: !process.env.CI,
    widenClientFileUpload: true,
    webpack: {
        automaticVercelMonitors: true,
        treeshake: {
            removeDebugLogging: true,
        },
    },
});
