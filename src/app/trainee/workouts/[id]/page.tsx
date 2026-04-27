import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import WorkoutDetailContent from './_content'

interface WorkoutDetailPageProps {
    searchParams?: Promise<{ from?: string; programId?: string }>
}

export default async function WorkoutDetailPage({ searchParams }: WorkoutDetailPageProps) {
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
    
    // Determine back navigation based on source
    let backHref = '/trainee/dashboard' // default
    if (source === 'current') {
        backHref = '/trainee/programs/current'
    } else if (source === 'history' && sourceProgramId) {
        backHref = `/trainee/programs/${sourceProgramId}`
    }

    return (
        <DashboardLayout user={session.user} backHref={backHref}>
            <WorkoutDetailContent />
        </DashboardLayout>
    )
}
