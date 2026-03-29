import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import ProfileForm from '@/components/ProfileForm'

export default async function ProfilePage() {
    const session = await getSession()

    if (!session) {
        redirect('/login')
    }

    return (
        <DashboardLayout user={session.user}>
            <div className="max-w-3xl mx-auto">
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-6">
                        Il Mio Profilo
                    </h1>

                    <div className="space-y-6">
                        {/* User Info Display */}
                        <div className="border-b border-gray-200 pb-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">
                                Informazioni Account
                            </h2>

                            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Email</dt>
                                    <dd className="mt-1 text-sm text-gray-900">{session.user.email}</dd>
                                </div>

                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Ruolo</dt>
                                    <dd className="mt-1 text-sm text-gray-900 capitalize">
                                        {session.user.role === 'admin' && 'Amministratore'}
                                        {session.user.role === 'trainer' && 'Trainer'}
                                        {session.user.role === 'trainee' && 'Atleta'}
                                    </dd>
                                </div>

                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Nome</dt>
                                    <dd className="mt-1 text-sm text-gray-900">{session.user.firstName}</dd>
                                </div>

                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Cognome</dt>
                                    <dd className="mt-1 text-sm text-gray-900">{session.user.lastName}</dd>
                                </div>

                                <div>
                                    <dt className="text-sm font-medium text-gray-500">ID Utente</dt>
                                    <dd className="mt-1 text-sm text-gray-900 font-mono">{session.user.id}</dd>
                                </div>
                            </dl>
                        </div>

                        {/* Edit Form */}
                        <ProfileForm user={session.user} />
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
