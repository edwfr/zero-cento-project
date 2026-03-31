'use client'

import { useTranslation } from 'react-i18next'
import { Lightbulb } from 'lucide-react'
import ExercisesTable from '@/components/ExercisesTable'

export default function AdminExercisesContent() {
    const { t } = useTranslation('admin')

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {t('exercisesPage.title')}
                </h1>
                <p className="text-gray-600">
                    {t('exercisesPage.description')}
                </p>
            </div>

            <ExercisesTable />

            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-800 text-sm">
                    <Lightbulb className="w-4 h-4 inline mr-1" /><strong>{t('exercisesPage.infoNoteLabel')}</strong> {t('exercisesPage.infoNote')}
                </p>
            </div>
        </div>
    )
}
