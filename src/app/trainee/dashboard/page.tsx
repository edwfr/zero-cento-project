import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'

export default async function TraineeDashboard() {
    const session = await getSession()

    if (!session) {
        redirect('/login')
    }

    // Verify trainee role - redirect to correct dashboard if wrong role
    if (session.user.role !== 'trainee' && session.user.role !== 'admin') {
        redirect(`/${session.user.role}/dashboard`)
    }

    return (
        <DashboardLayout user={session.user}>
            <div className="bg-white rounded-lg shadow-md p-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-4">
                    Il Mio Allenamento
                </h1>
                <p className="text-gray-600 mb-6">
                    Benvenuto, {session.user.firstName} {session.user.lastName}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-blue-50 p-6 rounded-lg">
                        <h3 className="text-lg font-semibold text-blue-900 mb-2">
                            🏋️ Programma Attivo
                        </h3>
                        <p className="text-blue-700 text-sm">
                            Visualizza il tuo programma di allenamento
                        </p>
                    </div>

                    <div className="bg-green-50 p-6 rounded-lg">
                        <h3 className="text-lg font-semibold text-green-900 mb-2">
                            💪 Massimali
                        </h3>
                        <p className="text-green-700 text-sm">
                            Registra i tuoi personal record
                        </p>
                    </div>

                    <div className="bg-purple-50 p-6 rounded-lg">
                        <h3 className="text-lg font-semibold text-purple-900 mb-2">
                            📈 Storico
                        </h3>
                        <p className="text-purple-700 text-sm">
                            Rivedi i tuoi allenamenti passati
                        </p>
                    </div>
                </div>

                <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-yellow-800 text-sm">
                        🚧 Dashboard in sviluppo - Funzionalità complete in arrivo
                    </p>
                </div>
            </div>
        </DashboardLayout>
    )
}
