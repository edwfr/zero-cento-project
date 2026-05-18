'use client'

import { FileText, MessageSquare } from 'lucide-react'
import ExerciseMetaBadges from './ExerciseMetaBadges'

export interface ExerciseDisplayItem {
    id: string
    exerciseName: string
    variant?: string | null
    exerciseType?: 'fundamental' | 'accessory'
    restTime?: 's30' | 'm1' | 'm1s30' | 'm2' | 'm3' | 'm5'
    isWarmup?: boolean
    isJumpSet?: boolean
    isSuperSet?: boolean
    scheme: string
    performedSets: Array<{
        setNumber: number
        reps: number
        weight: number
        completed: boolean
        actualRpe?: number | null
    }>
    trainerNote?: string | null
    traineeNote?: string | null
}

interface WorkoutExerciseDisplayListProps {
    items: ExerciseDisplayItem[]
    emptyText?: string
    setRowLabel?: (set: number, reps: number, weight: number, rpe: number | null) => string
    metaBadgesMode?: 'all' | 'flags-only' | 'none'
    metaBadgesPosition?: 'top' | 'right'
}

export default function WorkoutExerciseDisplayList({
    items,
    emptyText = '—',
    setRowLabel,
    metaBadgesMode = 'all',
    metaBadgesPosition = 'top',
}: WorkoutExerciseDisplayListProps) {
    if (items.length === 0) {
        return <p className="text-sm text-gray-400">{emptyText}</p>
    }

    const defaultSetRow = (set: number, reps: number, weight: number, rpe: number | null) =>
        rpe != null
            ? `#${set} · ${reps} rep · ${weight} kg @ RPE ${rpe}`
            : `#${set} · ${reps} rep · ${weight} kg`

    const renderSet = setRowLabel ?? defaultSetRow

    return (
        <ul className="space-y-0">
            {items.map((item) => {
                const completedSets = item.performedSets.filter((s) => s.completed)
                const hasFlagBadges = Boolean(item.isWarmup || item.isJumpSet || item.isSuperSet)
                const hasAdditionalBadges = Boolean(item.restTime || item.exerciseType)
                const showBadges =
                    metaBadgesMode === 'none'
                        ? false
                        : metaBadgesMode === 'flags-only'
                            ? hasFlagBadges
                            : hasFlagBadges || hasAdditionalBadges

                const metaBadges = showBadges ? (
                    <ExerciseMetaBadges
                        restTime={metaBadgesMode === 'all' ? item.restTime : undefined}
                        exerciseType={metaBadgesMode === 'all' ? item.exerciseType : undefined}
                        isWarmup={item.isWarmup}
                        isJumpSet={item.isJumpSet}
                        isSuperSet={item.isSuperSet}
                        className={metaBadgesPosition === 'right' ? 'justify-end' : 'mb-1'}
                    />
                ) : null

                return (
                    <li
                        key={item.id}
                        className="border-b border-gray-100 py-3 last:border-0"
                    >
                        <div className={`flex gap-3 ${metaBadgesPosition === 'right' ? 'items-center justify-between' : 'flex-col'}`}>
                            <div className="min-w-0 flex-1">
                                {metaBadgesPosition === 'top' && metaBadges}
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <p className="truncate text-sm font-semibold text-gray-800">
                                        {item.exerciseName}
                                    </p>
                                    {item.variant && (
                                        <span className="text-xs text-gray-500">({item.variant})</span>
                                    )}
                                </div>

                                {completedSets.length > 0 ? (
                                    <ul className="mt-1 space-y-0.5">
                                        {completedSets.map((set) => (
                                            <li
                                                key={set.setNumber}
                                                className="text-xs text-gray-500 tabular-nums"
                                            >
                                                {renderSet(set.setNumber, set.reps, set.weight, set.actualRpe ?? null)}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="mt-1 text-xs text-gray-400">{item.scheme}</p>
                                )}

                                {item.trainerNote && (
                                    <p className="mt-1.5 flex items-start gap-1 text-xs text-gray-500 italic">
                                        <FileText className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                        {item.trainerNote}
                                    </p>
                                )}

                                {item.traineeNote && (
                                    <p className="mt-1 flex items-start gap-1 text-xs text-brand-primary italic">
                                        <MessageSquare className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                        {item.traineeNote}
                                    </p>
                                )}
                            </div>

                            {metaBadgesPosition === 'right' && metaBadges && (
                                <div className="flex shrink-0 items-center">{metaBadges}</div>
                            )}
                        </div>
                    </li>
                )
            })}
        </ul>
    )
}
