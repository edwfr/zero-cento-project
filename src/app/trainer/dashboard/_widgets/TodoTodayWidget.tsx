import Link from 'next/link'
import {
    CalendarClock,
    CalendarX,
    ChevronRight,
    CircleCheck,
    Flame,
    FlaskConical,
    Hourglass,
    ListTodo,
    type LucideIcon,
} from 'lucide-react'
import ProgressBar from '@/components/ProgressBar'
import type { Translate } from '@/lib/trainer-dashboard/i18n'
import { loadWidget } from '@/lib/trainer-dashboard/load-widget'
import { getTodoItems, type TodoItem } from '@/lib/trainer-dashboard/todo-today'
import { WidgetCard, WidgetEmpty, WidgetError } from './WidgetCard'
import type { WidgetContext } from './types'

const ITEM_STYLE: Record<TodoItem['kind'], { icon: LucideIcon; className: string }> = {
    subscriptionExpired: { icon: CalendarX, className: 'bg-red-50 text-red-600' },
    subscriptionExpiring: { icon: CalendarClock, className: 'bg-orange-50 text-orange-600' },
    testsToReview: { icon: FlaskConical, className: 'bg-purple-50 text-purple-600' },
    programEnding: { icon: Hourglass, className: 'bg-blue-50 text-blue-600' },
    testWeekInProgress: { icon: Flame, className: 'bg-amber-50 text-amber-600' },
}

function describeItem(item: TodoItem, t: Translate): { key: string; href: string; text: string } {
    switch (item.kind) {
        case 'subscriptionExpired':
        case 'subscriptionExpiring':
            return {
                key: `${item.kind}-${item.traineeId}`,
                href: '/trainer/subscriptions',
                text: t(`trainerDashboard.todo.${item.kind}`, { count: item.days }),
            }
        case 'testsToReview':
            return {
                key: `${item.kind}-${item.programId}`,
                href: `/trainer/programs/${item.programId}/tests?backContext=dashboard`,
                text: t('trainerDashboard.todo.testsToReview', { week: item.weekNumber }),
            }
        case 'programEnding':
            return {
                key: `${item.kind}-${item.programId}`,
                href: '/trainer/programs/new',
                text: t('trainerDashboard.todo.programEnding', { program: item.programTitle, count: item.days }),
            }
        case 'testWeekInProgress':
            return {
                key: `${item.kind}-${item.programId}`,
                href: `/trainer/programs/${item.programId}`,
                text: t('trainerDashboard.todo.testWeekInProgress', { week: item.weekNumber }),
            }
    }
}

export default async function TodoTodayWidget({ ctx }: { ctx: WidgetContext }) {
    const { t } = ctx
    const title = t('trainerDashboard.todo.title')
    const icon = <ListTodo className="h-5 w-5" />
    const result = await loadWidget('todo-today', () => getTodoItems(ctx.trainerId, ctx.trainees, ctx.now))

    if (!result.ok) return <WidgetError title={title} icon={icon} t={t} />

    const items = result.data

    return (
        <WidgetCard
            title={title}
            icon={icon}
            action={
                items.length > 0 && (
                    <span className="rounded-full bg-brand-primary/15 px-2.5 py-0.5 text-sm font-semibold text-gray-900">
                        {items.length}
                    </span>
                )
            }
        >
            {items.length === 0 ? (
                <WidgetEmpty icon={<CircleCheck className="h-8 w-8 text-green-500" />} message={t('trainerDashboard.todo.empty')} />
            ) : (
                <ul className="-mx-2 divide-y divide-gray-100">
                    {items.map((item) => {
                        const { key, href, text } = describeItem(item, t)
                        const { icon: Icon, className } = ITEM_STYLE[item.kind]

                        return (
                            <li key={key}>
                                <Link href={href} className="flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-gray-50">
                                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${className}`}>
                                        <Icon className="h-4 w-4" aria-hidden="true" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-gray-900">{item.traineeName}</p>
                                        <p className="text-sm text-gray-600">{text}</p>
                                        {item.kind === 'testWeekInProgress' && (
                                            <ProgressBar
                                                current={item.completed}
                                                total={item.planned}
                                                label={t('trainerDashboard.todo.testsProgress')}
                                                labelClassName="text-xs text-gray-500"
                                                size="sm"
                                                color="warning"
                                                className="mt-2 max-w-xs"
                                            />
                                        )}
                                    </div>
                                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                                </Link>
                            </li>
                        )
                    })}
                </ul>
            )}
        </WidgetCard>
    )
}
