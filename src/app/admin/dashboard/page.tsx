import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import Link from 'next/link'

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
            <div className="bg-white rounded-lg shadow-md p-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-4">
                    Dashboard Amministratore
                </h1>
                <p className="text-gray-600 mb-6">
                    Benvenuto, {session.user.firstName} {session.user.lastName}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Link href="/admin/users" className="bg-blue-50 p-6 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer">
                        <h3 className="text-lg font-semibold text-blue-900 mb-2">
                            👥 Gestione Anagrafiche Utenti
                        </h3>
                        <p className="text-blue-700 text-sm">
                            Visualizza e gestisci tutti gli utenti del sistema (CRUD completo)
                        </p>
                    </Link>

                    <Link href="/admin/exercises" className="bg-orange-50 p-6 rounded-lg hover:bg-orange-100 transition-colors cursor-pointer">
                        <h3 className="text-lg font-semibold text-orange-900 mb-2">
                            💪 Gestione Libreria Esercizi
                        </h3>
                        <p className="text-orange-700 text-sm">
                            Gestisci gli esercizi, gruppi muscolari e schemi motori
                        </p>
                    </Link>

                    <div className="bg-green-50 p-6 rounded-lg">
                        <h3 className="text-lg font-semibold text-green-900 mb-2">
                            🖥️ Sistema
                        </h3>
                        <p className="text-green-700 text-sm">
                            Monitora lo stato del sistema
                        </p>
                    </div>

                    <div className="bg-purple-50 p-6 rounded-lg">
                        <h3 className="text-lg font-semibold text-purple-900 mb-2">
                            📊 Statistiche
                        </h3>
                        <p className="text-purple-700 text-sm">
                            Visualizza statistiche globali
                        </p>
                    </div>
                </div>

                <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-blue-800 text-sm">
                        💡 <strong>Novità:</strong> Clicca su "Gestione Anagrafiche Utenti" per accedere alla gestione completa di tutti gli utenti, oppure su "Gestione Libreria Esercizi" per gestire esercizi e gruppi muscolari.
                    </p>
                </div>
            </div>
        </DashboardLayout>
    )
}
