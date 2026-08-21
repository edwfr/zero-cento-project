'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, ChevronDown, ChevronUp, Circle, Plus } from 'lucide-react'
import type { WeekType } from '@prisma/client'
import { SkeletonTable, WeekTypeBadge } from '@/components'
import LoadingSpinner from '@/components/LoadingSpinner'
import { useToast } from '@/components/ToastNotification'
import { getApiErrorMessage } from '@/lib/api-error'
import { normalizedOneRM } from '@/lib/calculations'
import { formatDate, getTodayForInput } from '@/lib/date-format'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { FormLabel } from '@/components/FormLabel'

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
    isCompleted: boolean
    workoutSummaryComment: string | null
    comments: string[]
    rows: TestResultRow[]
}

interface Exercise {
    id: string
    name: string
    type: 'fundamental' | 'accessory'
}

interface TestResultWeek {
    weekId: string
    weekNumber: number
    weekType: WeekType
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
    weeks: TestResultWeek[]
}

export default function ProgramTestResultsContent() {
    const { t, i18n } = useTranslation('trainer')
    const params = useParams<{ id: string }>()
    const { showToast } = useToast()
    const programId = params.id

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [data, setData] = useState<TestResultsData | null>(null)
    const [showAddRecordModal, setShowAddRecordModal] = useState(false)
    const [isOpeningModal, setIsOpeningModal] = useState(false)
    const [isSavingRecord, setIsSavingRecord] = useState(false)
    const [modalError, setModalError] = useState<string | null>(null)
    const [exercises, setExercises] = useState<Exercise[]>([])
    const [selectedExerciseId, setSelectedExerciseId] = useState('')
    const [weight, setWeight] = useState('')
    const [reps, setReps] = useState('')
    const [recordDate, setRecordDate] = useState(getTodayForInput())
    const [notes, setNotes] = useState('')
    const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>({})
    const [expandedWorkouts, setExpandedWorkouts] = useState<Record<string, boolean>>({})

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

    useEffect(() => {
        if (!data) {
            return
        }

        // Keep existing expansion state where possible; default new panels to expanded.
        setExpandedWeeks((prev) => {
            const next: Record<string, boolean> = {}
            for (const week of data.weeks) {
                next[week.weekId] = prev[week.weekId] ?? true
            }
            return next
        })

        setExpandedWorkouts((prev) => {
            const next: Record<string, boolean> = {}
            for (const week of data.weeks) {
                for (const workout of week.workouts) {
                    next[workout.workoutId] = prev[workout.workoutId] ?? false
                }
            }
            return next
        })
    }, [data])

    const toggleWeek = useCallback((weekId: string) => {
        setExpandedWeeks((prev) => ({
            ...prev,
            [weekId]: !(prev[weekId] ?? true),
        }))
    }, [])

    const toggleWorkout = useCallback((workoutId: string) => {
        setExpandedWorkouts((prev) => ({
            ...prev,
            [workoutId]: !(prev[workoutId] ?? true),
        }))
    }, [])

    const weekTypeBadgeLabels: Record<WeekType, string> = {
        tecnica: t('weekTypes.tecnica'),
        ipertrofia: t('weekTypes.ipertrofia'),
        volume: t('weekTypes.volume'),
        forza_generale: t('weekTypes.forzaGenerale'),
        intensificazione: t('weekTypes.intensificazione'),
        picco: t('weekTypes.picco'),
        test: t('weekTypes.test'),
        deload: t('weekTypes.deload'),
    }

    const sortExercisesByName = useCallback(
        (items: Exercise[]) => {
            return [...items].sort((a, b) =>
                a.name.localeCompare(b.name, i18n.language, { sensitivity: 'base' })
            )
        },
        [i18n.language]
    )

    const ensureExercisesLoaded = useCallback(async (): Promise<Exercise[]> => {
        if (exercises.length > 0) {
            return exercises
        }

        const res = await fetch('/api/exercises?limit=500')
        const payload = await res.json()

        if (!res.ok) {
            throw new Error(
                getApiErrorMessage(payload, t('testResults.loadExercisesError'), t)
            )
        }

        const sorted = sortExercisesByName(payload.data?.items || [])
        setExercises(sorted)
        return sorted
    }, [exercises, sortExercisesByName, t])

    const openAddRecordModal = useCallback(async () => {
        setModalError(null)
        setIsOpeningModal(true)

        try {
            const loadedExercises = await ensureExercisesLoaded()

            if (loadedExercises.length === 0) {
                const message = t('testResults.noExercisesAvailable')
                showToast(message, 'error')
                return
            }

            setSelectedExerciseId(loadedExercises[0].id)
            setWeight('')
            setReps('')
            setRecordDate(getTodayForInput())
            setNotes('')
            setShowAddRecordModal(true)
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : t('testResults.loadExercisesError')
            showToast(message, 'error')
        } finally {
            setIsOpeningModal(false)
        }
    }, [ensureExercisesLoaded, showToast, t])

    const closeAddRecordModal = () => {
        setShowAddRecordModal(false)
        setModalError(null)
    }

    const calculateOneRepMax = (inputWeight: number, inputReps: number): number => {
        return normalizedOneRM(inputWeight, inputReps)
    }

    const handleCreateRecord = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setModalError(null)

        if (!data) {
            return
        }

        if (!selectedExerciseId || !weight || !reps || !recordDate) {
            setModalError(t('personalRecords.fillAllFields'))
            return
        }

        const parsedWeight = parseFloat(weight)
        const parsedReps = parseInt(reps, 10)

        if (Number.isNaN(parsedWeight) || Number.isNaN(parsedReps)) {
            setModalError(t('personalRecords.fillAllFields'))
            return
        }

        try {
            setIsSavingRecord(true)

            const res = await fetch('/api/personal-records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    traineeId: data.trainee.id,
                    exerciseId: selectedExerciseId,
                    weight: parsedWeight,
                    reps: parsedReps,
                    recordDate,
                    notes: notes.trim() || undefined,
                }),
            })

            const payload = await res.json()

            if (!res.ok) {
                throw new Error(
                    getApiErrorMessage(payload, t('personalRecords.createError'), t)
                )
            }

            showToast(t('personalRecords.recordAdded'), 'success')
            closeAddRecordModal()
        } catch (err: unknown) {
            setModalError(
                err instanceof Error ? err.message : t('personalRecords.createError')
            )
        } finally {
            setIsSavingRecord(false)
        }
    }

    if (loading) {
        return (
            <div className="px-4 sm:px-6 lg:px-8 py-8">
                <SkeletonTable rows={6} columns={5} />
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

            <div className="mb-8">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{t('testResults.title')}</h1>
                        <p className="text-gray-600 mt-2">
                            {t('testResults.description', {
                                program: data.programName,
                                trainee: `${data.trainee.firstName} ${data.trainee.lastName}`,
                            })}
                        </p>
                    </div>
                    <Button
                        type="button"
                        onClick={() => {
                            void openAddRecordModal()
                        }}
                        variant="primary"
                        size="md"
                        disabled={isOpeningModal}
                        isLoading={isOpeningModal}
                        loadingText={t('personalRecords.addRecordButton')}
                        icon={<Plus className="w-4 h-4" />}
                    >
                        {t('personalRecords.addRecordButton')}
                    </Button>
                </div>
            </div>

            {data.weeks.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-10 text-center text-gray-500">
                    {t('testResults.noWeeks')}
                </div>
            ) : (
                <div className="space-y-8">
                    {data.weeks.map((week) => (
                        <section key={week.weekId} className="rounded-xl border border-gray-200 bg-white shadow-sm">
                            {(() => {
                                const completedWorkoutsForWeek = week.workouts.filter((workout) => workout.isCompleted).length
                                const isWeekExpanded = expandedWeeks[week.weekId] ?? true

                                return (
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 px-4 py-4">
                                <div>
                                    <button
                                        type="button"
                                        onClick={() => toggleWeek(week.weekId)}
                                        aria-label={isWeekExpanded
                                            ? t('testResults.closeWeek')
                                            : t('testResults.openWeek')}
                                        aria-expanded={isWeekExpanded}
                                        className="flex items-center gap-3 text-left"
                                    >
                                        <span className="text-lg font-bold text-gray-900">
                                            {t('testResults.weekTitle', { week: week.weekNumber })}
                                        </span>
                                        <span className="text-xs font-semibold text-gray-500">
                                            {t('editProgram.workoutsConfiguredShort', {
                                                done: completedWorkoutsForWeek,
                                                total: week.workouts.length,
                                            })}
                                        </span>
                                        <WeekTypeBadge weekType={week.weekType} labels={weekTypeBadgeLabels} variant="ghost" />
                                        <span className="rounded-full border border-gray-200 bg-gray-50 p-1 text-gray-500">
                                            {isWeekExpanded ? (
                                                <ChevronUp className="w-4 h-4" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4" />
                                            )}
                                        </span>
                                    </button>
                                    <span className="text-sm text-gray-600">
                                        {week.startDate
                                            ? t('testResults.weekStartDate', { date: formatDate(week.startDate) })
                                            : t('testResults.weekDateUnavailable')}
                                    </span>
                                </div>
                            </div>
                                )
                            })()}

                            {(expandedWeeks[week.weekId] ?? true) && (
                                <div className="space-y-6 p-4">
                                    {week.workouts.map((workout) => {
                                        const isWorkoutExpanded = expandedWorkouts[workout.workoutId] ?? false

                                        return (
                                            <div key={workout.workoutId} className="rounded-lg border border-gray-200 bg-white">
                                                <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleWorkout(workout.workoutId)}
                                                        aria-label={isWorkoutExpanded
                                                            ? t('testResults.closeWorkoutDetails')
                                                            : t('testResults.openWorkoutDetails')}
                                                        aria-expanded={isWorkoutExpanded}
                                                        className="flex items-center gap-2 text-left"
                                                    >
                                                        {workout.isCompleted ? (
                                                            <CheckCircle2
                                                                className="h-5 w-5 shrink-0 text-green-500"
                                                                aria-label={t('testResults.workoutCompletedStatus')}
                                                            />
                                                        ) : (
                                                            <Circle
                                                                className="h-5 w-5 shrink-0 text-gray-300"
                                                                aria-label={t('testResults.workoutPendingStatus')}
                                                            />
                                                        )}
                                                        <h3 className="text-lg font-bold text-gray-900">
                                                            {t('testResults.workoutTitle', { workout: workout.dayIndex })}
                                                        </h3>
                                                        <span className="text-xs font-semibold text-gray-500">
                                                            {t('editProgram.exercisesCount', { count: workout.rows.length })}
                                                        </span>
                                                        <span className="rounded-full border border-gray-200 bg-gray-50 p-1 text-gray-500">
                                                            {isWorkoutExpanded
                                                                ? <ChevronUp className="w-4 h-4" />
                                                                : <ChevronDown className="w-4 h-4" />}
                                                        </span>
                                                    </button>
                                                </div>

                                                {isWorkoutExpanded && (
                                                    workout.rows.length === 0 ? (
                                                        <div className="rounded-b-lg border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500">
                                                            {t('testResults.noRowsForWorkout')}
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="overflow-x-auto">
                                                                <table className="min-w-[860px] w-full table-fixed divide-y divide-gray-200 text-sm">
                                                                    <colgroup>
                                                                        <col className="w-[24%]" />
                                                                        <col className="w-[8%]" />
                                                                        <col className="w-[10%]" />
                                                                        <col className="w-[10%]" />
                                                                        <col className="w-[14%]" />
                                                                        <col className="w-[34%]" />
                                                                    </colgroup>
                                                                    <thead className="bg-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-700">
                                                                        <tr>
                                                                            <th className="px-2 py-2">
                                                                                {t('testResults.colExercise')}
                                                                            </th>
                                                                            <th className="px-2 py-2 text-center">
                                                                                {t('testResults.colSets')}
                                                                            </th>
                                                                            <th className="px-2 py-2 text-center">
                                                                                {t('testResults.colReps')}
                                                                            </th>
                                                                            <th className="px-2 py-2 text-center">
                                                                                {t('testResults.colRpe')}
                                                                            </th>
                                                                            <th className="px-2 py-2">
                                                                                {t('testResults.colWeight')}
                                                                            </th>
                                                                            <th className="px-2 py-2">
                                                                                {t('testResults.colComments')}
                                                                            </th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="bg-white">
                                                                        {workout.rows.map((row, rowIndex) => (
                                                                            <tr
                                                                                key={row.workoutExerciseId}
                                                                                className={`border-b border-gray-100 ${
                                                                                    rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                                                                }`}
                                                                            >
                                                                                <td className="px-2 py-2 text-xs font-medium text-gray-900 break-words">
                                                                                    {row.exerciseName}
                                                                                </td>
                                                                                <td className="px-2 py-2 text-center text-xs font-semibold text-gray-900">
                                                                                    {row.sets}
                                                                                </td>
                                                                                <td className="px-2 py-2 text-center text-xs font-semibold text-gray-900">
                                                                                    {row.reps}
                                                                                </td>
                                                                                <td className="px-2 py-2 text-center text-xs font-semibold text-gray-900">
                                                                                    {row.rpe !== null ? Number(row.rpe).toFixed(1) : '-'}
                                                                                </td>
                                                                                <td className="px-2 py-2 text-xs text-gray-700 whitespace-nowrap">
                                                                                    {row.weightUsed}
                                                                                </td>
                                                                                <td className="px-2 py-2 text-xs text-gray-700 break-words">
                                                                                    {row.comments?.trim() || t('testResults.noComments')}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>

                                                            <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                                                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                                    {t('testResults.workoutSummaryLabel')}
                                                                </p>
                                                                <p className="mt-1 text-sm text-gray-700 break-words">
                                                                    {workout.workoutSummaryComment || t('testResults.noWorkoutSummary')}
                                                                </p>
                                                            </div>
                                                        </>
                                                    )
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </section>
                    ))}
                </div>
            )}

            {showAddRecordModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full p-6">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">
                            {t('personalRecords.addRecord')}
                        </h2>

                        {modalError && (
                            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4">
                                {modalError}
                            </div>
                        )}

                        <form onSubmit={handleCreateRecord} className="space-y-4">
                            <div>
                                <FormLabel required>
                                    {t('personalRecords.exercise')}
                                </FormLabel>
                                <select
                                    value={selectedExerciseId}
                                    onChange={(event) => setSelectedExerciseId(event.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                                    required
                                >
                                    {exercises.map((exercise) => (
                                        <option key={exercise.id} value={exercise.id}>
                                            {exercise.name} ({exercise.type === 'fundamental' ? t('exercises.fundamental') : t('exercises.accessory')})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <FormLabel required>
                                        {t('personalRecords.weight')}
                                    </FormLabel>
                                    <Input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        max="1000"
                                        value={weight}
                                        onChange={(event) => setWeight(event.target.value)}
                                        inputSize="md"
                                        placeholder="100"
                                        required
                                    />
                                </div>
                                <div>
                                    <FormLabel required>
                                        {t('personalRecords.reps')}
                                    </FormLabel>
                                    <Input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={reps}
                                        onChange={(event) => setReps(event.target.value)}
                                        inputSize="md"
                                        placeholder="5"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <FormLabel required>
                                    {t('personalRecords.recordDate')}
                                </FormLabel>
                                <Input
                                    type="date"
                                    value={recordDate}
                                    max={getTodayForInput()}
                                    onChange={(event) => setRecordDate(event.target.value)}
                                    inputSize="md"
                                    required
                                />
                            </div>

                            <div>
                                <FormLabel>
                                    {t('workoutDetail.notesLabel')}
                                </FormLabel>
                                <textarea
                                    value={notes}
                                    onChange={(event) => setNotes(event.target.value)}
                                    rows={2}
                                    maxLength={500}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                                    placeholder={t('testResults.notesPlaceholder')}
                                />
                            </div>

                            {Number.isFinite(parseFloat(weight)) &&
                                Number.isFinite(parseInt(reps, 10)) &&
                                parseFloat(weight) > 0 &&
                                parseInt(reps, 10) > 0 && (
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <div className="text-sm text-gray-600 mb-1">
                                            {t('personalRecords.estimated1RM')}
                                        </div>
                                        <div className="text-2xl font-bold text-brand-primary">
                                            {calculateOneRepMax(parseFloat(weight), parseInt(reps, 10))} kg
                                        </div>
                                    </div>
                                )}

                            <div className="flex space-x-4 pt-4">
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="lg"
                                    className="flex-1"
                                    disabled={isSavingRecord}
                                    isLoading={isSavingRecord}
                                    loadingText={t('personalRecords.saveRecord')}
                                >
                                    {t('personalRecords.saveRecord')}
                                </Button>
                                <Button
                                    type="button"
                                    onClick={closeAddRecordModal}
                                    variant="secondary"
                                    size="lg"
                                    className="flex-1"
                                >
                                    {t('workoutDetail.cancel')}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
