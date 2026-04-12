'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Image from 'next/image'
import { Button } from '@/components/Button'

interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[]
    readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
    prompt(): Promise<void>
}

/**
 * PWA Install Prompt Banner (PWA-003)
 * Shows a native install banner when the app can be installed as a PWA.
 * Persists dismissal in localStorage.
 */
export default function PWAInstallPrompt() {
    const { t: tComponents } = useTranslation('components')
    const { t: tCommon } = useTranslation('common')
    const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
    const [dismissed, setDismissed] = useState(false)
    const [isInstalled, setIsInstalled] = useState(false)
    const [iconLoadError, setIconLoadError] = useState(false)

    useEffect(() => {
        // Check if already installed (standalone mode)
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true)
            return
        }

        // Check if user already dismissed this
        if (localStorage.getItem('pwa-install-dismissed') === 'true') {
            setDismissed(true)
            return
        }

        const handler = (e: Event) => {
            e.preventDefault()
            setInstallEvent(e as BeforeInstallPromptEvent)
        }

        window.addEventListener('beforeinstallprompt', handler)

        // Detect installation
        window.addEventListener('appinstalled', () => {
            setIsInstalled(true)
            setInstallEvent(null)
        })

        return () => {
            window.removeEventListener('beforeinstallprompt', handler)
        }
    }, [])

    const handleInstall = async () => {
        if (!installEvent) return
        await installEvent.prompt()
        const { outcome } = await installEvent.userChoice
        if (outcome === 'accepted') {
            setInstallEvent(null)
        } else {
            handleDismiss()
        }
    }

    const handleDismiss = () => {
        localStorage.setItem('pwa-install-dismissed', 'true')
        setDismissed(true)
        setInstallEvent(null)
    }

    // Don't show if no install event, already installed, or dismissed
    if (!installEvent || isInstalled || dismissed) return null

    return (
        <div
            role="banner"
            className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:w-96 bg-white border border-gray-200 rounded-2xl shadow-xl p-4 z-50 flex items-start gap-4"
        >
            {/* App Icon */}
            <div className="flex-shrink-0 w-12 h-12 bg-black rounded-xl overflow-hidden flex items-center justify-center">
                {iconLoadError ? (
                    <span className="text-brand-primary font-bold text-sm">0c</span>
                ) : (
                    <Image
                        src="/icons/icon-192x192.png"
                        alt="ZeroCento"
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                        onError={() => setIconLoadError(true)}
                    />
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-gray-900">{tComponents('pwaPrompt.install')}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                    {tComponents('pwaPrompt.description')}
                </p>
                <div className="flex gap-2 mt-3">
                    <Button
                        onClick={handleInstall}
                        variant="primary"
                        size="sm"
                        className="flex-1 text-xs"
                    >
                        {tComponents('pwaPrompt.installButton')}
                    </Button>
                    <Button
                        onClick={handleDismiss}
                        variant="secondary"
                        size="sm"
                        className="flex-1 text-xs"
                    >
                        {tComponents('pwaPrompt.notNow')}
                    </Button>
                </div>
            </div>

            {/* Close button */}
            <button
                onClick={handleDismiss}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label={tCommon('common.close')}
            >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    )
}

