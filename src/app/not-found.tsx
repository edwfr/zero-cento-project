'use client'

import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'

export default function NotFound() {
    const { t } = useTranslation('common')

    return (
        <div className="flex h-screen flex-col items-center justify-center">
            <h2 className="text-2xl font-bold mb-4">{t('errors.notFound')}</h2>
            <p className="text-gray-600 mb-6">{t('errors.pageNotFoundDescription')}</p>
            <Button
                onClick={() => {
                    window.location.href = '/'
                }}
                variant="primary"
                size="md"
            >
                {t('common.backToHome')}
            </Button>
        </div>
    )
}
