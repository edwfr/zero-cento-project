'use client'

import { WeekType } from '@prisma/client'

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
    const configs = {
        normal: {
            bg: 'bg-gray-100',
            border: 'border-gray-300',
            text: 'text-gray-700',
            icon: '📋',
            label: 'Settimana Standard',
            description: 'Allenamento normale secondo programma',
        },
        test: {
            bg: 'bg-week-test-light',
            border: 'border-week-test',
            text: 'text-week-test-dark',
            icon: '🔥',
            label: 'Settimana Test',
            description: 'Valutazione massimali e test',
        },
        deload: {
            bg: 'bg-week-deload-light',
            border: 'border-week-deload',
            text: 'text-week-deload-dark',
            icon: '💆',
            label: 'Settimana Scarico',
            description: 'Recupero e rigenerazione',
        },
    }

    const config = configs[weekType]

    return (
        <div
            className={`
                flex items-center gap-3 rounded-lg border-2 p-4
                ${config.bg} ${config.border} ${config.text}
                ${className}
            `}
        >
            {/* Icon */}
            <span className="text-3xl" role="img" aria-label={config.label}>
                {config.icon}
            </span>

            {/* Content */}
            <div className="flex-1">
                <h3 className="font-bold">
                    {config.label} - Settimana {weekNumber}
                </h3>
                <p className="text-sm opacity-90">{config.description}</p>
            </div>

            {/* Week Type Badge */}
            <span
                className={`
                    rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide
                    ${weekType === 'test' ? 'bg-week-test text-white' : ''}
                    ${weekType === 'deload' ? 'bg-week-deload text-white' : ''}
                    ${weekType === 'normal' ? 'bg-gray-300 text-gray-700' : ''}
                `}
            >
                {weekType}
            </span>
        </div>
    )
}
