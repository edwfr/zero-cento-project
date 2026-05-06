import { WeekType } from '@prisma/client'
import { BarChart3, Dumbbell, Flame, Target, Trophy, TrendingUp, Wind, Zap } from 'lucide-react'
import type { ReactNode } from 'react'

type WeekTypeBadgeLabels = Record<WeekType, ReactNode>

interface WeekTypeBadgeProps {
    weekType: WeekType
    labels?: Partial<WeekTypeBadgeLabels>
    variant?: 'solid' | 'ghost'
}

const ICON_CLASS = 'h-3.5 w-3.5 shrink-0'

const CONFIG: Record<WeekType, { solid: string; ghost: string; icon: ReactNode; defaultLabel: string }> = {
    tecnica: {
        solid: 'border-week-tecnica bg-week-tecnica text-white',
        ghost: 'border-week-tecnica bg-week-tecnica-light text-week-tecnica-dark',
        icon: <Target className={ICON_CLASS} />,
        defaultLabel: 'Tecnica',
    },
    ipertrofia: {
        solid: 'border-week-ipertrofia bg-week-ipertrofia text-white',
        ghost: 'border-week-ipertrofia bg-week-ipertrofia-light text-week-ipertrofia-dark',
        icon: <TrendingUp className={ICON_CLASS} />,
        defaultLabel: 'Ipertrofia',
    },
    volume: {
        solid: 'border-week-volume bg-week-volume text-white',
        ghost: 'border-week-volume bg-week-volume-light text-week-volume-dark',
        icon: <BarChart3 className={ICON_CLASS} />,
        defaultLabel: 'Volume',
    },
    forza_generale: {
        solid: 'border-week-forza-generale bg-week-forza-generale text-white',
        ghost: 'border-week-forza-generale bg-week-forza-generale-light text-week-forza-generale-dark',
        icon: <Dumbbell className={ICON_CLASS} />,
        defaultLabel: 'Forza Generale',
    },
    intensificazione: {
        solid: 'border-week-intensificazione bg-week-intensificazione text-white',
        ghost: 'border-week-intensificazione bg-week-intensificazione-light text-week-intensificazione-dark',
        icon: <Zap className={ICON_CLASS} />,
        defaultLabel: 'Intensificazione',
    },
    picco: {
        solid: 'border-week-picco bg-week-picco text-white',
        ghost: 'border-week-picco bg-week-picco-light text-week-picco-dark',
        icon: <Trophy className={ICON_CLASS} />,
        defaultLabel: 'Picco',
    },
    test: {
        solid: 'border-week-test bg-week-test text-white',
        ghost: 'border-week-test bg-week-test-light text-week-test-dark',
        icon: <Flame className={ICON_CLASS} />,
        defaultLabel: 'Test',
    },
    deload: {
        solid: 'border-week-deload bg-week-deload text-white',
        ghost: 'border-week-deload bg-week-deload-light text-week-deload-dark',
        icon: <Wind className={ICON_CLASS} />,
        defaultLabel: 'Deload',
    },
}

export default function WeekTypeBadge({ weekType, labels, variant = 'solid' }: WeekTypeBadgeProps) {
    const baseClassName = 'inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-xs font-semibold'
    const { solid, ghost, icon, defaultLabel } = CONFIG[weekType]
    const label = labels?.[weekType] ?? defaultLabel
    const className = variant === 'ghost' ? ghost : solid

    return (
        <span className={`${baseClassName} ${className}`}>
            {icon}
            <span>{label}</span>
        </span>
    )
}