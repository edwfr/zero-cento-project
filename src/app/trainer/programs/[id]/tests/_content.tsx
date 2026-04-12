'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Plus } from 'lucide-react'
import { SkeletonTable } from '@/components'
import LoadingSpinner from '@/components/LoadingSpinner'
import { useToast } from '@/components/ToastNotification'
import { getApiErrorMessage } from '@/lib/api-error'
import { estimateOneRMFromRpeTable } from '@/lib/calculations'
import { formatDate, getTodayForInput } from '@/lib/date-format'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'

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
    const { t, i18n } = useTranslation('trainer')
    const { t: tNav } = useTranslation('navigation')
    const params = useParams<{ id: string }>()
    const searchParams = useSearchParams()
    const { showToast } = useToast()
    const programId = params.id
    const backContext = searchParams.get('backContext')
    const traineeId = searchParams.get('traineeId')
    const backHref =
        backContext === 'dashboard'
            ? '/trainer/dashboard'
            : backContext === 'trainee' && traineeId
                ? `/trainer/trainees/${traineeId}`
                : '/trainer/programs'
    const backLabel =
        backContext === 'dashboard'
            ? tNav('breadcrumbs.backToHome')
            : backContext === 'trainee'
                ? t('testResults.backToTrainee')
                : t('testResults.backToPrograms')

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

        const res = await fetch('/api/exercises?limit=100')
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
        const normalizedOneRM = estimateOneRMFromRpeTable(inputWeight, inputReps, 10)
        return Math.round(normalizedOneRM * 10) / 10
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
            <Link
                href={backHref}
                className="text-brand-primary hover:text-brand-primary/80 text-sm font-semibold mb-4 inline-flex items-center gap-1"
            >
                <ArrowLeft className="w-4 h-4" />
                {backLabel}
            </Link>

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
                                {week.workouts.map((workout) => {
                                    const workoutComments = (
                                        Array.isArray(workout.comments)
                                            ? workout.comments
                                            : Array.from(
                                                new Set(
                                                    workout.rows
                                                        .map((row) => row.comments?.trim())
                                                        .filter((comment): comment is string => !!comment)
                                                )
                                            )
                                    ).filter((comment): comment is string => typeof comment === 'string' && comment.trim().length > 0)

                                    return (
                                        <div key={workout.workoutId}>
                                            <h3 className="text-lg font-semibold text-gray-800 mb-3">
                                                {t('testResults.workoutTitle', { workout: workout.dayIndex })}
                                            </h3>

                                            {workout.rows.length === 0 ? (
                                                <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500">
                                                    {t('testResults.noRowsForWorkout')}
                                                </div>
                                            ) : (
                                                <>
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
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>

                                                    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                            {t('testResults.colComments')}
                                                        </p>
                                                        {workoutComments.length > 0 ? (
                                                            workoutComments.length === 1 ? (
                                                                <p className="mt-1 text-sm text-gray-700 break-words">
                                                                    {workoutComments[0]}
                                                                </p>
                                                            ) : (
                                                                <ul className="mt-2 space-y-1 list-disc pl-5">
                                                                    {workoutComments.map((comment, index) => (
                                                                        <li
                                                                            key={`${workout.workoutId}-comment-${index}`}
                                                                            className="text-sm text-gray-700 break-words"
                                                                        >
                                                                            {comment}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            )
                                                        ) : (
                                                            <p className="mt-1 text-sm text-gray-500">
                                                                {t('testResults.noComments')}
                                                            </p>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
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
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    {t('personalRecords.exercise')} *
                                </label>
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
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        {t('personalRecords.weight')} *
                                    </label>
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
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        {t('personalRecords.reps')} *
                                    </label>
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
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    {t('personalRecords.recordDate')} *
                                </label>
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
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    {t('workoutDetail.notesLabel')}
                                </label>
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
                                        <div className="text-2xl font-bold text-[#FFA700]">
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
