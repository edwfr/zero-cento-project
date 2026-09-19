'use client'

import { useTranslation } from 'react-i18next'
import { EXERCISE_TYPE_META, type ExerciseType } from '@/lib/exercise-type'

interface ExerciseTypeBadgeProps {
    type: ExerciseType
    /** `short` shows the letter (F/A/P) with the full label as tooltip; `label` shows the full label */
    variant?: 'short' | 'label'
    /** Layout/sizing classes; colors come from EXERCISE_TYPE_META */
    className?: string
}

export default function ExerciseTypeBadge({ type, variant = 'short', className = '' }: ExerciseTypeBadgeProps) {
    const { t } = useTranslation('common')
    const meta = EXERCISE_TYPE_META[type]
    if (!meta) return null
    const label = t(meta.labelKey)
    const isShort = variant === 'short'

    return (
        <span
            className={`${meta.badgeClass} ${className}`.trim()}
            title={isShort ? label : undefined}
            aria-label={isShort ? label : undefined}
        >
            {isShort ? t(meta.shortKey) : label}
        </span>
    )
}
