'use client'

import { WeekType } from '@prisma/client'
import { BarChart3, Dumbbell, Flame, Target, Trophy, TrendingUp, Wind, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import ProgressBar from './ProgressBar'
import WeekTypeBadge from './WeekTypeBadge'

interface WeekTypeBannerProps {
    weekType: WeekType
    weekNumber: number
    dayNumber?: number
    workoutName?: string
    progressPercentage?: number
    className?: string
}

export default function WeekTypeBanner({
    weekType,
    weekNumber,
    dayNumber,
    workoutName,
    progressPercentage,
    className = '',
}: WeekTypeBannerProps) {
    const { t } = useTranslation(['trainer', 'components'])

    const configs: Record<WeekType, {
        bg: string
        border: string
        text: string
        progress: string
        icon: React.ReactNode
        label: string
    }> = {
        tecnica: {
            bg: 'bg-week-tecnica-light',
            border: 'border-week-tecnica',
            text: 'text-week-tecnica-dark',
            progress: 'bg-week-tecnica',
            icon: <Target className="h-6 w-6 sm:h-7 sm:w-7" />,
            label: t('trainer:weekTypes.tecnica'),
        },
        ipertrofia: {
            bg: 'bg-week-ipertrofia-light',
            border: 'border-week-ipertrofia',
            text: 'text-week-ipertrofia-dark',
            progress: 'bg-week-ipertrofia',
            icon: <TrendingUp className="h-6 w-6 sm:h-7 sm:w-7" />,
            label: t('trainer:weekTypes.ipertrofia'),
        },
        volume: {
            bg: 'bg-week-volume-light',
            border: 'border-week-volume',
            text: 'text-week-volume-dark',
            progress: 'bg-week-volume',
            icon: <BarChart3 className="h-6 w-6 sm:h-7 sm:w-7" />,
            label: t('trainer:weekTypes.volume'),
        },
        forza_generale: {
            bg: 'bg-week-forza-generale-light',
            border: 'border-week-forza-generale',
            text: 'text-week-forza-generale-dark',
            progress: 'bg-week-forza-generale',
            icon: <Dumbbell className="h-6 w-6 sm:h-7 sm:w-7" />,
            label: t('trainer:weekTypes.forzaGenerale'),
        },
        intensificazione: {
            bg: 'bg-week-intensificazione-light',
            border: 'border-week-intensificazione',
            text: 'text-week-intensificazione-dark',
            progress: 'bg-week-intensificazione',
            icon: <Zap className="h-6 w-6 sm:h-7 sm:w-7" />,
            label: t('trainer:weekTypes.intensificazione'),
        },
        picco: {
            bg: 'bg-week-picco-light',
            border: 'border-week-picco',
            text: 'text-week-picco-dark',
            progress: 'bg-week-picco',
            icon: <Trophy className="h-6 w-6 sm:h-7 sm:w-7" />,
            label: t('trainer:weekTypes.picco'),
        },
        test: {
            bg: 'bg-week-test-light',
            border: 'border-week-test',
            text: 'text-week-test-dark',
            progress: 'bg-week-test',
            icon: <Flame className="h-6 w-6 sm:h-7 sm:w-7" />,
            label: t('trainer:weekTypes.test'),
        },
        deload: {
            bg: 'bg-week-deload-light',
            border: 'border-week-deload',
            text: 'text-week-deload-dark',
            progress: 'bg-week-deload',
            icon: <Wind className="h-6 w-6 sm:h-7 sm:w-7" />,
            label: t('trainer:weekTypes.deload'),
        },
    }

    const config = configs[weekType]
    const normalizedProgress = Math.max(0, Math.min(100, Math.round(progressPercentage ?? 0)))
    const showProgress = progressPercentage !== undefined
    const weekAndDayLabel = dayNumber
        ? `${t('components:weekTypeBanner.week')} ${weekNumber} / ${t('components:weekTypeBanner.day')} ${dayNumber}`
        : `${t('components:weekTypeBanner.week')} ${weekNumber}`
    const badgeLabels = {
        tecnica: t('components:weekTypeBanner.badges.tecnica'),
        ipertrofia: t('components:weekTypeBanner.badges.ipertrofia'),
        volume: t('components:weekTypeBanner.badges.volume'),
        forza_generale: t('components:weekTypeBanner.badges.forzaGenerale'),
        intensificazione: t('components:weekTypeBanner.badges.intensificazione'),
        picco: t('components:weekTypeBanner.badges.picco'),
        test: t('components:weekTypeBanner.badges.test'),
        deload: t('components:weekTypeBanner.badges.deload'),
    }

    return (
        <div
            className={`
                rounded-lg border-2 p-3 sm:p-4
                ${config.bg} ${config.border} ${config.text}
                ${className}
            `}
        >
            {/* Mobile layout */}
            <div className="sm:hidden">
                <p className="text-sm font-medium opacity-75">{weekAndDayLabel}</p>
                {workoutName && (
                    <h3 className="text-base font-bold leading-tight">{workoutName}</h3>
                )}
                <div className="mt-2 flex justify-center">
                    <WeekTypeBadge
                        weekType={weekType}
                        labels={badgeLabels}
                        className="px-1.5 py-px text-[9px]"
                    />
                </div>
                {showProgress && (
                    <ProgressBar
                        current={normalizedProgress}
                        total={100}
                        label={t('components:weekTypeBanner.progress')}
                        size="sm"
                        showCurrentTotal={false}
                        barClassName={config.progress}
                        labelClassName="text-xs font-medium text-gray-700"
                        className="mt-2"
                    />
                )}
            </div>

            {/* Desktop layout */}
            <div className="hidden sm:flex sm:items-center sm:gap-3">
                <span className="flex-shrink-0" aria-label={config.label}>
                    {config.icon}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium opacity-75">{weekAndDayLabel}</p>
                    {workoutName && (
                        <h3 className="text-base font-bold leading-tight">{workoutName}</h3>
                    )}
                    {showProgress && (
                        <ProgressBar
                            current={normalizedProgress}
                            total={100}
                            label={t('components:weekTypeBanner.progress')}
                            size="sm"
                            showCurrentTotal={false}
                            barClassName={config.progress}
                            className="mt-2"
                        />
                    )}
                </div>
                <WeekTypeBadge weekType={weekType} labels={badgeLabels} />
            </div>
        </div>
    )
}
