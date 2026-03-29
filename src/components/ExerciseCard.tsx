'use client'

import { ExerciseType } from '@prisma/client'
import MovementPatternTag from './MovementPatternTag'

interface ExerciseCardProps {
    id: string
    name: string
    type: ExerciseType
    movementPattern?: {
        id: string
        name: string
        color?: string
    }
    muscleGroups?: Array<{ id: string; name: string }>
    videoUrl?: string | null
    notes?: string | null
    onClick?: () => void
    onEdit?: () => void
    onDelete?: () => void
    showActions?: boolean
    className?: string
}

export default function ExerciseCard({
    id,
    name,
    type,
    movementPattern,
    muscleGroups = [],
    videoUrl,
    notes,
    onClick,
    onEdit,
    onDelete,
    showActions = false,
    className = '',
}: ExerciseCardProps) {
    const typeColors = {
        fundamental: 'bg-red-100 text-red-700 border-red-300',
        accessory: 'bg-blue-100 text-blue-700 border-blue-300',
    }

    const typeLabels = {
        fundamental: 'Fondamentale',
        accessory: 'Accessorio',
    }

    return (
        <div
            className={`
                group relative flex flex-col gap-3 rounded-lg border-2 border-gray-200 bg-white p-4
                transition-all duration-200 hover:border-brand-primary/50 hover:shadow-md
                ${onClick ? 'cursor-pointer' : ''}
                ${className}
            `}
            onClick={onClick}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                    <h3 className="font-bold text-gray-900 group-hover:text-brand-primary">
                        {name}
                    </h3>
                    <div className="mt-1 flex flex-wrap gap-2">
                        <span
                            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${typeColors[type]
                                }`}
                        >
                            {typeLabels[type]}
                        </span>
                        {movementPattern && (
                            <MovementPatternTag
                                name={movementPattern.name}
                                color={movementPattern.color}
                            />
                        )}
                    </div>
                </div>

                {/* Actions Menu */}
                {showActions && (onEdit || onDelete) && (
                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        {onEdit && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onEdit()
                                }}
                                className="rounded-lg p-2 text-gray-600 hover:bg-brand-primary/10 hover:text-brand-primary"
                                title="Modifica"
                            >
                                <svg
                                    className="h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                    />
                                </svg>
                            </button>
                        )}
                        {onDelete && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onDelete()
                                }}
                                className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                                title="Elimina"
                            >
                                <svg
                                    className="h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                </svg>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Muscle Groups */}
            {muscleGroups.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {muscleGroups.map((mg) => (
                        <span
                            key={mg.id}
                            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                        >
                            {mg.name}
                        </span>
                    ))}
                </div>
            )}

            {/* Video Indicator */}
            {videoUrl && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                    <svg className="h-4 w-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                    <span>Video disponibile</span>
                </div>
            )}

            {/* Notes Preview */}
            {notes && (
                <p className="line-clamp-2 text-xs text-gray-600">{notes}</p>
            )}
        </div>
    )
}
