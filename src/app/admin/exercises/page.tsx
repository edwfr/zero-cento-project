import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import AdminExercisesContent from './_content'

export default async function AdminExercises() {
    const session = await getSession()

    if (!session) {
        redirect('/login')
    }

    if (session.user.role !== 'admin') {
        redirect(`/${session.user.role}/dashboard`)
    }

    return (
        <DashboardLayout user={session.user}>
            <AdminExercisesContent />
        </DashboardLayout>
    )
}
