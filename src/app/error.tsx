'use client'

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    const { t } = useTranslation('common')

    useEffect(() => {
        console.error(error)
    }, [error])

    return (
        <div className="flex h-screen flex-col items-center justify-center">
            <h2 className="text-2xl font-bold mb-4">{t('errors.generic')}</h2>
            <p className="text-gray-600 mb-6">{t('errors.tryLater')}</p>
            <button
                onClick={reset}
                className="px-6 py-2 bg-brand-primary text-white rounded-lg hover:bg-[#E69500]"
            >
                {t('common.retry')}
            </button>
        </div>
    )
}
