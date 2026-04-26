'use client'

import { MouseEvent, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, FileEdit } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'
import MovementPatternTag from '@/components/MovementPatternTag'
import WeekTypeBadge from '@/components/WeekTypeBadge'
import ProgramMuscleGroupCharts from '@/components/ProgramMuscleGroupCharts'
import { getApiErrorMessage } from '@/lib/api-error'
import ProgramPdfExportButton from '@/components/ProgramPdfExportButton'
import { ProgramPdfData, ProgramPdfLabels } from '@/lib/program-pdf-export'

const PRIMARY_COLOR = 'rgb(var(--brand-primary))'
type RestTimeValue = 's30' | 'm1' | 'm2' | 'm3' | 'm5'

interface MovementPatternColorSummary {
    color: string
    trainerId: string
}

interface MovementPatternSummary {
    id: string
    name: string
    movementPatternColors: MovementPatternColorSummary[]
}

interface WorkoutExerciseSummary {
    id: string
    sets: number
    reps: string
    variant?: string | null
    targetRpe: number | null
    weightType: 'absolute' | 'percentage_1rm' | 'percentage_rm' | 'percentage_previous'
    weight: number | null
    effectiveWeight: number | null
    restTime: RestTimeValue
    isWarmup: boolean
    notes: string | null
    exercise: {
        id: string
        name: string
        type: 'fundamental' | 'accessory'
        movementPattern: MovementPatternSummary | null
        exerciseMuscleGroups: {
            coefficient: number
            muscleGroup: {
                id: string
                name: string
            }
        }[]
    }
}

interface WorkoutSummary {
    id: string
    dayIndex: number
    workoutExercises: WorkoutExerciseSummary[]
}

interface WeekSummary {
    id: string
    weekNumber: number
    weekType: 'normal' | 'test' | 'deload'
    workouts: WorkoutSummary[]
}

interface ProgramSummary {
    id: string
    title: string
    startDate: string | null
    status: 'draft' | 'active' | 'completed'
    isSbdProgram: boolean
    trainer: {
        id: string
        firstName: string
        lastName: string
    }
    trainee: {
        id: string
        firstName: string
        lastName: string
    }
    durationWeeks: number
    workoutsPerWeek: number
    weeks: WeekSummary[]
}

interface ReviewProgramContentProps {
    viewOnly?: boolean
}

type ViewWizardStep = 'structure' | 'exercises' | 'report'

function parseRepsValue(repsValue: string): number {
    const match = repsValue.match(/^\d+/)
    return match ? parseInt(match[0], 10) : 0
}

function roundWeightValue(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100
}

function formatWeightForDisplay(value: number): string {
    const roundedValue = roundWeightValue(value)

    if (Number.isInteger(roundedValue)) {
        return String(roundedValue)
    }

    return roundedValue.toFixed(2).replace(/\.?0+$/, '')
}

function parseRgbColor(color: string): { r: number; g: number; b: number } | null {
    const hexMatch = color.trim().match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
    if (hexMatch) {
        return {
            r: parseInt(hexMatch[1], 16),
            g: parseInt(hexMatch[2], 16),
            b: parseInt(hexMatch[3], 16),
        }
    }

    const rgbMatch = color
        .trim()
        .match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?\s*\)$/i)
    if (rgbMatch) {
        return {
            r: Number(rgbMatch[1]),
            g: Number(rgbMatch[2]),
            b: Number(rgbMatch[3]),
        }
    }

    return null
}

function getMovementPatternRowStyle(color?: string | null): CSSProperties | undefined {
    if (!color) {
        return undefined
    }

    if (color.includes('var(--brand-primary)')) {
        return {
            backgroundColor: 'rgba(var(--brand-primary), 0.12)',
            borderLeftColor: 'rgba(var(--brand-primary), 0.8)',
        }
    }

    const rgb = parseRgbColor(color)
    if (!rgb) {
        return undefined
    }

    return {
        backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14)`,
        borderLeftColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.85)`,
    }
}

function getExerciseMovementPatternColor(
    exercise: WorkoutExerciseSummary['exercise'],
    trainerId?: string
): string | null {
    if (!exercise.movementPattern) {
        return null
    }

    const trainerColor = trainerId
        ? exercise.movementPattern.movementPatternColors.find(
            (entry) => entry.trainerId === trainerId
        )?.color
        : undefined

    return trainerColor || exercise.movementPattern.movementPatternColors[0]?.color || PRIMARY_COLOR
}

function formatPlannedWeight(
    weightType: WorkoutExerciseSummary['weightType'],
    weight: number | null
): string {
    if (typeof weight !== 'number') {
        return '-'
    }

    if (weightType === 'absolute') {
        return `${weight} kg`
    }

    return `${weight}%`
}

function resolveEffectiveWeightFallback({
    workoutExercise,
    previousEffectiveWeightByExerciseId,
    estimatedOneRMByExercise,
    bestWeightByExerciseAndReps,
}: {
    workoutExercise: WorkoutExerciseSummary
    previousEffectiveWeightByExerciseId: Record<string, number | null>
    estimatedOneRMByExercise: Record<string, number>
    bestWeightByExerciseAndReps: Record<string, Record<number, number>>
}): number | null {
    if (typeof workoutExercise.weight !== 'number') {
        return null
    }

    if (workoutExercise.weightType === 'absolute') {
        return roundWeightValue(workoutExercise.weight)
    }

    if (workoutExercise.weightType === 'percentage_1rm') {
        const oneRm = estimatedOneRMByExercise[workoutExercise.exercise.id]
        if (!Number.isFinite(oneRm) || oneRm <= 0) {
            return null
        }

        return roundWeightValue((oneRm * workoutExercise.weight) / 100)
    }

    if (workoutExercise.weightType === 'percentage_rm') {
        const targetReps = parseRepsValue(workoutExercise.reps)
        if (targetReps <= 0) {
            return null
        }

        const bestWeight =
            bestWeightByExerciseAndReps[workoutExercise.exercise.id]?.[targetReps]
        if (typeof bestWeight !== 'number') {
            return null
        }

        return roundWeightValue((bestWeight * workoutExercise.weight) / 100)
    }

    const previousEffectiveWeight = previousEffectiveWeightByExerciseId[workoutExercise.exercise.id]
    if (!Number.isFinite(previousEffectiveWeight) || typeof previousEffectiveWeight !== 'number') {
        return null
    }

    return roundWeightValue(previousEffectiveWeight * (1 + workoutExercise.weight / 100))
}

export default function ReviewProgramContent({ viewOnly = false }: ReviewProgramContentProps) {
    const params = useParams()
    const searchParams = useSearchParams()
    const programId = params.id as string
    const { t, i18n } = useTranslation(['trainer', 'navigation'])

    const [loading, setLoading] = useState(true)
    const [program, setProgram] = useState<ProgramSummary | null>(null)
    const [estimatedOneRMByExercise, setEstimatedOneRMByExercise] = useState<Record<string, number>>({})
    const [bestWeightByExerciseAndReps, setBestWeightByExerciseAndReps] = useState<Record<string, Record<number, number>>>({})
    const [error, setError] = useState<string | null>(null)
    const [isSbdSummaryCollapsed, setIsSbdSummaryCollapsed] = useState(false)
    const [activeViewStep, setActiveViewStep] = useState<ViewWizardStep>('report')

    const backContext = searchParams.get('backContext')
    const queryTraineeId = searchParams.get('traineeId') ?? ''
    const resolvedTraineeId = program?.trainee.id || queryTraineeId || ''
    const hasTraineeBackContext = backContext === 'trainee' && Boolean(resolvedTraineeId)
    const navigationContextQuery = hasTraineeBackContext
        ? `?backContext=trainee&traineeId=${encodeURIComponent(resolvedTraineeId)}`
        : ''
    const editProgramHref = `/trainer/programs/${programId}/edit${navigationContextQuery}`

    useEffect(() => {
        const fetchProgram = async () => {
            try {
                setLoading(true)
                const res = await fetch(`/api/programs/${programId}/review`, {
                    cache: 'no-store',
                })
                const data = await res.json()

                if (!res.ok) {
                    throw new Error(getApiErrorMessage(data, t('reviewProgram.errorLoading'), t))
                }

                setProgram(data.data.program)
                setEstimatedOneRMByExercise(data.data.estimatedOneRMByExercise ?? {})
                setBestWeightByExerciseAndReps(data.data.bestWeightByExerciseAndReps ?? {})
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : t('reviewProgram.errorLoading'))
            } finally {
                setLoading(false)
            }
        }

        void fetchProgram()
    }, [programId, t])

    const isDraft = program?.status === 'draft'
    const isProgramEditable = Boolean(isDraft)
    const totalWorkouts = program ? program.durationWeeks * program.workoutsPerWeek : 0
    const configuredWorkouts =
        program?.weeks.reduce(
            (sum, week) =>
                sum + week.workouts.filter((workout) => workout.workoutExercises.length > 0).length,
            0
        ) ?? 0

    const shouldShowSbdReporting = program?.isSbdProgram ?? false

    const weekSbdMetrics = useMemo(
        () =>
            (program?.weeks ?? []).reduce((acc, week) => {
                acc[week.id] = Object.values(
                    week.workouts.reduce(
                        (weekAcc, workout) => {
                            workout.workoutExercises
                                .filter(
                                    (workoutExercise) =>
                                        workoutExercise.exercise.type === 'fundamental' &&
                                        !workoutExercise.isWarmup
                                )
                                .forEach((workoutExercise) => {
                                    const key = workoutExercise.exercise.id
                                    const plannedReps = parseRepsValue(workoutExercise.reps)
                                    const liftCount = workoutExercise.sets * plannedReps

                                    let intensity: number | null = null
                                    if (
                                        workoutExercise.weightType === 'percentage_1rm' &&
                                        typeof workoutExercise.weight === 'number'
                                    ) {
                                        intensity = workoutExercise.weight
                                    } else if (
                                        workoutExercise.weightType === 'absolute' &&
                                        typeof workoutExercise.weight === 'number'
                                    ) {
                                        const estimatedOneRM =
                                            estimatedOneRMByExercise[workoutExercise.exercise.id]
                                        if (estimatedOneRM) {
                                            intensity = (workoutExercise.weight / estimatedOneRM) * 100
                                        }
                                    }

                                    if (!weekAcc[key]) {
                                        weekAcc[key] = {
                                            exerciseId: workoutExercise.exercise.id,
                                            exerciseName: workoutExercise.exercise.name,
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
                        },
                        {} as Record<
                            string,
                            {
                                exerciseId: string
                                exerciseName: string
                                workoutIds: Set<string>
                                totalLifts: number
                                weightedIntensitySum: number
                                intensityLiftCount: number
                            }
                        >
                    )
                )
                    .map((metric) => ({
                        exerciseId: metric.exerciseId,
                        exerciseName: metric.exerciseName,
                        frequency: metric.workoutIds.size,
                        totalLifts: metric.totalLifts,
                        averageIntensity:
                            metric.intensityLiftCount > 0
                                ? metric.weightedIntensitySum / metric.intensityLiftCount
                                : null,
                    }))
                    .sort((left, right) =>
                        left.exerciseName.localeCompare(right.exerciseName, 'it', {
                            sensitivity: 'base',
                        })
                    )

                return acc
            }, {} as Record<string, Array<{ exerciseId: string; exerciseName: string; frequency: number; totalLifts: number; averageIntensity: number | null }>>),
        [estimatedOneRMByExercise, program?.weeks]
    )

    const sbdSummaryRows = useMemo(
        () =>
            shouldShowSbdReporting
                ? (program?.weeks ?? []).flatMap((week) =>
                    (weekSbdMetrics[week.id] || []).map((metric) => ({
                        weekId: week.id,
                        weekNumber: week.weekNumber,
                        exerciseId: metric.exerciseId,
                        exerciseName: metric.exerciseName,
                        frequency: metric.frequency,
                        totalLifts: metric.totalLifts,
                        averageIntensity: metric.averageIntensity,
                    }))
                )
                : [],
        [program?.weeks, shouldShowSbdReporting, weekSbdMetrics]
    )

    const structureByWorkoutIndex = useMemo(() => {
        if (!program) {
            return []
        }

        return Array.from({ length: program.workoutsPerWeek }, (_, workoutIndex) => {
            const exercisesById = new Map<string, WorkoutExerciseSummary['exercise']>()

            program.weeks.forEach((week) => {
                const orderedWorkouts = [...week.workouts].sort(
                    (left, right) => left.dayIndex - right.dayIndex
                )
                const workout = orderedWorkouts[workoutIndex]

                if (!workout) {
                    return
                }

                workout.workoutExercises.forEach((workoutExercise) => {
                    if (!exercisesById.has(workoutExercise.exercise.id)) {
                        exercisesById.set(workoutExercise.exercise.id, workoutExercise.exercise)
                    }
                })
            })

            return {
                workoutIndex,
                exercises: Array.from(exercisesById.values()),
            }
        })
    }, [program])

    const pdfLabels = useMemo<ProgramPdfLabels>(
        () => ({
            trainerLabel: t('reviewProgram.pdfTrainerLabel'),
            startDateLabel: t('reviewProgram.pdfStartDateLabel'),
            generatedAtLabel: t('reviewProgram.pdfGeneratedAtLabel'),
            weekLabel: (week: number) => t('reviewProgram.weekTitle', { week }),
            weekTypeLabel: (weekType: 'normal' | 'test' | 'deload') => {
                if (weekType === 'test') {
                    return t('reviewProgram.weekTypeTest')
                }

                if (weekType === 'deload') {
                    return t('reviewProgram.weekTypeDeload')
                }

                return t('reviewProgram.weekTypeStandard')
            },
            workoutLabel: (dayIndex: number) =>
                t('reviewProgram.workoutTitle', { number: dayIndex }),
            tableExercise: t('reviewProgram.tableExercise'),
            tableVariant: t('reviewProgram.tableVariant'),
            tableScheme: t('reviewProgram.tableScheme'),
            tableWeight: t('reviewProgram.tableWeight'),
            tableRest: t('reviewProgram.tableRest'),
            tableRpe: t('reviewProgram.tableRpe'),
            tableNoExercises: t('reviewProgram.noExercises'),
            tableWeightAssigned: (weight: string) =>
                t('reviewProgram.tableWeightAssigned', { weight }),
            tableWeightEffective: (weight: string) =>
                t('reviewProgram.tableWeightEffective', { weight }),
            warmupYesShort: t('reviewProgram.warmupYesShort'),
            warmupNoShort: t('reviewProgram.warmupNoShort'),
            fundamentalShort: 'F',
            accessoryShort: 'A',
            previousExerciseShort: t('reviewProgram.previousExerciseShort'),
            missingValue: '-',
        }),
        [t]
    )

    const pdfProgramData = useMemo<ProgramPdfData | null>(() => {
        if (!program) {
            return null
        }

        return {
            title: program.title,
            traineeName: `${program.trainee.firstName} ${program.trainee.lastName}`,
            trainerName: `${program.trainer.firstName} ${program.trainer.lastName}`,
            startDate: program.startDate ?? new Date().toISOString(),
            weeks: program.weeks.map((week) => ({
                weekNumber: week.weekNumber,
                weekType: week.weekType,
                workouts: [...week.workouts]
                    .sort((left, right) => left.dayIndex - right.dayIndex)
                    .map((workout) => ({
                        id: workout.id,
                        dayIndex: workout.dayIndex,
                        exercises: workout.workoutExercises.map((workoutExercise) => ({
                            id: workoutExercise.id,
                            name: workoutExercise.exercise.name,
                            variant: workoutExercise.variant ?? null,
                            type: workoutExercise.exercise.type,
                            isWarmup: workoutExercise.isWarmup,
                            sets: workoutExercise.sets,
                            reps: workoutExercise.reps,
                            targetRpe: workoutExercise.targetRpe,
                            weightType: workoutExercise.weightType,
                            weight: workoutExercise.weight,
                            effectiveWeight: workoutExercise.effectiveWeight,
                            restTime: workoutExercise.restTime,
                        })),
                    })),
            })),
        }
    }, [program])

    const locale = i18n.language === 'en' ? 'en-US' : 'it-IT'

    const isStructureStepActive = viewOnly && activeViewStep === 'structure'
    const isStructureStepComplete =
        !viewOnly || activeViewStep === 'exercises' || activeViewStep === 'report'
    const isExercisesStepActive = viewOnly && activeViewStep === 'exercises'
    const isExercisesStepComplete = !viewOnly || activeViewStep === 'report'
    const isReportStepActive = viewOnly ? activeViewStep === 'report' : true

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
                <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-4 text-red-800">
                    {error || t('reviewProgram.notFound')}
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 xl:px-10 2xl:px-12">
                <div className="mb-8">
                    <div className="mb-4 flex flex-wrap items-center justify-center gap-4">
                        <div className="flex items-center">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 font-bold text-white">
                                ✓
                            </div>
                            <span className="ml-2 font-semibold text-gray-900">{t('editProgram.stepSetup')}</span>
                        </div>
                        <div className="h-1 w-16 bg-green-500"></div>
                        <button
                            type="button"
                            onClick={() => {
                                if (viewOnly) {
                                    setActiveViewStep('structure')
                                }
                            }}
                            className={`flex items-center ${viewOnly ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                            <div
                                className={`flex h-10 w-10 items-center justify-center rounded-full font-bold ${isStructureStepActive
                                    ? 'bg-brand-primary text-white'
                                    : isStructureStepComplete
                                        ? 'bg-green-500 text-white'
                                        : 'bg-gray-300 text-gray-600'
                                    }`}
                            >
                                {isStructureStepComplete ? '✓' : '2'}
                            </div>
                            <span
                                className={`ml-2 ${isStructureStepActive
                                    ? 'font-semibold text-gray-900'
                                    : isStructureStepComplete
                                        ? 'font-semibold text-gray-900'
                                        : 'text-gray-500'
                                    }`}
                            >
                                {t('editProgram.stepStructure')}
                            </span>
                        </button>
                        <div className={`h-1 w-16 ${isStructureStepComplete ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <button
                            type="button"
                            onClick={() => {
                                if (viewOnly) {
                                    setActiveViewStep('exercises')
                                }
                            }}
                            className={`flex items-center ${viewOnly ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                            <div
                                className={`flex h-10 w-10 items-center justify-center rounded-full font-bold ${isExercisesStepActive
                                    ? 'bg-brand-primary text-white'
                                    : isExercisesStepComplete
                                        ? 'bg-green-500 text-white'
                                        : 'bg-gray-300 text-gray-600'
                                    }`}
                            >
                                {isExercisesStepComplete ? '✓' : '3'}
                            </div>
                            <span
                                className={`ml-2 ${isExercisesStepActive
                                    ? 'font-semibold text-gray-900'
                                    : isExercisesStepComplete
                                        ? 'font-semibold text-gray-900'
                                        : 'text-gray-500'
                                    }`}
                            >
                                {t('editProgram.stepExercises')}
                            </span>
                        </button>
                        <div className={`h-1 w-16 ${isExercisesStepComplete ? 'bg-brand-primary' : 'bg-gray-300'}`}></div>
                        <button
                            type="button"
                            onClick={() => {
                                if (viewOnly) {
                                    setActiveViewStep('report')
                                }
                            }}
                            className={`flex items-center ${viewOnly ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                            <div
                                className={`flex h-10 w-10 items-center justify-center rounded-full font-bold ${isReportStepActive
                                    ? 'bg-brand-primary text-white'
                                    : 'bg-gray-300 text-gray-600'
                                    }`}
                            >
                                4
                            </div>
                            <span className={`ml-2 ${isReportStepActive ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                                {t('editProgram.stepReview')}
                            </span>
                        </button>
                        <div className="h-1 w-16 bg-gray-300"></div>
                        <div className="flex items-center">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-300 font-bold text-gray-600">
                                5
                            </div>
                            <span className="ml-2 text-gray-500">{t('editProgram.stepPublish')}</span>
                        </div>
                    </div>
                </div>

                <div className="mb-8 flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{t('reviewProgram.title')}</h1>
                        <p className="mt-2 text-gray-600">
                            {t('reviewProgram.description', {
                                name: `${program.trainee.firstName} ${program.trainee.lastName}`,
                            })}
                        </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                        <ProgramPdfExportButton
                            program={pdfProgramData}
                            labels={pdfLabels}
                            buttonLabel={t('reviewProgram.exportPdf')}
                            loadingLabel={t('reviewProgram.exportingPdf')}
                            errorLabel={t('reviewProgram.exportPdfError')}
                            fileNamePrefix={t('reviewProgram.pdfFileNamePrefix')}
                            locale={locale}
                        />

                        {viewOnly &&
                            (isProgramEditable ? (
                                <Link
                                    href={editProgramHref}
                                    className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 font-semibold text-white transition-colors hover:bg-brand-primary-hover"
                                >
                                    <FileEdit className="h-4 w-4" />
                                    {t('editProgram.edit')}
                                </Link>
                            ) : (
                                <button
                                    type="button"
                                    disabled
                                    className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-gray-300 px-4 py-2 font-semibold text-gray-500"
                                >
                                    <FileEdit className="h-4 w-4" />
                                    {t('editProgram.edit')}
                                </button>
                            ))}
                    </div>
                </div>

                {viewOnly && activeViewStep === 'structure' && (
                    <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="mb-4">
                            <h2 className="text-xl font-bold text-gray-900">{t('editProgram.stepStructure')}</h2>
                            <p className="mt-1 text-sm text-gray-600">
                                {t('reviewProgram.summaryConfigured')}: {configuredWorkouts} / {totalWorkouts}
                            </p>
                        </div>

                        <div className="overflow-x-auto">
                            <div className="flex min-w-max gap-4">
                                {structureByWorkoutIndex.map((workoutStructure) => (
                                    <div
                                        key={`structure-workout-${workoutStructure.workoutIndex}`}
                                        className="w-[320px] shrink-0 rounded-lg border border-gray-200 bg-white"
                                    >
                                        <div className="border-b border-gray-100 px-4 py-3">
                                            <h3 className="text-base font-bold text-gray-900">
                                                {t('reviewProgram.workoutTitle', {
                                                    number: workoutStructure.workoutIndex + 1,
                                                })}
                                            </h3>
                                            <p className="text-xs text-gray-500">
                                                {t('reviewProgram.exerciseCount', {
                                                    count: workoutStructure.exercises.length,
                                                })}
                                            </p>
                                        </div>

                                        <div className="space-y-2 p-3">
                                            {workoutStructure.exercises.length === 0 ? (
                                                <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
                                                    {t('reviewProgram.noExercises')}
                                                </p>
                                            ) : (
                                                workoutStructure.exercises.map((exercise) => {
                                                    const movementPatternColor =
                                                        getExerciseMovementPatternColor(
                                                            exercise,
                                                            program.trainer.id
                                                        )
                                                    const rowStyle = getMovementPatternRowStyle(
                                                        movementPatternColor
                                                    )

                                                    return (
                                                        <div
                                                            key={exercise.id}
                                                            className="rounded-lg border border-gray-200 border-l-4 border-l-transparent px-3 py-2"
                                                            style={rowStyle}
                                                        >
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex min-w-0 items-center gap-2">
                                                                    <span
                                                                        className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${exercise.type ===
                                                                            'fundamental'
                                                                            ? 'bg-red-100 text-red-700'
                                                                            : 'bg-blue-100 text-blue-700'
                                                                            }`}
                                                                    >
                                                                        {exercise.type === 'fundamental' ? 'F' : 'A'}
                                                                    </span>
                                                                    <span className="truncate text-sm font-medium text-gray-800">
                                                                        {exercise.name}
                                                                    </span>
                                                                </div>

                                                                {exercise.movementPattern && (
                                                                    <MovementPatternTag
                                                                        name={exercise.movementPattern.name}
                                                                        color={movementPatternColor || PRIMARY_COLOR}
                                                                        className="shrink-0"
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                })
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {viewOnly && activeViewStep === 'exercises' && (
                    <div className="mb-8 space-y-5">
                        {program.weeks.map((week) => {
                            const orderedWorkouts = [...week.workouts].sort(
                                (left, right) => left.dayIndex - right.dayIndex
                            )
                            const configuredForWeek = orderedWorkouts.filter(
                                (workout) => workout.workoutExercises.length > 0
                            ).length

                            return (
                                <section
                                    key={week.id}
                                    className="rounded-2xl border border-gray-200 bg-white shadow-sm"
                                >
                                    <div className="border-b border-gray-100 px-5 py-4">
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                            <div>
                                                <h2 className="text-lg font-bold text-gray-900">
                                                    {t('reviewProgram.weekTitle', { week: week.weekNumber })}
                                                </h2>
                                                <p className="mt-1 text-sm text-gray-600">
                                                    {t('reviewProgram.weekConfigured', {
                                                        done: configuredForWeek,
                                                        total: orderedWorkouts.length,
                                                    })}
                                                </p>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2">
                                                <WeekTypeBadge
                                                    weekType={week.weekType}
                                                    labels={{
                                                        normal: t('reviewProgram.weekTypeStandard'),
                                                        test: t('reviewProgram.weekTypeTest'),
                                                        deload: t('reviewProgram.weekTypeDeload'),
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4 p-4">
                                        {orderedWorkouts.map((workout, workoutIndex) => {
                                            const effectiveWeightByExerciseId: Record<string, number | null> = {}

                                            return (
                                                <div
                                                    key={workout.id}
                                                    className="rounded-lg border border-gray-200 bg-white"
                                                >
                                                    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                                                        <h3 className="text-base font-semibold text-gray-900">
                                                            {t('reviewProgram.workoutTitle', {
                                                                number: workoutIndex + 1,
                                                            })}
                                                        </h3>
                                                        <span className="text-xs font-semibold text-gray-500">
                                                            {t('reviewProgram.exerciseCount', {
                                                                count: workout.workoutExercises.length,
                                                            })}
                                                        </span>
                                                    </div>

                                                    {workout.workoutExercises.length === 0 ? (
                                                        <p className="px-4 py-4 text-sm text-gray-500">
                                                            {t('reviewProgram.noExercises')}
                                                        </p>
                                                    ) : (
                                                        <div className="overflow-x-auto">
                                                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                                                                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                                                                    <tr>
                                                                        <th className="px-3 py-3">
                                                                            {t('reviewProgram.tableExercise')}
                                                                        </th>
                                                                        <th className="px-3 py-3">
                                                                            {t('reviewProgram.tableScheme')}
                                                                        </th>
                                                                        <th className="px-3 py-3">
                                                                            {t('reviewProgram.tableWeight')}
                                                                        </th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-100 bg-white">
                                                                    {workout.workoutExercises.map((workoutExercise) => (
                                                                        <tr key={workoutExercise.id}>
                                                                            <td className="px-3 py-3 align-top">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span
                                                                                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${workoutExercise.exercise.type ===
                                                                                            'fundamental'
                                                                                            ? 'bg-red-100 text-red-700'
                                                                                            : 'bg-blue-100 text-blue-700'
                                                                                            }`}
                                                                                    >
                                                                                        {workoutExercise.exercise.type ===
                                                                                            'fundamental'
                                                                                            ? 'F'
                                                                                            : 'A'}
                                                                                    </span>
                                                                                    <span className="font-medium text-gray-900">
                                                                                        {workoutExercise.exercise.name}
                                                                                    </span>
                                                                                    {workoutExercise.isWarmup && (
                                                                                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                                                                            W
                                                                                        </span>
                                                                                    )}
                                                                                </div>

                                                                                {workoutExercise.variant && (
                                                                                    <p className="mt-1 text-xs text-gray-500">
                                                                                        {workoutExercise.variant}
                                                                                    </p>
                                                                                )}
                                                                            </td>
                                                                            <td className="px-3 py-3 align-top text-gray-700">
                                                                                {workoutExercise.sets} x {workoutExercise.reps}
                                                                                {typeof workoutExercise.targetRpe ===
                                                                                    'number' && (
                                                                                        <span className="ml-2 text-xs text-gray-500">
                                                                                            RPE {workoutExercise.targetRpe}
                                                                                        </span>
                                                                                    )}
                                                                            </td>
                                                                            <td className="px-3 py-3 align-top text-gray-700">
                                                                                {(() => {
                                                                                    const assignedWeight = formatPlannedWeight(
                                                                                        workoutExercise.weightType,
                                                                                        workoutExercise.weight
                                                                                    )
                                                                                    const fallbackEffectiveWeight =
                                                                                        resolveEffectiveWeightFallback({
                                                                                            workoutExercise,
                                                                                            previousEffectiveWeightByExerciseId:
                                                                                                effectiveWeightByExerciseId,
                                                                                            estimatedOneRMByExercise,
                                                                                            bestWeightByExerciseAndReps,
                                                                                        })
                                                                                    const effectiveWeightValue =
                                                                                        typeof workoutExercise.effectiveWeight ===
                                                                                            'number'
                                                                                            ? workoutExercise.effectiveWeight
                                                                                            : fallbackEffectiveWeight

                                                                                    if (
                                                                                        typeof effectiveWeightValue ===
                                                                                        'number'
                                                                                    ) {
                                                                                        effectiveWeightByExerciseId[
                                                                                            workoutExercise.exercise.id
                                                                                        ] = effectiveWeightValue
                                                                                    }

                                                                                    const effectiveWeight =
                                                                                        typeof effectiveWeightValue ===
                                                                                            'number'
                                                                                            ? `${formatWeightForDisplay(
                                                                                                effectiveWeightValue
                                                                                            )} kg`
                                                                                            : '-'

                                                                                    return (
                                                                                        <div className="space-y-1">
                                                                                            <p className="text-xs text-gray-500">
                                                                                                {t(
                                                                                                    'reviewProgram.tableWeightAssigned',
                                                                                                    {
                                                                                                        weight: assignedWeight,
                                                                                                    }
                                                                                                )}
                                                                                            </p>
                                                                                            <p className="text-xs font-semibold text-emerald-700">
                                                                                                {t(
                                                                                                    'reviewProgram.tableWeightEffective',
                                                                                                    {
                                                                                                        weight: effectiveWeight,
                                                                                                    }
                                                                                                )}
                                                                                            </p>
                                                                                        </div>
                                                                                    )
                                                                                })()}
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </section>
                            )
                        })}
                    </div>
                )}

                {(!viewOnly || activeViewStep === 'report') && (
                    <>
                        {shouldShowSbdReporting && sbdSummaryRows.length > 0 && (
                            <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
                                <button
                                    type="button"
                                    onClick={() => setIsSbdSummaryCollapsed((current) => !current)}
                                    className="group flex w-full items-start justify-between gap-4 text-left"
                                    aria-expanded={!isSbdSummaryCollapsed}
                                >
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900">{t('reviewProgram.sbdSummaryTitle')}</h2>
                                        <p className="mt-2 text-sm text-gray-600">
                                            {t('reviewProgram.sbdSummaryDescription')}
                                        </p>
                                    </div>
                                    <span className="rounded-full border border-gray-200 bg-gray-50 p-2 text-gray-500 transition-colors group-hover:bg-gray-100">
                                        {isSbdSummaryCollapsed ? (
                                            <ChevronDown className="h-4 w-4" />
                                        ) : (
                                            <ChevronUp className="h-4 w-4" />
                                        )}
                                    </span>
                                </button>

                                {!isSbdSummaryCollapsed && (
                                    <div className="mt-4 overflow-x-auto">
                                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                                            <thead>
                                                <tr className="text-left text-slate-500">
                                                    <th className="px-3 py-3 font-semibold">{t('reviewProgram.sbdWeekCol')}</th>
                                                    <th className="px-3 py-3 font-semibold">{t('reviewProgram.sbdExerciseCol')}</th>
                                                    <th className="px-3 py-3 font-semibold">{t('reviewProgram.sbdFrqCol')}</th>
                                                    <th className="px-3 py-3 font-semibold">{t('reviewProgram.sbdNblCol')}</th>
                                                    <th className="px-3 py-3 font-semibold">{t('reviewProgram.sbdImCol')}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {sbdSummaryRows.map((row) => (
                                                    <tr key={`${row.weekId}-${row.exerciseId}`} className="hover:bg-slate-50/70">
                                                        <td className="px-3 py-3 font-semibold text-slate-900">
                                                            {t('reviewProgram.sbdWeekShort', { week: row.weekNumber })}
                                                        </td>
                                                        <td className="px-3 py-3 text-slate-700">{row.exerciseName}</td>
                                                        <td className="px-3 py-3 text-slate-700">{row.frequency}</td>
                                                        <td className="px-3 py-3 text-slate-700">{row.totalLifts}</td>
                                                        <td className="px-3 py-3 text-slate-700">
                                                            {row.averageIntensity !== null
                                                                ? `${row.averageIntensity.toFixed(1)}%`
                                                                : '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        <ProgramMuscleGroupCharts weeks={program.weeks} />
                    </>
                )}

                {!viewOnly && (
                    <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                        {isDraft ? (
                            <Link
                                href={editProgramHref}
                                className="flex-1 rounded-lg bg-gray-300 px-6 py-3 text-center font-semibold text-gray-800 transition-colors hover:bg-gray-400"
                            >
                                {t('reviewProgram.backToEdit')}
                            </Link>
                        ) : (
                            <button
                                type="button"
                                disabled
                                className="flex-1 cursor-not-allowed rounded-lg bg-gray-300 px-6 py-3 text-center font-semibold text-gray-500"
                            >
                                {t('reviewProgram.backToEdit')}
                            </button>
                        )}
                        <Link
                            href={`/trainer/programs/${programId}/publish`}
                            className={`flex-1 rounded-lg px-6 py-3 text-center font-semibold transition-colors ${isDraft && configuredWorkouts === totalWorkouts
                                ? 'bg-brand-primary text-white hover:bg-brand-primary-hover'
                                : 'cursor-not-allowed bg-gray-300 text-gray-500'
                                }`}
                            onClick={(event: MouseEvent<HTMLAnchorElement>) => {
                                if (!isDraft || configuredWorkouts < totalWorkouts) {
                                    event.preventDefault()
                                }
                            }}
                        >
                            {t('reviewProgram.continueToPublish')}
                        </Link>
                    </div>
                )}
            </div>
        </div>
    )
}
