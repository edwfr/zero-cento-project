'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import LoadingSpinner from '@/components/LoadingSpinner'
import { useToast } from '@/components/ToastNotification'
import ConfirmationModal from '@/components/ConfirmationModal'
import MovementPatternTag from '@/components/MovementPatternTag'
import { WeightType, RestTime } from '@prisma/client'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import { Trash2, Dumbbell, GripVertical, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react'
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core'
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Exercise {
    id: string
    name: string
    type: 'fundamental' | 'accessory'
    notes?: string[] // Array of variants/notes
    movementPattern: {
        id: string
        name: string
        color?: string
    }
}

interface WorkoutExercise {
    id: string
    order: number
    variant: string | null
    sets: number
    reps: string
    restTime: RestTime
    targetRpe: number | null
    weightType: WeightType
    weight: number | null
    effectiveWeight: number | null
    isWarmup: boolean
    isSkeletonExercise: boolean
    notes: string | null
    exercise: Exercise
}

interface Workout {
    id: string
    dayIndex: number
    notes: string | null
    workoutExercises: WorkoutExercise[]
}

interface ProgramWeek {
    id: string
    weekNumber?: number
    workouts: Workout[]
}

interface Program {
    id: string
    title: string
    status: string
    isSbdProgram: boolean
    weeks: ProgramWeek[]
    trainee: {
        id: string
        firstName: string
        lastName: string
    }
}

interface PersonalRecord {
    id: string
    exerciseId: string
    reps: number
    weight: number
    recordDate: string
    notes: string | null
    exercise: {
        id: string
        name: string
        type: 'fundamental' | 'accessory'
    }
}

function parseRepsValue(repsValue: string): number {
    const match = repsValue.match(/^\d+/)
    return match ? parseInt(match[0], 10) : 0
}

function estimateOneRMValue(weight: number, reps: number): number {
    if (reps <= 1) return weight
    return weight * (1 + reps / 30)
}

function SortableExerciseItem({ id, children }: { id: string; children: React.ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    }
    return (
        <div
            ref={setNodeRef}
            style={style}
            className="bg-white rounded-lg shadow-md p-4"
        >
            <div className="flex items-start gap-2">
                <div {...attributes} {...listeners} className="mt-1 flex items-center text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none">
                    <GripVertical className="w-5 h-5" />
                </div>
                <div className="flex-1">
                    {children}
                </div>
            </div>
        </div>
    )
}

export default function WorkoutDetailContent() {
    const params = useParams()
    const programId = params.id as string
    const workoutId = params.wId as string
    const { t } = useTranslation(['trainer', 'common'])

    const [loading, setLoading] = useState(true)
    const [program, setProgram] = useState<Program | null>(null)
    const [workout, setWorkout] = useState<Workout | null>(null)
    const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([])
    const [error, setError] = useState<string | null>(null)

    const [isPRPanelCollapsed, setIsPRPanelCollapsed] = useState(false)
    const [isSbdPanelCollapsed, setIsSbdPanelCollapsed] = useState(false)
    const { showToast } = useToast()
    const [confirmModal, setConfirmModal] = useState<{
        title: string
        message: string
        onConfirm: () => void
        confirmText?: string
        variant?: 'danger' | 'warning' | 'info' | 'success'
    } | null>(null)

    const fetchData = useCallback(async () => {
        try {
            setLoading(true)

            const programRes = await fetch(`/api/programs/${programId}`, { cache: 'no-store' })
            const programData = await programRes.json()

            if (!programRes.ok) {
                throw new Error(t('common:errors.loadFailed'))
            }

            setProgram(programData.data.program)

            // Extract workout from the nested program structure
            const foundWorkout = programData.data.program.weeks
                .flatMap((w: any) => w.workouts)
                .find((wo: any) => wo.id === workoutId)

            if (!foundWorkout) {
                throw new Error(t('workoutDetail.errorNotFound'))
            }

            setWorkout(foundWorkout)

            // Fetch personal records for the trainee
            const traineeId = programData.data.program.trainee.id
            const recordsRes = await fetch(`/api/personal-records?traineeId=${traineeId}`)
            if (recordsRes.ok) {
                const recordsData = await recordsRes.json()
                setPersonalRecords(recordsData.data.items || [])
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setLoading(false)
        }
    }, [programId, t, workoutId])

    useEffect(() => {
        void fetchData()
    }, [fetchData])

    const handleDeleteExercise = (workoutExerciseId: string) => {
        setConfirmModal({
            title: t('workoutDetail.removeExerciseTitle'),
            message: t('workoutDetail.removeExerciseMessage'),
            confirmText: t('workoutDetail.removeExerciseConfirm'),
            variant: 'danger',
            onConfirm: async () => {
                setConfirmModal(null)
                try {
                    const res = await fetch(`/api/programs/${programId}/workouts/${workoutId}/exercises/${workoutExerciseId}`, {
                        method: 'DELETE',
                    })

                    if (!res.ok) {
                        const data = await res.json()
                        throw new Error(getApiErrorMessage(data, t('workoutDetail.errorRemove'), t))
                    }

                    showToast(t('workoutDetail.exerciseRemoved'), 'success')
                    await fetchData()
                } catch (err: unknown) {
                    showToast(err instanceof Error ? err.message : String(err), 'error')
                }
            },
        })
    }

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

    const handleDragEnd = async (event: DragEndEvent) => {
        if (!workout) return
        const { active, over } = event
        if (!over || active.id === over.id) return

        const exercises = [...workout.workoutExercises].sort((a, b) => a.order - b.order)
        const oldIndex = exercises.findIndex((e) => e.id === active.id)
        const newIndex = exercises.findIndex((e) => e.id === over.id)

        const reordered = arrayMove(exercises, oldIndex, newIndex)

        // Optimistic update
        setWorkout(prev => prev ? {
            ...prev,
            workoutExercises: reordered.map((ex, i) => ({ ...ex, order: i + 1 }))
        } : prev)

        try {
            await Promise.all(
                reordered.map((ex, i) =>
                    fetch(`/api/programs/${programId}/workouts/${workoutId}/exercises/${ex.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ order: i + 1 }),
                    })
                )
            )
            await fetchData()
        } catch (err: unknown) {
            showToast(err instanceof Error ? err.message : String(err), 'error')
            await fetchData()
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <LoadingSpinner size="lg" color="primary" />
            </div>
        )
    }

    if (error || !workout || !program) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg">
                    {error || t('workoutDetail.errorNotFound')}
                </div>
            </div>
        )
    }

    const sortedExercises = [...workout.workoutExercises].sort((a, b) => a.order - b.order)

    const getRestTimeLabel = (rt: RestTime): string => {
        const opts = { s30: '30s', m1: '1m', m1s30: '1m30s', m2: '2m', m3: '3m', m5: '5m' }
        return opts[rt] || rt
    }

    const getWeightTypeLabel = (wt: WeightType): string => {
        const opts = {
            absolute: 'kg',
            percentage_1rm: '% 1RM',
            percentage_rm: '% nRM',
            percentage_previous: '% Prev'
        }
        return opts[wt] || wt
    }

    // Group personal records by exercise
    const recordsByExercise = personalRecords.reduce((acc, record) => {
        const key = record.exerciseId
        if (!acc[key]) {
            acc[key] = []
        }
        acc[key].push(record)
        return acc
    }, {} as Record<string, PersonalRecord[]>)

    // Get best PR for each exercise (by 1RM estimation)
    const bestPRs = Object.entries(recordsByExercise).map(([exerciseId, records]) => {
        const bestRecord = records.reduce((best, current) => {
            // Simple 1RM estimation: weight * (1 + reps/30)
            const currentEstimated1RM = estimateOneRMValue(current.weight, current.reps)
            const bestEstimated1RM = estimateOneRMValue(best.weight, best.reps)
            return currentEstimated1RM > bestEstimated1RM ? current : best
        })
        return bestRecord
    })

    const estimatedOneRMByExercise = bestPRs.reduce((acc, record) => {
        acc[record.exerciseId] = estimateOneRMValue(record.weight, record.reps)
        return acc
    }, {} as Record<string, number>)

    const currentWeek = program.weeks.find((week) =>
        week.workouts.some((weekWorkout) => weekWorkout.id === workoutId)
    )

    const sbdExerciseMetrics = currentWeek
        ? Object.values(
            currentWeek.workouts.reduce((acc, weekWorkout) => {
                weekWorkout.workoutExercises
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

                        if (!acc[key]) {
                            acc[key] = {
                                exerciseId: weekExercise.exercise.id,
                                exerciseName: weekExercise.exercise.name,
                                workoutIds: new Set<string>(),
                                totalLifts: 0,
                                weightedIntensitySum: 0,
                                intensityLiftCount: 0,
                            }
                        }

                        acc[key].workoutIds.add(weekWorkout.id)
                        acc[key].totalLifts += liftCount

                        if (intensity !== null && liftCount > 0) {
                            acc[key].weightedIntensitySum += intensity * liftCount
                            acc[key].intensityLiftCount += liftCount
                        }
                    })

                return acc
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
        : []

    const shouldShowSbdReporting = program.isSbdProgram

    return (
        <div className="min-h-screen bg-gray-50 relative">
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

            {shouldShowSbdReporting && (
                <div className="hidden xl:block fixed left-8 top-24">
                    <div
                        className={`max-h-[calc(100vh-10rem)] overflow-y-auto bg-white rounded-lg shadow-lg border border-gray-200 transition-all duration-200 ${isSbdPanelCollapsed ? 'w-16' : 'w-80'}`}
                    >
                        <div className="sticky top-0 bg-gradient-to-r from-slate-800 to-slate-700 text-white px-3 py-3 rounded-t-lg">
                            <div className={`flex items-center ${isSbdPanelCollapsed ? 'justify-center' : 'justify-between gap-2'}`}>
                                <div className="flex items-center space-x-2 overflow-hidden">
                                    <BarChart3 className="w-5 h-5 shrink-0" />
                                    {!isSbdPanelCollapsed && (
                                        <div>
                                            <h3 className="font-bold text-sm whitespace-nowrap">
                                                Reportistica SBD
                                            </h3>
                                            <p className="text-[11px] text-white/75">
                                                Settimana del workout corrente
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsSbdPanelCollapsed((current) => !current)}
                                    className={`rounded-md bg-white/15 p-1 hover:bg-white/25 transition-colors ${isSbdPanelCollapsed ? 'absolute inset-x-0 top-3 mx-auto w-fit' : ''}`}
                                    aria-label={isSbdPanelCollapsed ? 'Espandi pannello reportistica SBD' : 'Comprimi pannello reportistica SBD'}
                                    title={isSbdPanelCollapsed ? 'Espandi' : 'Comprimi'}
                                >
                                    {isSbdPanelCollapsed ? (
                                        <ChevronRight className="w-4 h-4" />
                                    ) : (
                                        <ChevronLeft className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                        </div>
                        {!isSbdPanelCollapsed && (
                            <div className="p-4">
                                {sbdExerciseMetrics.length > 0 ? (
                                    <div className="space-y-3">
                                        {sbdExerciseMetrics.map((metric) => (
                                            <div key={metric.exerciseId} className="rounded-lg border border-slate-200 p-3">
                                                <p className="text-sm font-semibold text-slate-900">
                                                    {metric.exerciseName}
                                                </p>
                                                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                                                    <div className="rounded-md bg-slate-50 px-2 py-2">
                                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">FRQ</p>
                                                        <p className="mt-1 text-lg font-bold text-slate-900">{metric.frequency}</p>
                                                    </div>
                                                    <div className="rounded-md bg-slate-50 px-2 py-2">
                                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">NBL</p>
                                                        <p className="mt-1 text-lg font-bold text-slate-900">{metric.totalLifts}</p>
                                                    </div>
                                                    <div className="rounded-md bg-slate-50 px-2 py-2">
                                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">IM</p>
                                                        <p className="mt-1 text-lg font-bold text-slate-900">
                                                            {metric.averageIntensity !== null ? `${metric.averageIntensity.toFixed(1)}%` : '-'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <div className="text-4xl mb-2">🏋️</div>
                                        <p className="text-sm text-gray-600">
                                            Nessun esercizio fondamentale nella settimana corrente
                                        </p>
                                    </div>
                                )}

                                {sbdExerciseMetrics.length > 0 && (
                                    <p className="mt-3 text-[11px] leading-4 text-slate-500">
                                        IM calcolata solo quando il carico e espresso in kg o in % 1RM.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="hidden xl:block fixed right-8 top-24">
                {/* Floating PR Panel */}
                <div
                    className={`max-h-[calc(50vh-6rem)] overflow-y-auto bg-white rounded-lg shadow-lg border border-gray-200 transition-all duration-200 ${isPRPanelCollapsed ? 'w-16' : 'w-80'}`}
                >
                    <div className="sticky top-0 bg-gradient-to-r from-brand-primary to-brand-primary-hover text-white px-3 py-3 rounded-t-lg">
                        <div className={`flex items-center ${isPRPanelCollapsed ? 'justify-center' : 'justify-between gap-2'}`}>
                            <div className="flex items-center space-x-2 overflow-hidden">
                                <Dumbbell className="w-5 h-5 shrink-0" />
                                {!isPRPanelCollapsed && (
                                    <h3 className="font-bold text-sm whitespace-nowrap">
                                        Massimali di {program?.trainee.firstName}
                                    </h3>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsPRPanelCollapsed((current) => !current)}
                                className={`rounded-md bg-white/15 p-1 hover:bg-white/25 transition-colors ${isPRPanelCollapsed ? 'absolute inset-x-0 top-3 mx-auto w-fit' : ''}`}
                                aria-label={isPRPanelCollapsed ? 'Espandi pannello massimali' : 'Comprimi pannello massimali'}
                                title={isPRPanelCollapsed ? 'Espandi' : 'Comprimi'}
                            >
                                {isPRPanelCollapsed ? (
                                    <ChevronLeft className="w-4 h-4" />
                                ) : (
                                    <ChevronRight className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                    </div>
                    {!isPRPanelCollapsed && (
                        <div className="p-4">
                            {bestPRs.length > 0 ? (
                                <div className="space-y-3">
                                    {bestPRs.map((pr) => (
                                        <div key={pr.id} className="border-b border-gray-200 pb-3 last:border-b-0">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <p className="text-sm font-semibold text-gray-900">
                                                        {pr.exercise.name}
                                                    </p>
                                                    <div className="mt-1 flex items-baseline space-x-2">
                                                        <span className="text-2xl font-bold text-brand-primary">
                                                            {pr.weight}
                                                        </span>
                                                        <span className="text-xs text-gray-500">kg</span>
                                                        <span className="text-xs text-gray-500">×</span>
                                                        <span className="text-sm font-semibold text-gray-700">
                                                            {pr.reps} {pr.reps === 1 ? 'rep' : 'reps'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        {new Date(pr.recordDate).toLocaleDateString('it-IT', {
                                                            day: 'numeric',
                                                            month: 'short',
                                                            year: 'numeric'
                                                        })}
                                                    </p>
                                                </div>
                                                <span
                                                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${pr.exercise.type === 'fundamental'
                                                        ? 'bg-red-50 text-red-700'
                                                        : 'bg-blue-50 text-blue-700'
                                                        }`}
                                                >
                                                    {pr.exercise.type === 'fundamental' ? 'F' : 'A'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="text-4xl mb-2">📊</div>
                                    <p className="text-sm text-gray-600">
                                        Nessun massimale registrato
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href={`/trainer/programs/${programId}/edit`}
                        className="text-brand-primary hover:text-brand-primary/80 text-sm font-semibold mb-4 inline-block"
                    >
                        ← {t('workouts.backToWeeks')}
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900">
                        {`Giorno ${workout.dayIndex}`} - {program.title}
                    </h1>
                    <p className="text-gray-600 mt-2">
                        {t('workoutDetail.forTrainee')} {program.trainee.firstName} {program.trainee.lastName}
                    </p>
                    {workout.notes && (
                        <p className="text-gray-700 mt-2 italic">📝 {workout.notes}</p>
                    )}
                </div>

                {/* Exercises List */}
                {sortedExercises.length > 0 ? (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={sortedExercises.map(e => e.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-3 mb-6">
                                {sortedExercises.map((we, index) => (
                                    <SortableExerciseItem key={we.id} id={we.id}>
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-xl font-bold text-gray-400">
                                                        {index + 1}
                                                    </span>
                                                    <h3 className="text-lg font-bold text-gray-900">
                                                        {we.exercise.name}
                                                        {we.variant && (
                                                            <span className="text-gray-600 font-normal ml-2">({we.variant})</span>
                                                        )}
                                                    </h3>
                                                    <span
                                                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${we.exercise.type === 'fundamental'
                                                            ? 'bg-red-100 text-red-700 border-red-300'
                                                            : 'bg-blue-100 text-blue-700 border-blue-300'
                                                            }`}
                                                    >
                                                        {we.exercise.type === 'fundamental'
                                                            ? t('exercises.fundamental')
                                                            : t('exercises.accessory')}
                                                    </span>
                                                    <MovementPatternTag
                                                        name={we.exercise.movementPattern.name}
                                                        color={we.exercise.movementPattern.color}
                                                    />
                                                    {we.isWarmup && (
                                                        <span className="px-1.5 py-0.5 text-xs font-semibold rounded bg-yellow-100 text-yellow-800">
                                                            🔥 {t('workoutDetail.warmupTag')}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <button
                                                        onClick={() => handleDeleteExercise(we.id)}
                                                        className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                                                        title={t('workoutDetail.deleteBtn')}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-3">
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-0.5">{t('workoutDetail.setsCol')}</p>
                                                    <p className="text-base font-semibold text-gray-900">
                                                        {we.sets}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-0.5">
                                                        {t('workoutDetail.repsCol')}
                                                    </p>
                                                    <p className="text-base font-semibold text-gray-900">
                                                        {we.reps}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-0.5">{t('workoutDetail.restCol')}</p>
                                                    <p className="text-base font-semibold text-gray-900">
                                                        {getRestTimeLabel(we.restTime)}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-0.5">{t('workoutDetail.rpeCol')}</p>
                                                    <p className="text-base font-semibold text-gray-900">
                                                        {we.targetRpe ?? '-'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-0.5">{t('workoutDetail.weightTypeCol')}</p>
                                                    <p className="text-base font-semibold text-gray-900">
                                                        {getWeightTypeLabel(we.weightType)}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-0.5">{t('workoutDetail.weightCol')}</p>
                                                    <p className="text-base font-semibold text-gray-900">
                                                        {we.weight ? `${we.weight}` : '-'}
                                                    </p>
                                                </div>
                                            </div>

                                            {we.notes && (
                                                <p className="text-sm text-gray-600 mt-2 italic">
                                                    📝 {we.notes}
                                                </p>
                                            )}
                                        </div>
                                    </SortableExerciseItem>
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                ) : (
                    <div className="bg-white rounded-lg shadow-md p-12 text-center mb-6">
                        <div className="text-5xl mb-4">💪</div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                            {t('workouts.noExercises')}
                        </h3>
                        <p className="text-gray-600">
                            {t('workoutDetail.noExercisesDesc')}
                        </p>
                    </div>
                )}

                {/* Bottom Actions */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <Link
                        href={`/trainer/programs/${programId}/edit`}
                        className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg text-center transition-colors"
                    >
                        {t('workoutDetail.backToOverview')}
                    </Link>
                    {program.status === 'draft' && sortedExercises.length > 0 && (
                        <Link
                            href={`/trainer/programs/${programId}/review`}
                            className="flex-1 bg-brand-primary hover:bg-brand-primary-hover text-white font-semibold py-3 px-6 rounded-lg text-center transition-colors"
                        >
                            {t('workoutDetail.saveAndReview')}
                        </Link>
                    )}
                </div>
            </div>
        </div>
    )
}
