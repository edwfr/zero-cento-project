import Link from 'next/link'
import { ChevronRight, CircleCheck, Hourglass } from 'lucide-react'
import ProgressBar from '@/components/ProgressBar'
import { WIDGET_PAGE_SIZE } from '@/lib/trainer-dashboard/constants'
import { loadWidget } from '@/lib/trainer-dashboard/load-widget'
import { getEndingPrograms } from '@/lib/trainer-dashboard/program-ending'
import PaginatedList from './PaginatedList'
import { CountBadge, WidgetCard, WidgetEmpty, WidgetError } from './WidgetCard'
import type { WidgetContext } from './types'

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
                            <Link href="/trainer/programs/new" className="flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-gray-50">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                                    <Hourglass className="h-4 w-4" aria-hidden="true" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium text-gray-900">{item.traineeName}</p>
                                    <p className="text-sm text-gray-600">
                                        {t('trainerDashboard.programEnding.endsIn', { program: item.programTitle, count: item.days })}
                                    </p>
                                    {item.planned > 0 && (
                                        <ProgressBar
                                            current={item.completed}
                                            total={item.planned}
                                            label={t('trainerDashboard.programEnding.lastWeekProgress')}
                                            labelClassName="text-xs text-gray-500"
                                            showCurrentTotal={false}
                                            size="sm"
                                            className="mt-2"
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
