import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import PWAInstallPrompt from '@/components/PWAInstallPrompt'
import { ToastProvider } from '@/components/ToastNotification'
import { I18nProvider } from '@/lib/i18n/provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'ZeroCento Training Platform',
    description: 'Piattaforma di gestione training sportivo per trainer e atleti',
    manifest: '/manifest.json',
    icons: {
        icon: '/images/logo/favicon.ico',
        shortcut: '/images/logo/favicon.ico',
    },
}

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    themeColor: '#FFA700',
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
