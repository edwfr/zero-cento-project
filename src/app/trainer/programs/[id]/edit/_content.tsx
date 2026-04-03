'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { WeightType } from '@prisma/client'
import { getApiErrorMessage } from '@/lib/api-error'
import LoadingSpinner from '@/components/LoadingSpinner'
import ConfirmationModal from '@/components/ConfirmationModal'
import ProgramMuscleGroupCharts from '@/components/ProgramMuscleGroupCharts'
import { useToast } from '@/components/ToastNotification'
import WeekTypeBadge from '@/components/WeekTypeBadge'
import EditProgramMetadata from './EditProgramMetadata'
import MovementPatternTag from '@/components/MovementPatternTag'
import { ClipboardList, Flame, Wind, ArrowLeft, FileEdit, Copy, ArrowUpRight, BarChart3 } from 'lucide-react'

// Brand primary color - default per movement pattern senza colore personalizzato
const PRIMARY_COLOR = '#FFA700'

interface MovementPattern {
    id: string
    name: string
    color: string
}

interface WorkoutExerciseMuscleGroup {
    coefficient: number
    muscleGroup: {
        id: string
        name: string
    }
}

interface WorkoutExercise {
    id: string
    sets: number
    reps: string
    isWarmup: boolean
    weightType: WeightType
    weight: number | null
    exercise: {
        id: string
        name: string
        type: 'fundamental' | 'accessory'
        exerciseMuscleGroups: WorkoutExerciseMuscleGroup[]
    }
}

interface Workout {
    id: string
    dayOfWeek: number
    order: number
    exerciseCount: number
    movementPatterns: MovementPattern[]
    workoutExercises: WorkoutExercise[]
}

interface Week {
    id: string
    weekNumber: number
    weekType: 'normal' | 'test' | 'deload'
    workouts: Workout[]
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
    weeks: Week[]
}

interface PersonalRecord {
    exerciseId: string
    reps: number
    weight: number
}

function parseRepsValue(repsValue: string): number {
    const match = repsValue.match(/^\d+/)
    return match ? parseInt(match[0], 10) : 0
}

function estimateOneRMValue(weight: number, reps: number): number {
    if (reps <= 1) return weight
    return weight * (1 + reps / 30)
}

interface EditProgramContentProps {
    readOnly?: boolean
}

export default function EditProgramContent({ readOnly = false }: EditProgramContentProps) {
    const params = useParams()
    const programId = params.id as string
    const { showToast } = useToast()
    const { t } = useTranslation('trainer')

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [copyingFirstWeek, setCopyingFirstWeek] = useState(false)
    const [copyingWeekId, setCopyingWeekId] = useState<string | null>(null)
    const [program, setProgram] = useState<Program | null>(null)
    const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([])
    const [error, setError] = useState<string | null>(null)
    const loadingRef = useRef(false)
    const [confirmCopyOpen, setConfirmCopyOpen] = useState(false)
    const [confirmCopyNextWeek, setConfirmCopyNextWeek] = useState<Week | null>(null)

    useEffect(() => {
        fetchProgram()
    }, [programId])

    // Ricarica i dati quando si torna alla pagina (ad esempio dopo aver modificato un workout)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && !loadingRef.current) {
                fetchProgram()
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, []) // array vuoto: si registra una sola volta

    const fetchProgram = async () => {
        if (loadingRef.current) return
        loadingRef.current = true
        try {
            setLoading(true)
            const res = await fetch(`/api/programs/${programId}`, {
                cache: 'no-store',
            })
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('editProgram.errorLoading'), t))
            }

            const traineeId = data.data.program.trainee.id
            const recordsRes = await fetch(`/api/personal-records?traineeId=${traineeId}`)
            if (recordsRes.ok) {
                const recordsData = await recordsRes.json()
                setPersonalRecords(recordsData.data.items || [])
            } else {
                setPersonalRecords([])
            }

            // Trasforma i dati per calcolare exerciseCount e estrarre movement patterns da workoutExercises
            const transformedProgram = {
                ...data.data.program,
                weeks: data.data.program.weeks.map((week: any) => ({
                    ...week,
                    workouts: week.workouts.map((workout: any) => {
                        const workoutExercises = workout.workoutExercises || []
                        const trainerId = data.data.program.trainerId

                        const movementPatterns: MovementPattern[] = []
                        workoutExercises.forEach((we: any) => {
                            if (we.exercise?.movementPattern) {
                                const mp = we.exercise.movementPattern
                                const customColor = mp.movementPatternColors?.find(
                                    (c: any) => c.trainerId === trainerId
                                )?.color
                                movementPatterns.push({
                                    id: mp.id,
                                    name: mp.name,
                                    color: customColor || PRIMARY_COLOR,
                                })
                            }
                        })

                        return {
                            id: workout.id,
                            dayOfWeek: workout.dayOfWeek,
                            order: workout.order,
                            exerciseCount: workoutExercises.length,
                            movementPatterns,
                            workoutExercises: workoutExercises.map((we: any) => ({
                                id: we.id,
                                sets: we.sets,
                                reps: String(we.reps),
                                isWarmup: we.isWarmup,
                                weightType: we.weightType,
                                weight: we.weight,
                                exercise: {
                                    id: we.exercise.id,
                                    name: we.exercise.name,
                                    type: we.exercise.type,
                                    exerciseMuscleGroups: we.exercise.exerciseMuscleGroups || [],
                                },
                            })),
                        }
                    }),
                })),
            }

            setProgram(transformedProgram)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('editProgram.errorLoading'))
        } finally {
            setLoading(false)
            loadingRef.current = false
        }
    }

    const handleWeekTypeChange = async (weekId: string, newType: 'normal' | 'test' | 'deload') => {
        if (!program) return

        try {
            setSaving(true)

            const res = await fetch(`/api/weeks/${weekId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ weekType: newType }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('editProgram.errorEditWeek'), t))
            }

            await fetchProgram()
        } catch (err: unknown) {
            showToast(err instanceof Error ? err.message : t('editProgram.errorEditWeek'), 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleCopyFirstWeekWorkouts = async () => {
        try {
            setCopyingFirstWeek(true)

            const res = await fetch(`/api/programs/${programId}/copy-first-week`, {
                method: 'POST',
            })
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('editProgram.copyFirstWeekError'), t))
            }

            await fetchProgram()
            showToast(t('editProgram.copyFirstWeekSuccess'), 'success')
            setConfirmCopyOpen(false)
        } catch (err: unknown) {
            showToast(
                err instanceof Error ? err.message : t('editProgram.copyFirstWeekError'),
                'error'
            )
        } finally {
            setCopyingFirstWeek(false)
        }
    }

    const handleCopyWeekToNext = async () => {
        if (!confirmCopyNextWeek) return

        try {
            setCopyingWeekId(confirmCopyNextWeek.id)

            const res = await fetch(`/api/programs/${programId}/copy-week`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sourceWeekId: confirmCopyNextWeek.id }),
            })
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('editProgram.copyWeekError'), t))
            }

            await fetchProgram()
            showToast(
                t('editProgram.copyWeekSuccess', {
                    sourceWeek: confirmCopyNextWeek.weekNumber,
                    targetWeek: confirmCopyNextWeek.weekNumber + 1,
                }),
                'success'
            )
            setConfirmCopyNextWeek(null)
        } catch (err: unknown) {
            showToast(
                err instanceof Error ? err.message : t('editProgram.copyWeekError'),
                'error'
            )
        } finally {
            setCopyingWeekId(null)
        }
    }

    const getTotalExercises = () => {
        if (!program) return 0
        return program.weeks.reduce(
            (total, week) =>
                total + week.workouts.reduce((sum, w) => sum + w.exerciseCount, 0),
            0
        )
    }

    const getCompletedWorkouts = () => {
        if (!program) return 0
        return program.weeks.reduce(
            (total, week) => total + week.workouts.filter((w) => w.exerciseCount > 0).length,
            0
        )
    }

    const totalWorkouts = program ? program.durationWeeks * program.workoutsPerWeek : 0
    const completedWorkouts = getCompletedWorkouts()
    const progressPercent = totalWorkouts > 0 ? Math.round((completedWorkouts / totalWorkouts) * 100) : 0

    const recordsByExercise = personalRecords.reduce((acc, record) => {
        const key = record.exerciseId
        if (!acc[key]) {
            acc[key] = []
        }
        acc[key].push(record)
        return acc
    }, {} as Record<string, PersonalRecord[]>)

    const bestPRs = Object.values(recordsByExercise).map((records) =>
        records.reduce((best, current) => {
            const currentEstimatedOneRM = estimateOneRMValue(current.weight, current.reps)
            const bestEstimatedOneRM = estimateOneRMValue(best.weight, best.reps)
            return currentEstimatedOneRM > bestEstimatedOneRM ? current : best
        })
    )

    const estimatedOneRMByExercise = bestPRs.reduce((acc, record) => {
        acc[record.exerciseId] = estimateOneRMValue(record.weight, record.reps)
        return acc
    }, {} as Record<string, number>)

    const weekSbdMetrics = program
        ? program.weeks.reduce((acc, week) => {
            acc[week.id] = Object.values(
                week.workouts.reduce((weekAcc, workout) => {
                    workout.workoutExercises
                        .filter((weekExercise) => weekExercise.exercise.type === 'fundamental' && !weekExercise.isWarmup)
                        .forEach((weekExercise) => {
                            const key = weekExercise.exercise.id
                            const plannedReps = parseRepsValue(weekExercise.reps)
                            const liftCount = weekExercise.sets * plannedReps

                            let intensity: number | null = null
                            if (weekExercise.weightType === 'percentage_1rm' && typeof weekExercise.weight === 'number') {
                                intensity = weekExercise.weight
                            } else if (weekExercise.weightType === 'absolute' && typeof weekExercise.weight === 'number') {
                                const estimatedOneRM = estimatedOneRMByExercise[weekExercise.exercise.id]
                                if (estimatedOneRM) {
                                    intensity = (weekExercise.weight / estimatedOneRM) * 100
                                }
                            }

                            if (!weekAcc[key]) {
                                weekAcc[key] = {
                                    exerciseId: weekExercise.exercise.id,
                                    exerciseName: weekExercise.exercise.name,
                                    workoutIds: new Set<string>(),
                                    totalLifts: 0,
                                    weightedIntensitySum: 0,
                                    intensityLiftCount: 0,
                                }
                            }

                            weekAcc[key].workoutIds.add(workout.id)
                            weekAcc[key].totalLifts += liftCount

                            if (intensity !== null && liftCount > 0) {
                                weekAcc[key].weightedIntensitySum += intensity * liftCount
                                weekAcc[key].intensityLiftCount += liftCount
                            }
                        })

                    return weekAcc
                }, {} as Record<string, {
                    exerciseId: string
                    exerciseName: string
                    workoutIds: Set<string>
                    totalLifts: number
                    weightedIntensitySum: number
                    intensityLiftCount: number
                }>)
            )
                .map((metric) => ({
                    exerciseId: metric.exerciseId,
                    exerciseName: metric.exerciseName,
                    frequency: metric.workoutIds.size,
                    totalLifts: metric.totalLifts,
                    averageIntensity: metric.intensityLiftCount > 0
                        ? metric.weightedIntensitySum / metric.intensityLiftCount
                        : null,
                }))
                .sort((left, right) => left.exerciseName.localeCompare(right.exerciseName, 'it', { sensitivity: 'base' }))

            return acc
        }, {} as Record<string, Array<{
            exerciseId: string
            exerciseName: string
            frequency: number
            totalLifts: number
            averageIntensity: number | null
        }>>)
        : {}

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
                    {error || t('editProgram.notFound')}
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Progress Indicator - Only in Edit Mode */}
                {!readOnly && (
                    <div className="mb-8">
                        <div className="flex items-center justify-center space-x-4 mb-4">
                            <div className="flex items-center">
                                <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">
                                    ✓
                                </div>
                                <span className="ml-2 font-semibold text-gray-900">{t('editProgram.stepSetup')}</span>
                            </div>
                            <div className="w-16 h-1 bg-[#FFA700]"></div>
                            <div className="flex items-center">
                                <div className="w-10 h-10 bg-[#FFA700] text-white rounded-full flex items-center justify-center font-bold">
                                    2
                                </div>
                                <span className="ml-2 font-semibold text-gray-900">{t('editProgram.stepExercises')}</span>
                            </div>
                            <div className="w-16 h-1 bg-gray-300"></div>
                            <div className="flex items-center">
                                <div className="w-10 h-10 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center font-bold">
                                    3
                                </div>
                                <span className="ml-2 text-gray-500">{t('editProgram.stepReview')}</span>
                            </div>
                            <div className="w-16 h-1 bg-gray-300"></div>
                            <div className="flex items-center">
                                <div className="w-10 h-10 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center font-bold">
                                    4
                                </div>
                                <span className="ml-2 text-gray-500">{t('editProgram.stepPublish')}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/trainer/programs"
                        className="text-brand-primary hover:text-brand-primary/80 text-sm font-semibold mb-4 inline-flex items-center gap-1"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {t('editProgram.backToPrograms')}
                    </Link>
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">{program.title}</h1>
                            <p className="text-gray-600 mt-2">
                                {t('editProgram.forTrainee', { name: `${program.trainee.firstName} ${program.trainee.lastName}` })} •{' '}
                                {t('editProgram.programMeta', { duration: program.durationWeeks, perWeek: program.workoutsPerWeek })}
                            </p>
                        </div>
                        <div>
                            {readOnly && program.status === 'draft' && (
                                <Link
                                    href={`/trainer/programs/${programId}/edit`}
                                    className="bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold py-2 px-4 rounded-lg transition-colors inline-flex items-center gap-2"
                                >
                                    <FileEdit className="w-4 h-4" />
                                    {t('editProgram.editProgram', 'Modifica Programma')}
                                </Link>
                            )}
                            {!readOnly && (
                                <EditProgramMetadata
                                    programId={programId}
                                    initialTitle={program.title}
                                    initialTraineeId={program.trainee.id}
                                    initialDurationWeeks={program.durationWeeks}
                                    initialWorkoutsPerWeek={program.workoutsPerWeek}
                                    status={program.status}
                                    onUpdate={fetchProgram}
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Progress Card */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-sm font-semibold text-gray-700">
                                {t('editProgram.progressTitle')}
                            </p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">
                                {t('editProgram.workoutsConfigured', { completed: completedWorkouts, total: totalWorkouts })}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-3xl font-bold text-[#FFA700]">{progressPercent}%</p>
                            <p className="text-sm text-gray-600">{t('editProgram.completion')}</p>
                        </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                            className="bg-[#FFA700] h-3 rounded-full transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                    <p className="text-sm text-gray-600 mt-4">
                        {t('editProgram.totalExercises')} <span className="font-semibold">{getTotalExercises()}</span>
                    </p>
                </div>

                {/* Weeks Overview */}
                <div className="space-y-6">
                    {program.weeks.map((week) => (
                        <div key={week.id} className="bg-white rounded-lg shadow-md p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-4">
                                    <h3 className="text-xl font-bold text-gray-900">
                                        {t('editProgram.week')} {week.weekNumber}
                                    </h3>
                                    {!readOnly && week.weekNumber === 1 && program.weeks.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => setConfirmCopyOpen(true)}
                                            disabled={copyingFirstWeek || saving}
                                            className="inline-flex items-center gap-2 rounded-lg border border-brand-primary/20 bg-brand-primary/10 px-3 py-2 text-sm font-semibold text-brand-primary transition-colors hover:bg-brand-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {copyingFirstWeek ? (
                                                <LoadingSpinner size="sm" color="primary" />
                                            ) : (
                                                <Copy className="h-4 w-4" />
                                            )}
                                            {t('editProgram.copyFirstWeekButton')}
                                        </button>
                                    )}
                                    {!readOnly && week.weekNumber >= 2 && week.weekNumber < program.weeks.length && (
                                        <button
                                            type="button"
                                            onClick={() => setConfirmCopyNextWeek(week)}
                                            disabled={copyingWeekId !== null || copyingFirstWeek || saving}
                                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {copyingWeekId === week.id ? (
                                                <LoadingSpinner size="sm" color="primary" />
                                            ) : (
                                                <Copy className="h-4 w-4" />
                                            )}
                                            {t('editProgram.copyWeekButton', {
                                                sourceWeek: week.weekNumber,
                                                targetWeek: week.weekNumber + 1,
                                            })}
                                        </button>
                                    )}
                                    {readOnly ? (
                                        <div className="flex items-center gap-2">
                                            <WeekTypeBadge weekType={week.weekType} />
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleWeekTypeChange(week.id, 'normal')}
                                                disabled={saving}
                                                className={`px-3 py-1 text-xs font-semibold rounded-full border-2 transition-all flex items-center gap-1.5 ${week.weekType === 'normal'
                                                    ? 'bg-gray-500 text-white border-gray-500'
                                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                                    }`}
                                            >
                                                <ClipboardList className="w-3.5 h-3.5" />
                                                Standard
                                            </button>
                                            <button
                                                onClick={() => handleWeekTypeChange(week.id, 'test')}
                                                disabled={saving}
                                                className={`px-3 py-1 text-xs font-semibold rounded-full border-2 transition-all flex items-center gap-1.5 ${week.weekType === 'test'
                                                    ? 'bg-week-test text-white border-week-test'
                                                    : 'bg-white text-week-test-dark border-week-test hover:bg-week-test-light'
                                                    }`}
                                            >
                                                <Flame className="w-3.5 h-3.5" />
                                                Test
                                            </button>
                                            <button
                                                onClick={() => handleWeekTypeChange(week.id, 'deload')}
                                                disabled={saving}
                                                className={`px-3 py-1 text-xs font-semibold rounded-full border-2 transition-all flex items-center gap-1.5 ${week.weekType === 'deload'
                                                    ? 'bg-week-deload text-white border-week-deload'
                                                    : 'bg-white text-week-deload-dark border-week-deload hover:bg-week-deload-light'
                                                    }`}
                                            >
                                                <Wind className="w-3.5 h-3.5" />
                                                Scarico
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <p className="text-sm text-gray-600">
                                    {t('editProgram.workoutsConfiguredShort', { done: week.workouts.filter((w) => w.exerciseCount > 0).length, total: week.workouts.length })}
                                </p>
                            </div>

                            {weekSbdMetrics[week.id] && weekSbdMetrics[week.id].length > 0 && (
                                <div className="mb-5 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <div className="rounded-xl bg-slate-900 p-2 text-white">
                                                <BarChart3 className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">Reportistica SBD</p>
                                                <p className="text-xs text-slate-500">Solo esercizi fondamentali della settimana</p>
                                            </div>
                                        </div>
                                        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">FRQ / NBL / IM</p>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                                        {weekSbdMetrics[week.id].map((metric) => (
                                            <div key={metric.exerciseId} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                                                <p className="text-sm font-semibold text-slate-900">{metric.exerciseName}</p>
                                                <div className="mt-3 grid grid-cols-3 gap-2">
                                                    <div className="rounded-lg bg-slate-50 px-2 py-2 text-center">
                                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">FRQ</p>
                                                        <p className="mt-1 text-base font-bold text-slate-900">{metric.frequency}</p>
                                                    </div>
                                                    <div className="rounded-lg bg-slate-50 px-2 py-2 text-center">
                                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">NBL</p>
                                                        <p className="mt-1 text-base font-bold text-slate-900">{metric.totalLifts}</p>
                                                    </div>
                                                    <div className="rounded-lg bg-slate-50 px-2 py-2 text-center">
                                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">IM</p>
                                                        <p className="mt-1 text-base font-bold text-slate-900">
                                                            {metric.averageIntensity !== null ? `${metric.averageIntensity.toFixed(1)}%` : '-'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {week.workouts.map((workout) => {
                                    const workoutCard = (
                                        <div
                                            className={`group relative overflow-hidden rounded-2xl border p-4 transition-all ${workout.exerciseCount > 0
                                                ? 'border-orange-200 bg-gradient-to-br from-orange-50 via-amber-50 to-white shadow-sm'
                                                : 'border-orange-100 bg-gradient-to-br from-white via-orange-50/60 to-amber-50/80'
                                                } ${!readOnly ? 'hover:-translate-y-0.5 hover:shadow-lg' : ''}`}
                                        >
                                            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#FFA700] via-[#FF9500] to-amber-300 opacity-90" />
                                            <div className="mb-3 flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                                        Workout
                                                    </p>
                                                    <p className="mt-1 text-lg font-bold text-slate-900">
                                                        {(t('editProgram.dayNames', { returnObjects: true }) as string[])[workout.dayOfWeek]}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${workout.exerciseCount > 0
                                                        ? 'bg-orange-100 text-orange-700'
                                                        : 'bg-white/80 text-slate-500 border border-orange-100'
                                                        }`}>
                                                        {workout.exerciseCount > 0 ? `${workout.exerciseCount} ex` : 'Vuoto'}
                                                    </span>
                                                    {!readOnly && (
                                                        <span className="rounded-full bg-gradient-to-br from-[#FFA700] to-[#FF9500] p-1.5 text-white shadow-sm transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                                                            <ArrowUpRight className="h-3.5 w-3.5" />
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mb-3 flex items-center justify-between">
                                                <p className="text-sm text-slate-600">
                                                    {workout.exerciseCount > 0
                                                        ? t('editProgram.exercisesCount', { count: workout.exerciseCount })
                                                        : t('editProgram.noExercises')}
                                                </p>
                                                <span className={`text-sm font-semibold ${workout.exerciseCount > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                    {workout.exerciseCount > 0 ? '✓' : '⚠️'}
                                                </span>
                                            </div>

                                            {workout.movementPatterns.length > 0 ? (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {workout.movementPatterns.map((mp, idx) => (
                                                        <MovementPatternTag
                                                            key={`${mp.id}-${idx}`}
                                                            name={mp.name}
                                                            color={mp.color}
                                                        />
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="rounded-xl border border-dashed border-orange-200 bg-white/80 px-3 py-3 text-xs text-slate-500">
                                                    Nessuno schema motorio ancora associato
                                                </div>
                                            )}
                                        </div>
                                    )

                                    return readOnly ? (
                                        <div key={workout.id}>
                                            {workoutCard}
                                        </div>
                                    ) : (
                                        <Link
                                            key={workout.id}
                                            href={`/trainer/programs/${programId}/workouts/${workout.id}`}
                                        >
                                            {workoutCard}
                                        </Link>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <ProgramMuscleGroupCharts weeks={program.weeks} />

                {/* Action Buttons - Only in Edit Mode */}
                {!readOnly && (
                    <div className="flex space-x-4 mt-8">
                        <Link
                            href={`/trainer/programs/${programId}/review`}
                            className={`flex-1 py-3 px-6 rounded-lg font-semibold text-center transition-colors ${completedWorkouts === totalWorkouts
                                ? 'bg-[#FFA700] hover:bg-[#FF9500] text-white'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                            onClick={(e) => {
                                if (completedWorkouts < totalWorkouts) {
                                    e.preventDefault()
                                    showToast(t('editProgram.configureAllFirst'), 'warning')
                                }
                            }}
                        >
                            {t('editProgram.nextReview')}
                        </Link>
                        <Link
                            href="/trainer/programs"
                            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
                        >
                            {t('editProgram.saveDraft')}
                        </Link>
                    </div>
                )}

                <ConfirmationModal
                    isOpen={confirmCopyOpen}
                    onClose={() => {
                        if (!copyingFirstWeek) {
                            setConfirmCopyOpen(false)
                        }
                    }}
                    onConfirm={handleCopyFirstWeekWorkouts}
                    title={t('editProgram.copyFirstWeekTitle')}
                    message={t('editProgram.copyFirstWeekMessage')}
                    confirmText={t('editProgram.copyFirstWeekConfirm')}
                    variant="warning"
                    isLoading={copyingFirstWeek}
                />

                <ConfirmationModal
                    isOpen={confirmCopyNextWeek !== null}
                    onClose={() => {
                        if (!copyingWeekId) {
                            setConfirmCopyNextWeek(null)
                        }
                    }}
                    onConfirm={handleCopyWeekToNext}
                    title={t('editProgram.copyWeekTitle', {
                        sourceWeek: confirmCopyNextWeek?.weekNumber,
                        targetWeek: confirmCopyNextWeek ? confirmCopyNextWeek.weekNumber + 1 : undefined,
                    })}
                    message={t('editProgram.copyWeekMessage', {
                        sourceWeek: confirmCopyNextWeek?.weekNumber,
                        targetWeek: confirmCopyNextWeek ? confirmCopyNextWeek.weekNumber + 1 : undefined,
                    })}
                    confirmText={t('editProgram.copyWeekConfirm')}
                    variant="warning"
                    isLoading={copyingWeekId !== null}
                />
            </div>
        </div>
    )
}
