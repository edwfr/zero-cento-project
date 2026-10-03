import type { ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Card } from '@/components/Card'
import { SkeletonText } from '@/components/Skeleton'
import type { Translate } from '@/lib/trainer-dashboard/i18n'

interface WidgetCardProps {
    title: string
    subtitle?: string
    icon: ReactNode
    action?: ReactNode
    children: ReactNode
}

export function WidgetCard({ title, subtitle, icon, action, children }: WidgetCardProps) {
    return (
        <Card role="region" aria-label={title} className="h-full">
            <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                        <span className="text-brand-primary" aria-hidden="true">{icon}</span>
                        {title}
                    </h2>
                    {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
                </div>
                {action}
            </div>
            {children}
        </Card>
    )
}

export function WidgetEmpty({ icon, message }: { icon: ReactNode; message: string }) {
    return (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
            <span className="text-gray-400" aria-hidden="true">{icon}</span>
            {message}
        </div>
    )
}

export function WidgetError({ title, icon, t }: { title: string; icon: ReactNode; t: Translate }) {
    return (
        <WidgetCard title={title} icon={icon}>
            <div role="alert" className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t('trainerDashboard.widget.loadError')}
            </div>
        </WidgetCard>
    )
}

export function WidgetSkeleton() {
    return (
        <Card className="h-full" aria-hidden="true">
            <SkeletonText lines={5} />
        </Card>
    )
}

export function Avatar({ label }: { label: string }) {
    return (
        <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-brand-primary"
            aria-hidden="true"
        >
            {label}
        </span>
    )
}
