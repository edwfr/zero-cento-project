/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs');
const withSerwist = require('@serwist/next').default({
    swSrc: 'src/sw.ts',
    swDest: 'public/sw.js',
    disable: process.env.NODE_ENV === 'development',
});

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
    i18n: {
        locales: ['it', 'en'],
        defaultLocale: 'it',
        localeDetection: false,
    },
};

const sentryWebpackPluginOptions = {
    silent: !process.env.CI,
    widenClientFileUpload: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
};

module.exports = process.env.NEXT_PUBLIC_SENTRY_DSN
    ? withSerwist(withSentryConfig(nextConfig, sentryWebpackPluginOptions))
    : withSerwist(nextConfig);
