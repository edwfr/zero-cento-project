import Link from 'next/link'
import { ChevronRight, CircleCheck, Hourglass } from 'lucide-react'
import { WIDGET_PAGE_SIZE } from '@/lib/trainer-dashboard/constants'
import { loadWidget } from '@/lib/trainer-dashboard/load-widget'
import { getEndingPrograms } from '@/lib/trainer-dashboard/program-ending'
import PaginatedList from './PaginatedList'
import { CountBadge, WidgetCard, WidgetEmpty, WidgetError } from './WidgetCard'
import type { WidgetContext } from './types'

/** Thin one-line bar: completed workouts of the program's last week. */
function LastWeekBar({ completed, planned, label }: { completed: number; planned: number; label: string }) {
    const percentage = Math.round((completed / planned) * 100)

    return (
        <div className="mt-1.5 flex items-center gap-2" title={`${label}: ${completed} / ${planned}`}>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                <div
                    className="h-full rounded-full bg-brand-primary"
                    style={{ width: `${percentage}%` }}
                    role="progressbar"
                    aria-label={label}
                    aria-valuenow={completed}
                    aria-valuemin={0}
                    aria-valuemax={planned}
                />
            </div>
            <span className="w-9 shrink-0 text-right text-xs font-medium text-gray-700">{percentage}%</span>
        </div>
    )
}

export default async function ProgramEndingWidget({ ctx }: { ctx: WidgetContext }) {
    const { t } = ctx
    const title = t('trainerDashboard.programEnding.title')
    const icon = <Hourglass className="h-5 w-5" />
    const result = await loadWidget('program-ending', () => getEndingPrograms(ctx.trainerId, ctx.trainees, ctx.now))

    if (!result.ok) return <WidgetError title={title} icon={icon} t={t} />

    const items = result.data

    return (
        <WidgetCard title={title} icon={icon} action={items.length > 0 && <CountBadge count={items.length} />}>
            {items.length === 0 ? (
                <WidgetEmpty icon={<CircleCheck className="h-8 w-8 text-green-500" />} message={t('trainerDashboard.programEnding.empty')} />
            ) : (
                <PaginatedList
                    pageSize={WIDGET_PAGE_SIZE}
                    previousLabel={t('trainerDashboard.widget.previousPage')}
                    nextLabel={t('trainerDashboard.widget.nextPage')}
                    items={items.map((item) => (
                        <li key={item.programId}>
                            <Link href={`/trainer/trainees/${item.traineeId}`} className="flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-gray-50">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <p className="truncate font-medium text-gray-900">{item.traineeName}</p>
                                        <span className="shrink-0 text-xs font-medium text-blue-600">
                                            {t('trainerDashboard.programEnding.daysLeft', { count: item.days })}
                                        </span>
                                    </div>
                                    <p className="truncate text-sm text-gray-600" title={item.programTitle}>
                                        {item.programTitle}
                                    </p>
                                    {item.planned > 0 && (
                                        <LastWeekBar
                                            completed={item.completed}
                                            planned={item.planned}
                                            label={t('trainerDashboard.programEnding.lastWeekProgress')}
                                        />
                                    )}
                                </div>
                                <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                            </Link>
                        </li>
                    ))}
                />
            )}
        </WidgetCard>
    )
}
