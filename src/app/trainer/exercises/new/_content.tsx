'use client'

import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import '@/lib/i18n/client'
import ExerciseForm from '@/components/ExerciseForm'

export default function NewExerciseContent() {
    const router = useRouter()
    const { t } = useTranslation('trainer')

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">{t('exercises.newExerciseTitle')}</h1>
                <p className="text-gray-600 mt-2">{t('exercises.newExerciseDescription')}</p>
            </div>

            <ExerciseForm
                onSuccess={() => {
                    // Invalidate cache and redirect to exercises list
                    router.refresh()
                    router.push('/trainer/exercises')
                }}
                onCancel={() => router.push('/trainer/exercises')}
            />
        </div>
    )
}
