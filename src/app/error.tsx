'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    const { t } = useTranslation('common')

    useEffect(() => {
        Sentry.captureException(error)
    }, [error])

    return (
        <div className="flex h-screen flex-col items-center justify-center">
            <h2 className="text-2xl font-bold mb-4">{t('errors.generic')}</h2>
            <p className="text-gray-600 mb-6">{t('errors.tryLater')}</p>
            <Button
                onClick={reset}
                variant="primary"
                size="md"
            >
                {t('common.retry')}
            </Button>
        </div>
    )
}
