'use client'

import { Fragment, useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import LoadingSpinner from '@/components/LoadingSpinner'
import ConfirmationModal from '@/components/ConfirmationModal'
import { useToast } from '@/components/ToastNotification'
import WeekTypeBadge from '@/components/WeekTypeBadge'
import EditProgramMetadata from './EditProgramMetadata'
import MovementPatternTag from '@/components/MovementPatternTag'
import { calculateTrainingSets } from '@/lib/calculations'
import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'
import { ClipboardList, Flame, Wind, ArrowLeft, FileEdit, Copy } from 'lucide-react'

// Brand primary color - default per movement pattern senza colore personalizzato
const PRIMARY_COLOR = '#FFA700'
const MUSCLE_GROUP_CHART_COLORS = [
    '#FFA700',
    '#0F766E',
    '#2563EB',
    '#DC2626',
    '#7C3AED',
    '#0891B2',
    '#65A30D',
    '#EA580C',
]

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
    isWarmup: boolean
    exercise: {
        id: string
        name: string
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

interface EditProgramContentProps {
    readOnly?: boolean
}

export default function EditProgramContent({ readOnly = false }: EditProgramContentProps) {
    const router = useRouter()
    const params = useParams()
    const programId = params.id as string
    const { showToast } = useToast()
    const { t } = useTranslation('trainer')

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [copyingFirstWeek, setCopyingFirstWeek] = useState(false)
    const [program, setProgram] = useState<Program | null>(null)
    const [error, setError] = useState<string | null>(null)
    const loadingRef = useRef(false)
    const [confirmCopyOpen, setConfirmCopyOpen] = useState(false)
    const [visibleMuscleGroupIds, setVisibleMuscleGroupIds] = useState<string[]>([])

    useEffect(() => {
        fetchProgram()
    }, [programId])

    const formatTrainingSetsValue = (value: number) => {
        return Number.isInteger(value) ? value.toString() : value.toFixed(1)
    }

    const getHeatmapCellColor = (value: number, maxValue: number, baseColor: string) => {
        if (value <= 0 || maxValue <= 0) {
            return '#F3F4F6'
        }

        const normalized = Math.max(0.18, value / maxValue)
        const hex = baseColor.replace('#', '')
        const normalizedHex =
            hex.length === 3
                ? hex
                    .split('')
                    .map((char) => `${char}${char}`)
                    .join('')
                : hex

        const red = Number.parseInt(normalizedHex.slice(0, 2), 16)
        const green = Number.parseInt(normalizedHex.slice(2, 4), 16)
        const blue = Number.parseInt(normalizedHex.slice(4, 6), 16)

        return `rgba(${red}, ${green}, ${blue}, ${normalized})`
    }

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

            // Trasforma i dati per calcolare exerciseCount e estrarre movement patterns da workoutExercises
            const transformedProgram = {
                ...data.data.program,
                weeks: data.data.program.weeks.map((week: any) => ({
                    ...week,
                    workouts: week.workouts.map((workout: any) => {
                        const workoutExercises = workout.workoutExercises || []
                        const trainerId = data.data.program.trainerId

                        // Estrai movement pattern (uno per esercizio, con duplicati)
                        console.log(
                            `[workout ${workout.id}] exercises:`,
                            workoutExercises.map((we: any) => ({
                                exercise: we.exercise?.name,
                                movementPattern: we.exercise?.movementPattern?.name ?? '⚠️ missing',
                            }))
                        )
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
                                isWarmup: we.isWarmup,
                                exercise: {
                                    id: we.exercise.id,
                                    name: we.exercise.name,
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
    const muscleGroupCatalog = new Map<string, { id: string; name: string }>()

    const weeklyMuscleGroupTotals = (program?.weeks || []).map((week) => {
        const totals = new Map<string, number>()

        week.workouts.forEach((workout) => {
            workout.workoutExercises.forEach((workoutExercise) => {
                workoutExercise.exercise.exerciseMuscleGroups.forEach((entry) => {
                    muscleGroupCatalog.set(entry.muscleGroup.id, entry.muscleGroup)

                    const trainingSets = calculateTrainingSets(
                        workoutExercise.sets,
                        entry.coefficient,
                        workoutExercise.isWarmup
                    )

                    if (trainingSets <= 0) {
                        return
                    }

                    totals.set(
                        entry.muscleGroup.id,
                        (totals.get(entry.muscleGroup.id) || 0) + trainingSets
                    )
                })
            })
        })

        return {
            weekNumber: week.weekNumber,
            totals,
        }
    })

    const muscleGroupSeries = Array.from(muscleGroupCatalog.values())
        .sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }))
        .map((muscleGroup, index) => ({
            ...muscleGroup,
            color: MUSCLE_GROUP_CHART_COLORS[index % MUSCLE_GROUP_CHART_COLORS.length],
        }))

    useEffect(() => {
        setVisibleMuscleGroupIds((currentIds) => {
            const availableIds = muscleGroupSeries.map((muscleGroup) => muscleGroup.id)

            if (availableIds.length === 0) {
                return currentIds.length === 0 ? currentIds : []
            }

            if (currentIds.length === 0) {
                return availableIds
            }

            const nextIds = currentIds.filter((id) => availableIds.includes(id))

            if (nextIds.length === 0) {
                return availableIds
            }

            const hasSameIds =
                nextIds.length === currentIds.length && nextIds.every((id, index) => id === currentIds[index])

            return hasSameIds ? currentIds : nextIds
        })
    }, [muscleGroupSeries])

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

    const weeklyMuscleGroupChartData = weeklyMuscleGroupTotals.map(({ weekNumber, totals }) => {
        const chartRow: Record<string, number | string> = {
            weekNumber,
            weekLabel: `${t('editProgram.week')} ${weekNumber}`,
        }

        muscleGroupSeries.forEach((muscleGroup) => {
            chartRow[muscleGroup.id] = Number((totals.get(muscleGroup.id) || 0).toFixed(1))
        })

        return chartRow
    })

    const visibleMuscleGroups = muscleGroupSeries.filter((muscleGroup) =>
        visibleMuscleGroupIds.includes(muscleGroup.id)
    )

    const hasWeeklyMuscleGroupData = weeklyMuscleGroupChartData.some((row) =>
        muscleGroupSeries.some((muscleGroup) => Number(row[muscleGroup.id] || 0) > 0)
    )

    const hasVisibleWeeklyMuscleGroupData = weeklyMuscleGroupChartData.some((row) =>
        visibleMuscleGroups.some((muscleGroup) => Number(row[muscleGroup.id] || 0) > 0)
    )

    const heatmapMaxValue = weeklyMuscleGroupChartData.reduce((maxValue, row) => {
        return Math.max(
            maxValue,
            ...visibleMuscleGroups.map((muscleGroup) => Number(row[muscleGroup.id] || 0))
        )
    }, 0)

    const toggleMuscleGroupVisibility = (muscleGroupId: string) => {
        setVisibleMuscleGroupIds((currentIds) => {
            if (currentIds.includes(muscleGroupId)) {
                if (currentIds.length === 1) {
                    return currentIds
                }

                return currentIds.filter((id) => id !== muscleGroupId)
            }

            return [...currentIds, muscleGroupId]
        })
    }

    const showAllMuscleGroups = () => {
        setVisibleMuscleGroupIds(muscleGroupSeries.map((muscleGroup) => muscleGroup.id))
    }

    const heatmapLegendStops = [0, 0.33, 0.66, 1].map((stop) => ({
        stop,
        color: getHeatmapCellColor(heatmapMaxValue * stop, heatmapMaxValue, PRIMARY_COLOR),
    }))

    const totalMuscleGroupTrainingSets = weeklyMuscleGroupTotals.reduce((totalsByMuscleGroup, { totals }) => {
        totals.forEach((value, muscleGroupId) => {
            totalsByMuscleGroup.set(muscleGroupId, (totalsByMuscleGroup.get(muscleGroupId) || 0) + value)
        })

        return totalsByMuscleGroup
    }, new Map<string, number>())

    const muscleGroupChartData = muscleGroupSeries
        .map((muscleGroup) => ({
            id: muscleGroup.id,
            name: muscleGroup.name,
            total: Number((totalMuscleGroupTrainingSets.get(muscleGroup.id) || 0).toFixed(1)),
            color: muscleGroup.color,
        }))
        .filter((muscleGroup) => muscleGroup.total > 0)
        .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }))

    const hasMuscleGroupChartData = muscleGroupChartData.length > 0

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

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {week.workouts.map((workout) => {
                                    const workoutCard = (
                                        <div
                                            className={`border-2 rounded-lg p-4 transition-all ${workout.exerciseCount > 0
                                                ? 'border-green-300 bg-green-50'
                                                : 'border-gray-300 bg-white'
                                                } ${!readOnly ? 'hover:shadow-md hover:border-green-400' : ''}`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="font-semibold text-gray-900">
                                                    {(t('editProgram.dayNames', { returnObjects: true }) as string[])[workout.dayOfWeek]}
                                                </p>
                                                {workout.exerciseCount > 0 ? (
                                                    <span className="text-green-600 text-sm font-semibold">
                                                        ✓
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 text-sm">⚠️</span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-600 mb-2">
                                                {workout.exerciseCount > 0
                                                    ? t('editProgram.exercisesCount', { count: workout.exerciseCount })
                                                    : t('editProgram.noExercises')}
                                            </p>
                                            {workout.movementPatterns.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mb-2">
                                                    {workout.movementPatterns.map((mp, idx) => (
                                                        <MovementPatternTag
                                                            key={`${mp.id}-${idx}`}
                                                            name={mp.name}
                                                            color={mp.color}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                            {!readOnly && (
                                                <p className="text-xs text-[#FFA700] font-semibold mt-2">
                                                    {workout.exerciseCount > 0
                                                        ? t('editProgram.edit')
                                                        : t('editProgram.configure')}
                                                </p>
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

                <div className="bg-white rounded-lg shadow-md p-6 mt-8">
                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-gray-900">
                            {t('editProgram.trainingSetsHeatmapTitle')}
                        </h2>
                        <p className="text-sm text-gray-600 mt-2">
                            {t('editProgram.trainingSetsHeatmapDescription')}
                        </p>
                    </div>

                    {hasWeeklyMuscleGroupData && (
                        <div className="mb-6 space-y-4">
                            <div>
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <p className="text-sm font-medium text-gray-700">
                                        {t('editProgram.trainingSetsFilterTitle')}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={showAllMuscleGroups}
                                        className="text-sm font-semibold text-[#0F766E] hover:text-[#115E59]"
                                    >
                                        {t('editProgram.trainingSetsFilterReset')}
                                    </button>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {muscleGroupSeries.map((muscleGroup) => {
                                        const isActive = visibleMuscleGroupIds.includes(muscleGroup.id)

                                        return (
                                            <button
                                                key={muscleGroup.id}
                                                type="button"
                                                onClick={() => toggleMuscleGroupVisibility(muscleGroup.id)}
                                                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${isActive
                                                    ? 'border-gray-300 bg-gray-900 text-white'
                                                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
                                                    }`}
                                            >
                                                <span
                                                    className="h-2.5 w-2.5 rounded-full"
                                                    style={{ backgroundColor: muscleGroup.color }}
                                                />
                                                {muscleGroup.name}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                                <div className="flex items-center justify-between gap-4 flex-wrap">
                                    <p className="text-sm font-medium text-gray-700">
                                        {t('editProgram.trainingSetsHeatmapLegendTitle')}
                                    </p>
                                    <div className="flex items-center gap-3 text-xs text-gray-600">
                                        <span>{t('editProgram.trainingSetsHeatmapLegendLow')}</span>
                                        <div className="flex items-center gap-1">
                                            {heatmapLegendStops.map((item, index) => (
                                                <span
                                                    key={`${item.stop}-${index}`}
                                                    className="h-4 w-8 rounded-sm border border-white/70"
                                                    style={{ backgroundColor: item.color }}
                                                />
                                            ))}
                                        </div>
                                        <span>{t('editProgram.trainingSetsHeatmapLegendHigh')}</span>
                                        <span className="rounded-full bg-white px-2 py-1 font-semibold text-gray-700">
                                            {t('editProgram.trainingSetsHeatmapLegendMax', {
                                                value: formatTrainingSetsValue(heatmapMaxValue),
                                                unit: t('editProgram.trainingSetsUnit'),
                                            })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {hasVisibleWeeklyMuscleGroupData ? (
                        <>
                            <div className="overflow-x-auto">
                                <div
                                    className="grid gap-2 min-w-max"
                                    style={{
                                        gridTemplateColumns: `minmax(180px, 220px) repeat(${weeklyMuscleGroupChartData.length}, minmax(64px, 1fr))`,
                                    }}
                                >
                                    <div className="sticky left-0 z-10 bg-white" />
                                    {weeklyMuscleGroupChartData.map((row) => (
                                        <div
                                            key={String(row.weekNumber)}
                                            className="rounded-md bg-gray-50 px-2 py-3 text-center text-xs font-semibold text-gray-600"
                                        >
                                            {row.weekLabel}
                                        </div>
                                    ))}

                                    {visibleMuscleGroups.map((muscleGroup) => (
                                        <Fragment key={muscleGroup.id}>
                                            <div
                                                className="sticky left-0 z-10 flex items-center rounded-md bg-white pr-3 text-sm font-medium text-gray-700"
                                            >
                                                <span
                                                    className="mr-3 inline-block h-3 w-3 rounded-full"
                                                    style={{ backgroundColor: muscleGroup.color }}
                                                />
                                                {muscleGroup.name}
                                            </div>
                                            {weeklyMuscleGroupChartData.map((row) => {
                                                const value = Number(row[muscleGroup.id] || 0)

                                                return (
                                                    <div
                                                        key={`${muscleGroup.id}-${String(row.weekNumber)}`}
                                                        className="flex h-14 items-center justify-center rounded-md border border-white/60 text-xs font-semibold"
                                                        style={{
                                                            backgroundColor: getHeatmapCellColor(
                                                                value,
                                                                heatmapMaxValue,
                                                                muscleGroup.color
                                                            ),
                                                            color: value > 0 ? '#111827' : '#9CA3AF',
                                                        }}
                                                        title={`${muscleGroup.name} - ${String(row.weekLabel)}: ${formatTrainingSetsValue(value)} ${t('editProgram.trainingSetsUnit')}`}
                                                    >
                                                        {value > 0
                                                            ? formatTrainingSetsValue(value)
                                                            : '-'}
                                                    </div>
                                                )
                                            })}
                                        </Fragment>
                                    ))}
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-4">
                                {t('editProgram.trainingSetsHeatmapFootnote')}
                            </p>
                        </>
                    ) : hasWeeklyMuscleGroupData ? (
                        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
                            {t('editProgram.trainingSetsFilterEmpty')}
                        </div>
                    ) : (
                        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
                            {t('editProgram.trainingSetsByMuscleGroupEmpty')}
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-lg shadow-md p-6 mt-8">
                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-gray-900">
                            {t('editProgram.trainingSetsTrendTitle')}
                        </h2>
                        <p className="text-sm text-gray-600 mt-2">
                            {t('editProgram.trainingSetsTrendDescription')}
                        </p>
                    </div>

                    {hasVisibleWeeklyMuscleGroupData ? (
                        <>
                            <div className="h-96">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={weeklyMuscleGroupChartData} margin={{ left: 12, right: 12 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="weekLabel" />
                                        <YAxis />
                                        <Tooltip
                                            formatter={(value: number, name: string) => [
                                                `${formatTrainingSetsValue(Number(value))} ${t('editProgram.trainingSetsUnit')}`,
                                                muscleGroupSeries.find((muscleGroup) => muscleGroup.id === name)
                                                    ?.name || name,
                                            ]}
                                        />
                                        <Legend
                                            formatter={(value) =>
                                                visibleMuscleGroups.find((muscleGroup) => muscleGroup.id === value)
                                                    ?.name || value
                                            }
                                        />
                                        {visibleMuscleGroups.map((muscleGroup) => (
                                            <Line
                                                key={muscleGroup.id}
                                                type="monotone"
                                                dataKey={muscleGroup.id}
                                                stroke={muscleGroup.color}
                                                strokeWidth={2.5}
                                                dot={{ r: 3 }}
                                                activeDot={{ r: 5 }}
                                            />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <p className="text-xs text-gray-500 mt-4">
                                {t('editProgram.trainingSetsTrendFootnote')}
                            </p>
                        </>
                    ) : hasWeeklyMuscleGroupData ? (
                        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
                            {t('editProgram.trainingSetsFilterEmpty')}
                        </div>
                    ) : (
                        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
                            {t('editProgram.trainingSetsByMuscleGroupEmpty')}
                        </div>
                    )}
                </div>

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
            </div>
        </div>
    )
}
