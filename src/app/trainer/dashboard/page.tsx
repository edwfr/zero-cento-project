import { Suspense, type ReactNode } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import DashboardLayout from '@/components/DashboardLayout'
import { createTranslator, resolveDashboardLocale } from '@/lib/trainer-dashboard/i18n'
import { getTrainerTrainees } from '@/lib/trainer-dashboard/trainees'
import ActivityFeedWidget from './_widgets/ActivityFeedWidget'
import ConsistencyRankingWidget from './_widgets/ConsistencyRankingWidget'
import DashboardHeader from './_widgets/DashboardHeader'
import InactiveTraineesWidget from './_widgets/InactiveTraineesWidget'
import NewRecordsWidget from './_widgets/NewRecordsWidget'
import RecentFeedbackWidget from './_widgets/RecentFeedbackWidget'
import TodoTodayWidget from './_widgets/TodoTodayWidget'
import WeeklyTrendWidget from './_widgets/WeeklyTrendWidget'
import { WidgetSkeleton } from './_widgets/WidgetCard'
import type { WidgetContext } from './_widgets/types'

const SPAN_CLASS = { 1: '', 2: 'lg:col-span-2', 3: 'lg:col-span-3' } as const

/** Grid cell that streams its widget independently of the others. */
function Slot({ span = 1, children }: { span?: keyof typeof SPAN_CLASS; children: ReactNode }) {
    return (
        <div className={SPAN_CLASS[span]}>
            <Suspense fallback={<WidgetSkeleton />}>{children}</Suspense>
        </div>
    )
}

export default async function TrainerDashboard() {
    const session = await getSession()

    if (!session) {
        redirect('/login')
    }

    // Verify trainer role - redirect to correct dashboard if wrong role
    if (session.user.role !== 'trainer' && session.user.role !== 'admin') {
        redirect(`/${session.user.role}/dashboard`)
    }

    const locale = resolveDashboardLocale((await cookies()).get('i18next')?.value)
    const ctx: WidgetContext = {
        trainerId: session.user.id,
        trainees: await getTrainerTrainees(session.user.id),
        now: new Date(),
        locale,
        t: createTranslator(locale),
    }

    return (
        <DashboardLayout user={session.user}>
            <div className="space-y-6">
                <DashboardHeader ctx={ctx} firstName={session.user.firstName} />
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <Slot span={2}>
                        <TodoTodayWidget ctx={ctx} />
                    </Slot>
                    <Slot>
                        <NewRecordsWidget ctx={ctx} />
                    </Slot>
                    <Slot span={2}>
                        <RecentFeedbackWidget ctx={ctx} />
                    </Slot>
                    <Slot>
                        <InactiveTraineesWidget ctx={ctx} />
                    </Slot>
                    <Slot span={2}>
                        <WeeklyTrendWidget ctx={ctx} />
                    </Slot>
                    <Slot>
                        <ConsistencyRankingWidget ctx={ctx} />
                    </Slot>
                    <Slot span={3}>
                        <ActivityFeedWidget ctx={ctx} />
                    </Slot>
                </div>
            </div>
        </DashboardLayout>
    )
}
