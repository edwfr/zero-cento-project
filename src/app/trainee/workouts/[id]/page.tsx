import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import WorkoutDetailContent from './_content'

interface WorkoutDetailPageProps {
    params: Promise<{ id: string }>
    searchParams?: Promise<{ from?: string; programId?: string }>
}

export default async function WorkoutDetailPage({ params, searchParams }: WorkoutDetailPageProps) {
    const { id } = await params
    const resolvedSearchParams = await searchParams
    const session = await getSession()

    if (!session) {
        redirect('/login')
    }

    if (session.user.role !== 'trainee') {
        redirect(`/${session.user.role}/dashboard`)
    }

    const source = resolvedSearchParams?.from
    const sourceProgramId = resolvedSearchParams?.programId
    const backHref =
        source === 'history' && sourceProgramId
            ? `/trainee/programs/${sourceProgramId}`
            : '/trainee/programs/current'

    return (
        <DashboardLayout user={session.user} backHref={backHref}>
            <WorkoutDetailContent />
        </DashboardLayout>
    )
}
