import Link from 'next/link'
import { ChevronRight, CircleCheck, FilePen } from 'lucide-react'
import { WIDGET_PAGE_SIZE } from '@/lib/trainer-dashboard/constants'
import { getDraftPrograms } from '@/lib/trainer-dashboard/draft-programs'
import { loadWidget } from '@/lib/trainer-dashboard/load-widget'
import PaginatedList from './PaginatedList'
import { CountBadge, WidgetCard, WidgetEmpty, WidgetError } from './WidgetCard'
import type { WidgetContext } from './types'

export default async function DraftProgramsWidget({ ctx }: { ctx: WidgetContext }) {
    const { t } = ctx
    const title = t('trainerDashboard.drafts.title')
    const icon = <FilePen className="h-5 w-5" />
    const result = await loadWidget('draft-programs', () => getDraftPrograms(ctx.trainerId, ctx.trainees, ctx.now))

    if (!result.ok) return <WidgetError title={title} icon={icon} t={t} />

    const items = result.data

    return (
        <WidgetCard title={title} icon={icon} action={items.length > 0 && <CountBadge count={items.length} />}>
            {items.length === 0 ? (
                <WidgetEmpty icon={<CircleCheck className="h-8 w-8 text-green-500" />} message={t('trainerDashboard.drafts.empty')} />
            ) : (
                <PaginatedList
                    pageSize={WIDGET_PAGE_SIZE}
                    previousLabel={t('trainerDashboard.widget.previousPage')}
                    nextLabel={t('trainerDashboard.widget.nextPage')}
                    items={items.map((item) => (
                        <li key={item.programId}>
                            <Link
                                href={`/trainer/programs/${item.programId}/edit`}
                                className="flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-gray-50"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <p className="truncate font-medium text-gray-900">{item.traineeName}</p>
                                        <span className="shrink-0 text-xs text-gray-500">
                                            {t('trainerDashboard.drafts.created', { count: item.daysSinceCreated })}
                                        </span>
                                    </div>
                                    <p className="truncate text-sm text-gray-600" title={item.programTitle}>
                                        {item.programTitle}
                                    </p>
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
