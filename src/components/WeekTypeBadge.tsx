import { ClipboardList, Flame, Wind } from 'lucide-react'

interface WeekTypeBadgeProps {
    weekType: 'normal' | 'test' | 'deload'
}

export default function WeekTypeBadge({ weekType }: WeekTypeBadgeProps) {
    const baseClassName = 'inline-grid min-h-7 max-w-full grid-cols-[0.875rem_minmax(0,1fr)_0.875rem] items-center gap-1.5 rounded-full border-2 px-3 py-1 text-xs font-semibold sm:w-[7.5rem]'

    if (weekType === 'test') {
        return (
            <span className={`${baseClassName} border-week-test bg-week-test text-white`}>
                <Flame className="h-3.5 w-3.5" />
                <span className="text-center">Test</span>
                <span aria-hidden="true" className="h-3.5 w-3.5" />
            </span>
        )
    }

    if (weekType === 'deload') {
        return (
            <span className={`${baseClassName} border-week-deload bg-week-deload text-white`}>
                <Wind className="h-3.5 w-3.5" />
                <span className="text-center">Scarico</span>
                <span aria-hidden="true" className="h-3.5 w-3.5" />
            </span>
        )
    }

    return (
        <span className={`${baseClassName} border-gray-500 bg-gray-500 text-white`}>
            <ClipboardList className="h-3.5 w-3.5" />
            <span className="text-center">Standard</span>
            <span aria-hidden="true" className="h-3.5 w-3.5" />
        </span>
    )
}