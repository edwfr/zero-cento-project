import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { NavigationCard, ProgressBar } from '@/components'
import WeekTypeBadge from '@/components/WeekTypeBadge'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/date-format'
import { Users, ClipboardList, Dumbbell, Flame, Plus, User } from 'lucide-react'

const MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1000

function addDays(date: Date, days: number) {
    const nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + days)
    return nextDate
}

function hasCompletedFeedback(feedbacks: Array<{ completed: boolean }>) {
    return feedbacks.some((feedback) => feedback.completed)
}

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

    // Get active test weeks currently in progress for the trainer's athletes.
    const currentMoment = new Date()
    const sevenDaysAgo = new Date(currentMoment.getTime() - (7 * MILLISECONDS_IN_DAY))

    const currentTestWeeks = await prisma.week.findMany({
        where: {
            weekType: 'test',
            startDate: {
                lte: currentMoment,
                gt: sevenDaysAgo,
            },
            program: {
                trainerId,
                status: 'active',
            },
        },
        select: {
            id: true,
            weekNumber: true,
            startDate: true,
            workouts: {
                select: {
                    id: true,
                    workoutExercises: {
                        select: {
                            id: true,
                            exerciseFeedbacks: {
                                select: {
                                    completed: true,
                                },
                            },
                        },
                    },
                },
                orderBy: {
                    dayIndex: 'asc',
                },
            },
            program: {
                select: {
                    id: true,
                    title: true,
                    trainee: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                },
            },
        },
    })

    const currentTestWeekAssignments = currentTestWeeks.map((week) => {
        const plannedTestsCount = week.workouts.filter(
            (workout) => workout.workoutExercises.length > 0
        ).length

        const completedTestsCount = week.workouts.filter((workout) => {
            if (workout.workoutExercises.length === 0) {
                return false
            }

            return workout.workoutExercises.every((exercise) =>
                hasCompletedFeedback(exercise.exerciseFeedbacks)
            )
        }).length

        return {
            ...week,
            plannedTestsCount,
            completedTestsCount,
        }
    }).sort((leftWeek, rightWeek) => {
        const traineeLastNameComparison = leftWeek.program.trainee.lastName.localeCompare(
            rightWeek.program.trainee.lastName,
            'it'
        )

        if (traineeLastNameComparison !== 0) {
            return traineeLastNameComparison
        }

        const traineeFirstNameComparison = leftWeek.program.trainee.firstName.localeCompare(
            rightWeek.program.trainee.firstName,
            'it'
        )

        if (traineeFirstNameComparison !== 0) {
            return traineeFirstNameComparison
        }

        return leftWeek.weekNumber - rightWeek.weekNumber
    })

    const currentTestWeeksCount = new Set(currentTestWeekAssignments.map((week) => week.program.trainee.id)).size
    const completedCurrentTestWeeksCount = currentTestWeekAssignments.filter(
        (week) => week.plannedTestsCount > 0 && week.completedTestsCount === week.plannedTestsCount
    ).length

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
                            <h3 className="text-lg font-semibold text-blue-900"><Users className="w-5 h-5 inline mr-2" />Atleti</h3>
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
                                <ClipboardList className="w-5 h-5 inline mr-2" />Programmi
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
                                <Dumbbell className="w-5 h-5 inline mr-2" />Esercizi
                            </h3>
                            <span className="text-3xl font-bold text-purple-600">
                                {exercisesCount}
                            </span>
                        </div>
                        <p className="text-purple-700 text-sm">Libreria esercizi</p>
                    </Link>

                    {/* Current Test Weeks KPI */}
                    <Link
                        href="#current-test-weeks"
                        className="bg-orange-50 hover:bg-orange-100 p-6 rounded-lg transition-colors border border-orange-200"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold text-orange-900">
                                <Flame className="w-5 h-5 inline mr-2" />Settimane Test
                            </h3>
                            <div className="text-right">
                                <span className="text-3xl font-bold text-orange-600">
                                    {completedCurrentTestWeeksCount} / {currentTestWeeksCount}
                                </span>
                            </div>
                        </div>
                        <p className="text-orange-700 text-sm">Utenti con test week completata / utenti con test week corrente</p>
                    </Link>
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
                            <Plus className="w-5 h-5 mr-2" />
                            Crea Programma
                        </Link>
                        <Link
                            href="/trainer/trainees/new"
                            className="flex items-center justify-center bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                        >
                            <User className="w-5 h-5 mr-2" />
                            Aggiungi Atleta
                        </Link>
                        <Link
                            href="/trainer/exercises/new"
                            className="flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                        >
                            <Dumbbell className="w-5 h-5 mr-2" />
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
                            icon={<Users className="w-6 h-6" />}
                            title="I Miei Atleti"
                            description={`Gestisci i tuoi ${traineesCount} atleti. Visualizza progressi e assegna programmi.`}
                            color="blue"
                        />
                        <NavigationCard
                            href="/trainer/programs"
                            icon={<ClipboardList className="w-6 h-6" />}
                            title="Programmi"
                            description={`${activeCount} programmi attivi, ${draftCount} bozze. Crea e modifica schede di allenamento.`}
                            color="green"
                        />
                        <NavigationCard
                            href="/trainer/exercises"
                            icon={<Dumbbell className="w-6 h-6" />}
                            title="Libreria Esercizi"
                            description={`${exercisesCount} esercizi creati. Gestisci la tua libreria personalizzata.`}
                            color="purple"
                        />
                        <NavigationCard
                            href="/trainer/profile"
                            icon={<User className="w-6 h-6" />}
                            title="Il Mio Profilo"
                            description="Aggiorna le tue informazioni personali e preferenze."
                            color="secondary"
                        />
                    </div>
                </div>

                <div id="current-test-weeks" className="bg-white rounded-lg shadow-md p-6 scroll-mt-24">
                    <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                KPI Settimane Test Correnti
                            </h2>
                            <p className="mt-1 text-sm text-gray-600">
                                Elenco degli atleti in settimana test, con scheda associata e link alla progressione.
                            </p>
                        </div>
                        <div className="rounded-full bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-800">
                            {completedCurrentTestWeeksCount} / {currentTestWeeksCount} utenti
                        </div>
                    </div>

                    {currentTestWeekAssignments.length > 0 ? (
                        <div className="space-y-3">
                            {currentTestWeekAssignments.map((testWeek) => {
                                const testWeekEndDate = testWeek.startDate
                                    ? addDays(testWeek.startDate, 6)
                                    : null

                                return (
                                    <div
                                        key={testWeek.id}
                                        className="flex flex-col gap-4 rounded-lg border border-orange-100 bg-orange-50/40 p-4 md:flex-row md:items-center md:justify-between"
                                    >
                                        <div className="space-y-3 md:flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-semibold text-gray-900">
                                                    {testWeek.program.trainee.firstName} {testWeek.program.trainee.lastName}
                                                </span>
                                                <WeekTypeBadge weekType="test" />
                                            </div>
                                            <div className="text-sm text-gray-700">
                                                <span className="font-medium text-gray-900">Scheda:</span>{' '}
                                                {testWeek.program.title}
                                            </div>
                                            <ProgressBar
                                                current={testWeek.completedTestsCount}
                                                total={testWeek.plannedTestsCount}
                                                label="Test completati"
                                                size="sm"
                                                color={testWeek.completedTestsCount === testWeek.plannedTestsCount ? 'success' : 'warning'}
                                                className="max-w-md"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-3 text-sm text-gray-600 md:items-end md:text-right">
                                            <div className="font-semibold text-gray-900">
                                                Settimana {testWeek.weekNumber}
                                            </div>
                                            <div>
                                                {testWeek.startDate
                                                    ? `Dal ${formatDate(testWeek.startDate, 'medium')} al ${formatDate(testWeekEndDate, 'medium')}`
                                                    : 'Date non disponibili'}
                                            </div>
                                            <Link
                                                href={`/trainer/programs/${testWeek.program.id}/progress`}
                                                className="inline-flex items-center justify-center rounded-lg bg-white px-3 py-2 font-semibold text-brand-primary shadow-sm ring-1 ring-inset ring-brand-primary/20 transition-colors hover:bg-brand-primary/5"
                                            >
                                                Vai al progresso scheda
                                            </Link>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm text-gray-600">
                            Nessun atleta si trova attualmente in una settimana test.
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    )
}
