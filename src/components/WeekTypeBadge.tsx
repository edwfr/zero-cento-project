import { ClipboardList, Flame, Wind } from 'lucide-react'
import type { ReactNode } from 'react'

interface WeekTypeBadgeLabels {
    normal: ReactNode
    test: ReactNode
    deload: ReactNode
}

interface WeekTypeBadgeProps {
    weekType: 'normal' | 'test' | 'deload'
    labels?: Partial<WeekTypeBadgeLabels>
}

const DEFAULT_LABELS: WeekTypeBadgeLabels = {
    normal: 'Standard',
    test: 'Test',
    deload: 'Deload',
}

export default function WeekTypeBadge({ weekType, labels }: WeekTypeBadgeProps) {
    const baseClassName = 'inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-xs font-semibold'
    const resolvedLabels: WeekTypeBadgeLabels = {
        ...DEFAULT_LABELS,
        ...labels,
    }

    if (weekType === 'test') {
        return (
            <span className={`${baseClassName} border-week-test bg-week-test text-white`}>
                <Flame className="h-3.5 w-3.5 shrink-0" />
                <span>{resolvedLabels.test}</span>
            </span>
        )
    }

    if (weekType === 'deload') {
        return (
            <span className={`${baseClassName} border-week-deload bg-week-deload text-white`}>
                <Wind className="h-3.5 w-3.5 shrink-0" />
                <span>{resolvedLabels.deload}</span>
            </span>
        )
    }

    return (
        <span className={`${baseClassName} border-gray-500 bg-gray-500 text-white`}>
            <ClipboardList className="h-3.5 w-3.5 shrink-0" />
            <span>{resolvedLabels.normal}</span>
        </span>
    )
}