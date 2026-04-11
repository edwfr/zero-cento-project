'use client'

import { useTranslation } from 'react-i18next'

export default function NotFound() {
    const { t } = useTranslation('common')

    return (
        <div className="flex h-screen flex-col items-center justify-center">
            <h2 className="text-2xl font-bold mb-4">{t('errors.notFound')}</h2>
            <p className="text-gray-600 mb-6">{t('errors.pageNotFoundDescription')}</p>
            <a
                href="/"
                className="px-6 py-2 bg-brand-primary text-white rounded-lg hover:bg-[#E69500]"
            >
                {t('common.backToHome')}
            </a>
        </div>
    )
}
