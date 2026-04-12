'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { getApiErrorMessage } from '@/lib/api-error'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import LoadingSpinner from '@/components/LoadingSpinner'
import WeekTypeBadge from '@/components/WeekTypeBadge'
import { useToast } from '@/components/ToastNotification'
import ConfirmationModal from '@/components/ConfirmationModal'
import { Input } from '@/components/Input'
import { FormLabel } from '@/components/FormLabel'

interface WorkoutSummary {
    id: string
    dayIndex: number
    exerciseCount: number
}

interface WeekSummary {
    weekNumber: number
    weekType: 'normal' | 'test' | 'deload'
    workouts: WorkoutSummary[]
}

interface Program {
    id: string
    title: string
    status: 'draft' | 'active' | 'completed'
    trainee: {
        id: string
        firstName: string
        lastName: string
    }
    durationWeeks: number
    workoutsPerWeek: number
    startDate: string | null
    weeks: WeekSummary[]
}

export default function PublishProgramPage() {
    const router = useRouter()
    const params = useParams()
    const programId = params.id as string

    const [loading, setLoading] = useState(true)
    const [publishing, setPublishing] = useState(false)
    const [program, setProgram] = useState<Program | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [startDate, setStartDate] = useState('')
    const [validationErrors, setValidationErrors] = useState<string[]>([])
    const { showToast } = useToast()
    const { t } = useTranslation('trainer')
    const [confirmModal, setConfirmModal] = useState<{
        title: string
        message: string
        onConfirm: () => void
        confirmText?: string
        variant?: 'danger' | 'warning' | 'info' | 'success'
    } | null>(null)

    const validateProgram = useCallback((prog: Program) => {
        const errors: string[] = []

        // Check all workouts have exercises
        const totalWorkouts = prog.durationWeeks * prog.workoutsPerWeek
        const configuredWorkouts = prog.weeks.reduce(
            (sum, week) => sum + week.workouts.filter((w) => w.exerciseCount > 0).length,
            0
        )

        if (configuredWorkouts < totalWorkouts) {
            errors.push(
                t('publish.validationWorkoutsEmpty', { count: totalWorkouts - configuredWorkouts })
            )
        }

        // Check at least one fundamental exercise per week
        prog.weeks.forEach((week) => {
            const weekHasExercises = week.workouts.some((w) => w.exerciseCount > 0)
            if (!weekHasExercises) {
                errors.push(t('publish.validationWeekEmpty', { week: week.weekNumber }))
            }
        })

        setValidationErrors(errors)
    }, [t])

    const fetchProgram = useCallback(async () => {
        try {
            setLoading(true)
            const res = await fetch(`/api/programs/${programId}`, {
                cache: 'no-store',
            })
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('publish.errorLoading', { defaultValue: 'Error loading program' }), t))
            }

            // Transform API data to match frontend interface
            const programData = data.data.program
            const transformedProgram: Program = {
                ...programData,
                weeks: programData.weeks.map((week: any) => ({
                    weekNumber: week.weekNumber,
                    weekType: week.weekType,
                    workouts: week.workouts.map((workout: any) => ({
                        id: workout.id,
                        dayIndex: workout.dayIndex,
                        exerciseCount: workout.workoutExercises?.length || 0,
                    })),
                })),
            }

            setProgram(transformedProgram)
            validateProgram(transformedProgram)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setLoading(false)
        }
    }, [programId, t, validateProgram])

    useEffect(() => {
        void fetchProgram()

        // Set default start date to next Monday
        const today = new Date()
        const nextMonday = new Date(today)
        const daysUntilMonday = (8 - today.getDay()) % 7 || 7
        nextMonday.setDate(today.getDate() + daysUntilMonday)
        setStartDate(nextMonday.toISOString().split('T')[0])
    }, [fetchProgram])

    const doPublish = async () => {
        setConfirmModal(null)
        try {
            setPublishing(true)

            const res = await fetch(`/api/programs/${programId}/publish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ startDate }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('publish.publishError'), t))
            }

            showToast(t('publish.publishSuccess'), 'success')
            router.push('/trainer/programs')
        } catch (err: unknown) {
            showToast(err instanceof Error ? err.message : t('publish.publishError'), 'error')
            setPublishing(false)
        }
    }

    const handlePublish = () => {
        if (!program || validationErrors.length > 0) return

        if (!startDate) {
            showToast(t('publish.noStartDate'), 'error')
            return
        }

        const selectedDate = new Date(startDate)
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        if (selectedDate < today) {
            showToast(t('publish.pastDateError'), 'error')
            return
        }

        setConfirmModal({
            title: t('publish.title'),
            message: t('publish.confirmMessage'),
            confirmText: t('publish.confirmButton'),
            variant: 'info',
            onConfirm: doPublish,
        })
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <LoadingSpinner size="lg" color="primary" />
            </div>
        )
    }

    if (error || !program) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg">
                    {error || t('publish.notFound')}
                </div>
            </div>
        )
    }

    const totalWorkouts = program.durationWeeks * program.workoutsPerWeek
    const configuredWorkouts = program.weeks.reduce(
        (sum, week) => sum + week.workouts.filter((w) => w.exerciseCount > 0).length,
        0
    )
    const totalExercises = program.weeks.reduce(
        (sum, week) => sum + week.workouts.reduce((s, w) => s + w.exerciseCount, 0),
        0
    )

    const canPublish = validationErrors.length === 0 && program.status === 'draft'

    return (
        <div className="min-h-screen bg-gray-50">
            {confirmModal && (
                <ConfirmationModal
                    isOpen={true}
                    onClose={() => setConfirmModal(null)}
                    onConfirm={confirmModal.onConfirm}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    confirmText={confirmModal.confirmText ?? 'Conferma'}
                    variant={confirmModal.variant ?? 'danger'}
                />
            )}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Progress Indicator */}
                <div className="mb-8">
                    <div className="flex items-center justify-center space-x-4 mb-4">
                        <div className="flex items-center">
                            <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">
                                ✓
                            </div>
                            <span className="ml-2 font-semibold text-gray-900">{t('editProgram.stepSetup')}</span>
                        </div>
                        <div className="w-16 h-1 bg-green-500"></div>
                        <div className="flex items-center">
                            <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">
                                ✓
                            </div>
                            <span className="ml-2 font-semibold text-gray-900">{t('editProgram.stepExercises')}</span>
                        </div>
                        <div className="w-16 h-1 bg-green-500"></div>
                        <div className="flex items-center">
                            <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">
                                ✓
                            </div>
                            <span className="ml-2 font-semibold text-gray-900">{t('editProgram.stepReview')}</span>
                        </div>
                        <div className="w-16 h-1 bg-brand-primary"></div>
                        <div className="flex items-center">
                            <div className="w-10 h-10 bg-brand-primary text-white rounded-full flex items-center justify-center font-bold">
                                4
                            </div>
                            <span className="ml-2 font-semibold text-gray-900">{t('editProgram.stepPublish')}</span>
                        </div>
                    </div>
                </div>

                {/* Header */}
                <div className="mb-8">
                    <Link
                        href={`/trainer/programs/${programId}/review`}
                        className="text-brand-primary hover:text-brand-primary/80 mb-4 inline-flex items-center gap-1 text-sm font-semibold"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        {t('publish.backToReview')}
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900">{t('publish.title')}</h1>
                    <p className="text-gray-600 mt-2">{t('publish.description')}</p>
                </div>

                {/* Validation Errors */}
                {validationErrors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
                        <h3 className="text-lg font-bold text-red-900 mb-3">
                            {t('publish.validationTitle')}
                        </h3>
                        <ul className="list-disc list-inside space-y-1">
                            {validationErrors.map((err, idx) => (
                                <li key={idx} className="text-red-800">
                                    {err}
                                </li>
                            ))}
                        </ul>
                        <Link
                            href={`/trainer/programs/${programId}/review`}
                            className="inline-block mt-4 bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
                        >{t('publish.backToReview')}
                        </Link>
                    </div>
                )}

                {/* Program Summary */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">{program.title}</h2>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                        <div>
                            <p className="text-sm text-gray-600 mb-1">{t('publish.athleteLabel')}</p>
                            <p className="text-lg font-semibold text-gray-900">
                                {program.trainee.firstName} {program.trainee.lastName}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 mb-1">{t('publish.durationLabel')}</p>
                            <p className="text-lg font-semibold text-gray-900">
                                {program.durationWeeks} {t('publish.weeksLabel')}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 mb-1">{t('publish.workoutsLabel')}</p>
                            <p className="text-lg font-semibold text-gray-900">
                                {configuredWorkouts} / {totalWorkouts}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 mb-1">{t('publish.exercisesLabel')}</p>
                            <p className="text-lg font-semibold text-gray-900">{totalExercises}</p>
                        </div>
                    </div>

                    {/* Week Overview */}
                    <div className="border-t border-gray-200 pt-4">
                        <h3 className="text-lg font-bold text-gray-900 mb-3">
                            {t('publish.weeksSummary')}
                        </h3>
                        <div className="space-y-2">
                            {program.weeks.map((week) => (
                                <div
                                    key={week.weekNumber}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                >
                                    <div className="flex items-center space-x-3">
                                        <span className="font-semibold text-gray-900">
                                            {t('publish.weekLabel', { week: week.weekNumber })}
                                        </span>
                                        <WeekTypeBadge weekType={week.weekType} />
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <div className="flex space-x-1">
                                            {week.workouts.map((w) => (
                                                <div
                                                    key={w.id}
                                                    className={`w-8 h-8 rounded flex items-center justify-center text-xs font-semibold ${w.exerciseCount > 0
                                                        ? 'bg-green-500 text-white'
                                                        : 'bg-gray-300 text-gray-600'
                                                        }`}
                                                    title={`Giorno ${w.dayIndex}: ${w.exerciseCount}`}
                                                >
                                                    {w.dayIndex}
                                                </div>
                                            ))}
                                        </div>
                                        <span className="text-sm text-gray-600">
                                            {week.workouts.filter((w) => w.exerciseCount > 0).length}/
                                            {week.workouts.length}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Start Date Selection */}
                {canPublish && (
                    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">
                            {t('publish.startDateTitle')}
                        </h3>
                        <div>
                            <FormLabel>
                                {t('publish.startDateLabel')}
                            </FormLabel>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                inputSize="md"
                                required
                            />
                        </div>
                    </div>
                )}

                {/* Publish Actions */}
                <div className="flex space-x-4">
                    {canPublish ? (
                        <>
                            <button
                                onClick={handlePublish}
                                disabled={publishing || !startDate}
                                className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-colors flex items-center justify-center"
                            >
                                {publishing ? (
                                    <LoadingSpinner size="sm" color="white" />
                                ) : (
                                    t('publish.publishButton')
                                )}
                            </button>
                            <Link
                                href={`/trainer/programs/${programId}/edit`}
                                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-4 px-6 rounded-lg transition-colors"
                            >
                                {t('publish.cancel')}
                            </Link>
                        </>
                    ) : (
                        <Link
                            href={`/trainer/programs/${programId}/edit`}
                            className="flex-1 bg-brand-primary hover:bg-brand-primary-hover text-white font-semibold py-4 px-6 rounded-lg text-center transition-colors"
                        >
                            {t('publish.backToEdit')}
                        </Link>
                    )}
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                    <p className="text-sm text-blue-900">
                        {t('publish.infoNote')}
                    </p>
                </div>
            </div>
        </div>
    )
}
