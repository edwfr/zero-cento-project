import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { Inter } from 'next/font/google'
import './globals.css'
import PWAInstallPrompt from '@/components/PWAInstallPrompt'
import { ToastProvider } from '@/components/ToastNotification'
import { I18nProvider } from '@/lib/i18n/provider'
import commonIt from '../../public/locales/it/common.json'
import commonEn from '../../public/locales/en/common.json'

const inter = Inter({ subsets: ['latin'] })

type SupportedLocale = 'it' | 'en'

const COMMON_DICTIONARIES = {
    it: commonIt,
    en: commonEn,
} as const

const resolveLocale = (cookieLocale?: string): SupportedLocale => {
    if (!cookieLocale) return 'it'
    return cookieLocale.toLowerCase().startsWith('en') ? 'en' : 'it'
}

export function generateMetadata(): Metadata {
    const locale = resolveLocale(cookies().get('i18next')?.value)
    const dictionary = COMMON_DICTIONARIES[locale]
    const fallback = COMMON_DICTIONARIES.it

    return {
        title: dictionary.app.fullName ?? fallback.app.fullName,
        description: dictionary.app.description ?? fallback.app.description,
        manifest: '/manifest.json',
        icons: {
            icon: '/images/logo/favicon.ico',
            shortcut: '/images/logo/favicon.ico',
        },
    }
}

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    themeColor: 'rgb(255 167 0)',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="it">
            <body className={inter.className}>
                <I18nProvider>
                    <ToastProvider>
                        {children}
                        <PWAInstallPrompt />
                    </ToastProvider>
                </I18nProvider>
            </body>
        </html>
    )
}
