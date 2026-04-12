'use client'

import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'

export default function OfflinePage() {
    const { t } = useTranslation('common')

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="max-w-md w-full text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-brand-primary/10 rounded-2xl mb-6">
                    <svg
                        className="w-10 h-10 text-brand-primary"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M12 12h.01M8.464 15.536a5 5 0 010-7.072M5.636 18.364a9 9 0 010-12.728"
                        />
                    </svg>
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('offline.title')}</h1>
                <p className="text-gray-500 text-sm mb-6">
                    {t('offline.description')}
                </p>

                <Button
                    onClick={() => window.location.reload()}
                    variant="primary"
                    size="lg"
                >
                    {t('common.retry')}
                </Button>

                <p className="text-gray-400 text-xs mt-6">
                    {t('app.fullName')}
                </p>
            </div>
        </div>
    )
}

