import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { NavigationCard } from '@/components'
import { prisma } from '@/lib/prisma'

export default async function TrainerDashboard() {
    const session = await getSession()

    if (!session) {
        redirect('/login')
    }

    // Verify trainer role - redirect to correct dashboard if wrong role
    if (session.user.role !== 'trainer' && session.user.role !== 'admin') {
        redirect(`/${session.user.role}/dashboard`)
    }

    // Fetch trainer statistics
    const trainerId = session.user.id

    // Get trainees count
    const traineesCount = await prisma.trainerTrainee.count({
        where: { trainerId },
    })

    // Get active trainees count
    const activeTrainees = await prisma.trainerTrainee.findMany({
        where: { trainerId },
        include: {
            trainee: {
                select: {
                    isActive: true,
                },
            },
        },
    })
    const activeTraineesCount = activeTrainees.filter((t) => t.trainee.isActive).length

    // Get programs count by status
    const programsCounts = await prisma.trainingProgram.groupBy({
        by: ['status'],
        where: { trainerId },
        _count: true,
    })

    const draftCount = programsCounts.find((p) => p.status === 'draft')?._count || 0
    const activeCount = programsCounts.find((p) => p.status === 'active')?._count || 0
    const completedCount = programsCounts.find((p) => p.status === 'completed')?._count || 0

    // Get exercises count
    const exercisesCount = await prisma.exercise.count({
        where: { createdBy: trainerId },
    })

    // Get recent feedback (last 5)
    const recentFeedback = await prisma.exerciseFeedback.findMany({
        where: {
            workoutExercise: {
                workout: {
                    week: {
                        program: {
                            trainerId,
                        },
                    },
                },
            },
        },
        include: {
            trainee: {
                select: {
                    firstName: true,
                    lastName: true,
                },
            },
            workoutExercise: {
                include: {
                    exercise: {
                        select: {
                            name: true,
                        },
                    },
                    workout: {
                        include: {
                            week: {
                                include: {
                                    program: {
                                        select: {
                                            title: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            setsPerformed: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
        take: 5,
    })

    return (
        <DashboardLayout user={session.user}>
            <div className="space-y-6">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Dashboard Trainer
                    </h1>
                    <p className="text-gray-600">
                        Benvenuto, {session.user.firstName} {session.user.lastName}
                    </p>
                </div>

                {/* Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Trainees Card */}
                    <Link
                        href="/trainer/trainees"
                        className="bg-blue-50 hover:bg-blue-100 p-6 rounded-lg transition-colors border border-blue-200"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold text-blue-900">👥 Atleti</h3>
                            <span className="text-3xl font-bold text-blue-600">
                                {traineesCount}
                            </span>
                        </div>
                        <p className="text-blue-700 text-sm">
                            {activeTraineesCount} attivi
                        </p>
                    </Link>

                    {/* Programs Card */}
                    <Link
                        href="/trainer/programs"
                        className="bg-green-50 hover:bg-green-100 p-6 rounded-lg transition-colors border border-green-200"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold text-green-900">
                                📋 Programmi
                            </h3>
                            <span className="text-3xl font-bold text-green-600">
                                {draftCount + activeCount + completedCount}
                            </span>
                        </div>
                        <p className="text-green-700 text-sm">
                            {activeCount} attivi · {draftCount} bozze
                        </p>
                    </Link>

                    {/* Exercises Card */}
                    <Link
                        href="/trainer/exercises"
                        className="bg-purple-50 hover:bg-purple-100 p-6 rounded-lg transition-colors border border-purple-200"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold text-purple-900">
                                🏋️ Esercizi
                            </h3>
                            <span className="text-3xl font-bold text-purple-600">
                                {exercisesCount}
                            </span>
                        </div>
                        <p className="text-purple-700 text-sm">Libreria esercizi</p>
                    </Link>

                    {/* Feedback Card */}
                    <div className="bg-orange-50 p-6 rounded-lg border border-orange-200">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold text-orange-900">
                                💬 Feedback
                            </h3>
                            <span className="text-3xl font-bold text-orange-600">
                                {recentFeedback.length}
                            </span>
                        </div>
                        <p className="text-orange-700 text-sm">Ultimi ricevuti</p>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                        Azioni Rapide
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Link
                            href="/trainer/programs/new"
                            className="flex items-center justify-center bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                        >
                            <span className="mr-2">➕</span>
                            Crea Programma
                        </Link>
                        <Link
                            href="/trainer/trainees/new"
                            className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                        >
                            <span className="mr-2">👤</span>
                            Aggiungi Atleta
                        </Link>
                        <Link
                            href="/trainer/exercises/new"
                            className="flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                        >
                            <span className="mr-2">🏋️</span>
                            Crea Esercizio
                        </Link>
                    </div>
                </div>

                {/* Navigation Cards */}
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Sezioni</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <NavigationCard
                            href="/trainer/trainees"
                            icon="👥"
                            title="I Miei Atleti"
                            description={`Gestisci i tuoi ${traineesCount} atleti. Visualizza progressi e assegna programmi.`}
                            color="blue"
                        />
                        <NavigationCard
                            href="/trainer/programs"
                            icon="📋"
                            title="Programmi"
                            description={`${activeCount} programmi attivi, ${draftCount} bozze. Crea e modifica schede di allenamento.`}
                            color="green"
                        />
                        <NavigationCard
                            href="/trainer/exercises"
                            icon="🏋️"
                            title="Libreria Esercizi"
                            description={`${exercisesCount} esercizi creati. Gestisci la tua libreria personalizzata.`}
                            color="purple"
                        />
                        <NavigationCard
                            href="/trainer/profile"
                            icon="👤"
                            title="Il Mio Profilo"
                            description="Aggiorna le tue informazioni personali e preferenze."
                            color="secondary"
                        />
                    </div>
                </div>

                {/* Recent Feedback */}
                {recentFeedback.length > 0 && (
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">
                            Feedback Recenti
                        </h2>
                        <div className="space-y-3">
                            {recentFeedback.map((feedback) => {
                                const totalVolume = feedback.setsPerformed.reduce(
                                    (sum, set) => sum + set.reps * set.weight,
                                    0
                                )
                                const avgRPE = feedback.actualRpe || null

                                return (
                                    <div
                                        key={feedback.id}
                                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-2">
                                                <span className="font-semibold text-gray-900">
                                                    {feedback.trainee.firstName}{' '}
                                                    {feedback.trainee.lastName}
                                                </span>
                                                <span className="text-gray-400">·</span>
                                                <span className="text-sm text-gray-600">
                                                    {feedback.workoutExercise.exercise.name}
                                                </span>
                                            </div>
                                            <div className="text-sm text-gray-500 mt-1">
                                                {feedback.workoutExercise.workout.week.program.title}
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-4 text-sm">
                                            <div className="text-right">
                                                <div className="text-gray-900 font-semibold">
                                                    {Math.round(totalVolume)} kg
                                                </div>
                                                <div className="text-gray-500">Volume</div>
                                            </div>
                                            {avgRPE && (
                                                <div className="text-right">
                                                    <div className="text-gray-900 font-semibold">
                                                        RPE {avgRPE.toFixed(1)}
                                                    </div>
                                                    <div className="text-gray-500">Percepito</div>
                                                </div>
                                            )}
                                            <div className="text-gray-400">
                                                {new Date(
                                                    feedback.createdAt
                                                ).toLocaleDateString('it-IT', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    )
}
