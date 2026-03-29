import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import UsersTable from '@/components/UsersTable'

export default async function AdminUsersPage() {
    const session = await getSession()

    if (!session) {
        redirect('/login')
    }

    // Only admin can access
    if (session.user.role !== 'admin') {
        redirect(`/${session.user.role}/dashboard`)
    }

    return (
        <DashboardLayout user={session.user}>
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">
                        Gestione Anagrafiche
                    </h1>
                </div>

                <p className="text-gray-600 mb-6">
                    Visualizza e gestisci tutti gli utenti del sistema
                </p>

                <UsersTable />
            </div>
        </DashboardLayout>
    )
}
