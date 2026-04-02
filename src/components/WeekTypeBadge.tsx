import { ClipboardList, Flame, Wind } from 'lucide-react'

interface WeekTypeBadgeProps {
    weekType: 'normal' | 'test' | 'deload'
}

export default function WeekTypeBadge({ weekType }: WeekTypeBadgeProps) {
    if (weekType === 'test') {
        return (
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-week-test text-white border-2 border-week-test flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5" />
                Test
            </span>
        )
    }

    if (weekType === 'deload') {
        return (
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-week-deload text-white border-2 border-week-deload flex items-center gap-1.5">
                <Wind className="w-3.5 h-3.5" />
                Scarico
            </span>
        )
    }

    return (
        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-500 text-white border-2 border-gray-500 flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5" />
            Standard
        </span>
    )
}