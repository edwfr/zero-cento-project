'use client'

import { WeekType } from '@prisma/client'
import { BarChart3, Dumbbell, Flame, Target, Trophy, TrendingUp, Wind, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import WeekTypeBadge from './WeekTypeBadge'

interface WeekTypeBannerProps {
    weekType: WeekType
    weekNumber: number
    className?: string
}

export default function WeekTypeBanner({ weekType, weekNumber, className = '' }: WeekTypeBannerProps) {
    const { t } = useTranslation(['trainer', 'components'])

    const configs: Record<WeekType, {
        bg: string
        border: string
        text: string
        icon: React.ReactNode
        label: string
        description: string
    }> = {
        tecnica: {
            bg: 'bg-week-tecnica-light',
            border: 'border-week-tecnica',
            text: 'text-week-tecnica-dark',
            icon: <Target className="h-6 w-6 sm:h-7 sm:w-7" />,
            label: t('trainer:weekTypes.tecnica'),
            description: t('trainer:weekTypes.tecnicaDesc'),
        },
        ipertrofia: {
            bg: 'bg-week-ipertrofia-light',
            border: 'border-week-ipertrofia',
            text: 'text-week-ipertrofia-dark',
            icon: <TrendingUp className="h-6 w-6 sm:h-7 sm:w-7" />,
            label: t('trainer:weekTypes.ipertrofia'),
            description: t('trainer:weekTypes.ipertrofiaDesc'),
        },
        volume: {
            bg: 'bg-week-volume-light',
            border: 'border-week-volume',
            text: 'text-week-volume-dark',
            icon: <BarChart3 className="h-6 w-6 sm:h-7 sm:w-7" />,
            label: t('trainer:weekTypes.volume'),
            description: t('trainer:weekTypes.volumeDesc'),
        },
        forza_generale: {
            bg: 'bg-week-forza-generale-light',
            border: 'border-week-forza-generale',
            text: 'text-week-forza-generale-dark',
            icon: <Dumbbell className="h-6 w-6 sm:h-7 sm:w-7" />,
            label: t('trainer:weekTypes.forzaGenerale'),
            description: t('trainer:weekTypes.forzaGeneraleDesc'),
        },
        intensificazione: {
            bg: 'bg-week-intensificazione-light',
            border: 'border-week-intensificazione',
            text: 'text-week-intensificazione-dark',
            icon: <Zap className="h-6 w-6 sm:h-7 sm:w-7" />,
            label: t('trainer:weekTypes.intensificazione'),
            description: t('trainer:weekTypes.intensificazioneDesc'),
        },
        picco: {
            bg: 'bg-week-picco-light',
            border: 'border-week-picco',
            text: 'text-week-picco-dark',
            icon: <Trophy className="h-6 w-6 sm:h-7 sm:w-7" />,
            label: t('trainer:weekTypes.picco'),
            description: t('trainer:weekTypes.piccoDesc'),
        },
        test: {
            bg: 'bg-week-test-light',
            border: 'border-week-test',
            text: 'text-week-test-dark',
            icon: <Flame className="h-6 w-6 sm:h-7 sm:w-7" />,
            label: t('trainer:weekTypes.test'),
            description: t('trainer:weekTypes.testDesc'),
        },
        deload: {
            bg: 'bg-week-deload-light',
            border: 'border-week-deload',
            text: 'text-week-deload-dark',
            icon: <Wind className="h-6 w-6 sm:h-7 sm:w-7" />,
            label: t('trainer:weekTypes.deload'),
            description: t('trainer:weekTypes.deloadDesc'),
        },
    }

    const config = configs[weekType]

    return (
        <div
            className={`
                rounded-lg border-2 p-3 sm:p-4
                ${config.bg} ${config.border} ${config.text}
                ${className}
            `}
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
                    <span className="mt-0.5 flex-shrink-0 sm:mt-0" aria-label={config.label}>
                        {config.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-sm leading-tight font-bold sm:text-base">
                            {config.label} - {t('components:weekTypeBanner.week')} {weekNumber}
                        </h3>
                        <p className="mt-0.5 text-xs opacity-90 sm:text-sm">{config.description}</p>
                    </div>
                </div>
                <div className="self-start sm:self-center">
                    <WeekTypeBadge
                        weekType={weekType}
                        labels={{
                            tecnica: t('components:weekTypeBanner.badges.tecnica'),
                            ipertrofia: t('components:weekTypeBanner.badges.ipertrofia'),
                            volume: t('components:weekTypeBanner.badges.volume'),
                            forza_generale: t('components:weekTypeBanner.badges.forzaGenerale'),
                            intensificazione: t('components:weekTypeBanner.badges.intensificazione'),
                            picco: t('components:weekTypeBanner.badges.picco'),
                            test: t('components:weekTypeBanner.badges.test'),
                            deload: t('components:weekTypeBanner.badges.deload'),
                        }}
                    />
                </div>
            </div>
        </div>
    )
}
