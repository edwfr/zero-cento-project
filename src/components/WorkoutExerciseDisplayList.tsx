'use client'

import { FileText, MessageSquare } from 'lucide-react'

export interface ExerciseDisplayItem {
    id: string
    exerciseName: string
    variant?: string | null
    isWarmup?: boolean
    scheme: string
    performedSets: Array<{
        setNumber: number
        reps: number
        weight: number
        completed: boolean
    }>
    trainerNote?: string | null
    traineeNote?: string | null
}

interface WorkoutExerciseDisplayListProps {
    items: ExerciseDisplayItem[]
    emptyText?: string
    setRowLabel?: (set: number, reps: number, weight: number) => string
}

export default function WorkoutExerciseDisplayList({
    items,
    emptyText = '—',
    setRowLabel,
}: WorkoutExerciseDisplayListProps) {
    if (items.length === 0) {
        return <p className="text-sm text-gray-400">{emptyText}</p>
    }

    const defaultSetRow = (set: number, reps: number, weight: number) =>
        `#${set} · ${reps} rep · ${weight} kg`

    const renderSet = setRowLabel ?? defaultSetRow

    return (
        <ul className="space-y-0">
            {items.map((item) => {
                const completedSets = item.performedSets.filter((s) => s.completed)

                return (
                    <li
                        key={item.id}
                        className="border-b border-gray-100 py-3 last:border-0"
                    >
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                            {item.isWarmup && (
                                <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                    W
                                </span>
                            )}
                            <p className="truncate text-sm font-semibold text-gray-800">
                                {item.exerciseName}
                            </p>
                            {item.variant && (
                                <span className="text-xs text-gray-500">({item.variant})</span>
                            )}
                        </div>

                        {completedSets.length > 0 ? (
                            <ul className="space-y-0.5">
                                {completedSets.map((set) => (
                                    <li
                                        key={set.setNumber}
                                        className="text-xs text-gray-500 tabular-nums"
                                    >
                                        {renderSet(set.setNumber, set.reps, set.weight)}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-xs text-gray-400">{item.scheme}</p>
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
                    </li>
                )
            })}
        </ul>
    )
}
