import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import ExercisesTable from '@/components/ExercisesTable'

export default async function AdminExercises() {
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
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Gestione Libreria Esercizi
                    </h1>
                    <p className="text-gray-600">
                        Visualizza e gestisci tutti gli esercizi, gruppi muscolari e schemi motori del sistema
                    </p>
                </div>

                <ExercisesTable />

                <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-blue-800 text-sm">
                        💡 <strong>Nota:</strong> Gli esercizi creati sono condivisi con tutti i trainer per la creazione delle schede.
                        Assicurati di inserire URL YouTube validi per i video dimostrativi.
                    </p>
                </div>
            </div>
        </DashboardLayout>
    )
}
