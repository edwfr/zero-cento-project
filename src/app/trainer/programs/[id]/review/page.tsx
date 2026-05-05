import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import ReviewProgramContent from './_content'

interface ReviewProgramPageProps {
    searchParams?: Promise<{ backContext?: string; traineeId?: string }>
}

export default async function ReviewProgramPage({ searchParams }: ReviewProgramPageProps) {
    const resolvedSearchParams = await searchParams
    const session = await getSession()
    if (!session) redirect('/login')
    if (session.user.role !== 'trainer') redirect(`/${session.user.role}/dashboard`)

    const backContext = resolvedSearchParams?.backContext
    const traineeId = resolvedSearchParams?.traineeId
    const backHref = backContext === 'trainee' && traineeId
        ? `/trainer/trainees/${traineeId}`
        : '/trainer/programs'

    return (
        <DashboardLayout user={session.user} backHref={backHref}>
            <ReviewProgramContent />
        </DashboardLayout>
    )
}