import { SkeletonDashboard } from '@/components'

export default function Loading() {
    return (
        <div className="min-h-screen bg-gray-50 px-4 sm:px-6 lg:px-8 py-8">
            <SkeletonDashboard cards={3} showTable={false} />
        </div>
    )
}
