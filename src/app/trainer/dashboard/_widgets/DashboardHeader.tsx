import { Suspense } from 'react'
import Link from 'next/link'
import { Plus, UserPlus } from 'lucide-react'
import { formatLongDate, greetingKey } from '@/lib/trainer-dashboard/i18n'
import HeaderKpis from './HeaderKpis'
import type { WidgetContext } from './types'

function KpiSkeleton() {
    return (
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((index) => (
                <div key={index} className="h-24 animate-pulse rounded-lg bg-gray-100" />
            ))}
        </div>
    )
}

export default function DashboardHeader({ ctx, firstName }: { ctx: WidgetContext; firstName: string }) {
    const { t } = ctx

    return (
        <header className="rounded-xl border border-gray-200 bg-white p-6 text-gray-900 shadow-sm">
            <div className="flex items-start justify-between gap-6">
                <div>
                    <p className="text-sm text-gray-500 first-letter:uppercase">{formatLongDate(ctx.now, ctx.locale)}</p>
                    <h1 className="mt-1 text-3xl font-bold">{t(greetingKey(ctx.now), { firstName })}</h1>
                </div>
                <div className="flex shrink-0 gap-3">
                    <Link
                        href="/trainer/programs/new"
                        className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 font-semibold text-gray-900 transition-colors hover:bg-brand-primary-hover"
                    >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        {t('trainerDashboard.header.newProgram')}
                    </Link>
                    <Link
                        href="/trainer/trainees/new"
                        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 transition-colors hover:bg-gray-50"
                    >
                        <UserPlus className="h-4 w-4" aria-hidden="true" />
                        {t('trainerDashboard.header.newTrainee')}
                    </Link>
                </div>
            </div>
            <Suspense fallback={<KpiSkeleton />}>
                <HeaderKpis ctx={ctx} />
            </Suspense>
        </header>
    )
}
