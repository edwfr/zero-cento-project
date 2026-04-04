'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { SkeletonTable } from '@/components'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatDate } from '@/lib/date-format'

interface TestResultRow {
    workoutExerciseId: string
    exerciseName: string
    sets: number
    reps: string
    rpe: number | null
    weightUsed: string
    comments: string | null
    feedbackDate: string | null
}

interface TestResultWorkout {
    workoutId: string
    dayIndex: number
    rows: TestResultRow[]
}

interface TestResultWeek {
    weekId: string
    weekNumber: number
    startDate: string | null
    workouts: TestResultWorkout[]
}

interface TestResultsData {
    programId: string
    programName: string
    trainee: {
        id: string
        firstName: string
        lastName: string
    }
    testWeeks: TestResultWeek[]
}

export default function ProgramTestResultsContent() {
    const { t } = useTranslation('trainer')
    const { t: tNav } = useTranslation('navigation')
    const params = useParams<{ id: string }>()
    const searchParams = useSearchParams()
    const programId = params.id
    const backContext = searchParams.get('backContext')
    const backHref = backContext === 'dashboard' ? '/trainer/dashboard' : '/trainer/programs'
    const backLabel =
        backContext === 'dashboard'
            ? tNav('breadcrumbs.backToHome')
            : t('testResults.backToPrograms')

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [data, setData] = useState<TestResultsData | null>(null)

    const fetchTestResults = useCallback(async () => {
        try {
            setLoading(true)
            const res = await fetch(`/api/programs/${programId}/test-results`)
            const payload = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(payload, t('testResults.loadingError'), t))
            }

            setData(payload.data)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('testResults.loadingError'))
        } finally {
            setLoading(false)
        }
    }, [programId, t])

    useEffect(() => {
        void fetchTestResults()
    }, [fetchTestResults])

    if (loading) {
        return (
            <div className="px-4 sm:px-6 lg:px-8 py-8">
                <SkeletonTable rows={6} columns={6} />
            </div>
        )
    }

    if (error) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                    {error}
                </div>
            </div>
        )
    }

    if (!data) {
        return null
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Link
                href={backHref}
                className="text-brand-primary hover:text-brand-primary/80 text-sm font-semibold mb-4 inline-flex items-center gap-1"
            >
                <ArrowLeft className="w-4 h-4" />
                {backLabel}
            </Link>

            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">{t('testResults.title')}</h1>
                <p className="text-gray-600 mt-2">
                    {t('testResults.description', {
                        program: data.programName,
                        trainee: `${data.trainee.firstName} ${data.trainee.lastName}`,
                    })}
                </p>
            </div>

            {data.testWeeks.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-10 text-center text-gray-500">
                    {t('testResults.noTestWeeks')}
                </div>
            ) : (
                <div className="space-y-8">
                    {data.testWeeks.map((week) => (
                        <section key={week.weekId} className="bg-white rounded-lg shadow-md p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
                                <h2 className="text-xl font-bold text-gray-900">
                                    {t('testResults.weekTitle', { week: week.weekNumber })}
                                </h2>
                                <span className="text-sm text-gray-600">
                                    {week.startDate
                                        ? t('testResults.weekStartDate', { date: formatDate(week.startDate) })
                                        : t('testResults.weekDateUnavailable')}
                                </span>
                            </div>

                            <div className="space-y-6">
                                {week.workouts.map((workout) => (
                                    <div key={workout.workoutId}>
                                        <h3 className="text-lg font-semibold text-gray-800 mb-3">
                                            {t('testResults.workoutTitle', { workout: workout.dayIndex })}
                                        </h3>

                                        {workout.rows.length === 0 ? (
                                            <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500">
                                                {t('testResults.noRowsForWorkout')}
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                                <table className="min-w-full divide-y divide-gray-200">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                                {t('testResults.colExercise')}
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                                {t('testResults.colSets')}
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                                {t('testResults.colReps')}
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                                {t('testResults.colRpe')}
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                                {t('testResults.colWeight')}
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                                {t('testResults.colComments')}
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        {workout.rows.map((row) => (
                                                            <tr key={row.workoutExerciseId} className="hover:bg-gray-50 transition-colors">
                                                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                                                    {row.exerciseName}
                                                                </td>
                                                                <td className="px-4 py-3 text-sm text-gray-700">
                                                                    {row.sets}
                                                                </td>
                                                                <td className="px-4 py-3 text-sm text-gray-700">
                                                                    {row.reps}
                                                                </td>
                                                                <td className="px-4 py-3 text-sm text-gray-700">
                                                                    {row.rpe !== null ? Number(row.rpe).toFixed(1) : '-'}
                                                                </td>
                                                                <td className="px-4 py-3 text-sm text-gray-700">
                                                                    {row.weightUsed}
                                                                </td>
                                                                <td className="px-4 py-3 text-sm text-gray-700 max-w-[340px] break-words">
                                                                    {row.comments?.trim() || t('testResults.noComments')}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </div>
    )
}
