'use client'

import { WeekType } from '@prisma/client'
import { ClipboardList, Flame, Wind } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import WeekTypeBadge from './WeekTypeBadge'

interface WeekTypeBannerProps {
    weekType: WeekType
    weekNumber: number
    className?: string
}

/**
 * WeekTypeBanner Component
 * Mostra un banner colorato in base al tipo di settimana
 * - normal: grigio neutro
 * - test: rosso vivace (massimali/valutazione)
 * - deload: verde rilassante (scarico/recupero)
 */
export default function WeekTypeBanner({ weekType, weekNumber, className = '' }: WeekTypeBannerProps) {
    const { t } = useTranslation(['trainer', 'components'])

    const configs = {
        normal: {
            bg: 'bg-gray-100',
            border: 'border-gray-300',
            text: 'text-gray-700',
            icon: <ClipboardList className="h-6 w-6 sm:h-7 sm:w-7" />,
            label: t('trainer:weekTypes.standard'),
            description: t('trainer:weekTypes.standardDesc'),
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
                    {/* Icon */}
                    <span className="mt-0.5 flex-shrink-0 sm:mt-0" aria-label={config.label}>
                        {config.icon}
                    </span>

                    {/* Content */}
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
                            normal: t('components:weekTypeBanner.badges.normal'),
                            test: t('components:weekTypeBanner.badges.test'),
                            deload: t('components:weekTypeBanner.badges.deload'),
                        }}
                    />
                </div>
            </div>
        </div>
    )
}
