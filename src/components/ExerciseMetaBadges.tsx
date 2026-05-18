'use client'

import { Clock3, Flame, Layers, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type RestTimeValue = 's30' | 'm1' | 'm1s30' | 'm2' | 'm3' | 'm5'
type ExerciseTypeValue = 'fundamental' | 'accessory'

interface ExerciseMetaBadgesProps {
    restTime?: RestTimeValue | null
    exerciseType?: ExerciseTypeValue | null
    isWarmup?: boolean
    isJumpSet?: boolean
    isSuperSet?: boolean
    className?: string
}

const REST_TIME_LABELS: Record<RestTimeValue, string> = {
    s30: '30"',
    m1: "1'",
    m1s30: "1'30\"",
    m2: "2'",
    m3: "3'",
    m5: "5'",
}

export default function ExerciseMetaBadges({
    restTime,
    exerciseType,
    isWarmup = false,
    isJumpSet = false,
    isSuperSet = false,
    className,
}: ExerciseMetaBadgesProps) {
    const { t } = useTranslation(['trainee', 'trainer'])

    const hasFlags = isWarmup || isJumpSet || isSuperSet
    const hasBadges = hasFlags || Boolean(restTime) || Boolean(exerciseType)

    if (!hasBadges) {
        return null
    }

    return (
        <div className={`flex flex-wrap items-center gap-1.5 ${className ?? ''}`.trim()}>
            {hasFlags && (
                <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                    {isWarmup && (
                        <span
                            className="inline-flex"
                            title={t('trainer:editProgram.warmupHint')}
                            aria-label={t('trainer:editProgram.tableWarmup')}
                        >
                            <Flame className="h-3.5 w-3.5 text-week-test" />
                        </span>
                    )}
                    {isJumpSet && (
                        <span
                            className="inline-flex"
                            title={t('trainer:editProgram.jumpSetHint')}
                            aria-label={t('trainer:editProgram.tableJumpSet')}
                        >
                            <Zap className="h-3.5 w-3.5 text-state-info" />
                        </span>
                    )}
                    {isSuperSet && (
                        <span
                            className="inline-flex"
                            title={t('trainer:editProgram.superSetHint')}
                            aria-label={t('trainer:editProgram.tableSuperSet')}
                        >
                            <Layers className="h-3.5 w-3.5 text-state-success" />
                        </span>
                    )}
                </span>
            )}
            {restTime && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    <Clock3 className="h-3 w-3" />
                    <span className="font-semibold">{t('trainee:workouts.rest')}:</span>
                    {REST_TIME_LABELS[restTime] ?? '-'}
                </span>
            )}
            {exerciseType && (
                <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                        exerciseType === 'fundamental'
                            ? 'border-red-200 bg-red-100 text-red-700'
                            : 'border-blue-200 bg-blue-100 text-blue-700'
                    }`}
                >
                    {exerciseType === 'fundamental'
                        ? t('trainer:exercises.fundamental')
                        : t('trainer:exercises.accessory')}
                </span>
            )}
        </div>
    )
}
