import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import AdminDashboardContent from './_content'

export default async function AdminDashboard() {
    const session = await getSession()

    if (!session) {
        redirect('/login')
    }

    // Verify admin role - redirect to correct dashboard if wrong role
    if (session.user.role !== 'admin') {
        redirect(`/${session.user.role}/dashboard`)
    }

    return (
        <DashboardLayout user={session.user}>
            <AdminDashboardContent />
        </DashboardLayout>
    )
}
