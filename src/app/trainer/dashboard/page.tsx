import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { NavigationCard, ProgressBar } from '@/components'
import WeekTypeBadge from '@/components/WeekTypeBadge'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/date-format'
import {
    Users,
    ClipboardList,
    Dumbbell,
    Flame,
    Plus,
    User,
    Eye,
    FlaskConical,
} from 'lucide-react'
import trainerIt from '../../../../public/locales/it/trainer.json'
import trainerEn from '../../../../public/locales/en/trainer.json'

type SupportedLocale = 'it' | 'en'
type TranslationValue = string | number

const TRAINER_DICTIONARIES = {
    it: trainerIt,
    en: trainerEn,
} as const

const resolveLocale = (cookieLocale?: string): SupportedLocale => {
    if (!cookieLocale) return 'it'
    return cookieLocale.toLowerCase().startsWith('en') ? 'en' : 'it'
}

const resolveTranslation = (dictionary: Record<string, unknown>, key: string): string | null => {
    const value = key
        .split('.')
        .reduce<unknown>((current, part) => {
            if (current && typeof current === 'object' && part in current) {
                return (current as Record<string, unknown>)[part]
            }
            return null
        }, dictionary)

    return typeof value === 'string' ? value : null
}

const translate = (
    dictionary: Record<string, unknown>,
    key: string,
    params?: Record<string, TranslationValue>
): string => {
    const template = resolveTranslation(dictionary, key)

    if (!template) {
        return key
    }

    if (!params) {
        return template
    }

    return Object.entries(params).reduce((result, [paramKey, paramValue]) => {
        return result.replaceAll(`{{${paramKey}}}`, String(paramValue))
    }, template)
}

function addDays(date: Date, days: number) {
    const nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + days)
    return nextDate
}

function getCurrentWeekRange(referenceDate: Date) {
    const startDate = new Date(referenceDate)
    const weekDay = (startDate.getDay() + 6) % 7
    startDate.setDate(startDate.getDate() - weekDay)
    startDate.setHours(0, 0, 0, 0)

    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 6)
    endDate.setHours(23, 59, 59, 999)

    return { startDate, endDate }
}

function hasCompletedFeedback(feedbacks: Array<{ completed: boolean }>) {
    return feedbacks.some((feedback) => feedback.completed)
}

export default async function TrainerDashboard() {
    const session = await getSession()
    const locale = resolveLocale(cookies().get('i18next')?.value)
    const dictionary = TRAINER_DICTIONARIES[locale] as Record<string, unknown>
    const t = (key: string, params?: Record<string, TranslationValue>) =>
        translate(dictionary, key, params)

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
    const currentWeekRange = getCurrentWeekRange(currentMoment)

    const currentTestWeeks = await prisma.week.findMany({
        where: {
            weekType: 'test',
            startDate: {
                lte: currentMoment,
                gte: currentWeekRange.startDate,
            },
            program: {
                trainerId,
                status: {
                    in: ['active', 'completed'],
                },
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
            locale
        )

        if (traineeLastNameComparison !== 0) {
            return traineeLastNameComparison
        }

        const traineeFirstNameComparison = leftWeek.program.trainee.firstName.localeCompare(
            rightWeek.program.trainee.firstName,
            locale
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
                        {t('trainerDashboard.headerTitle')}
                    </h1>
                    <p className="text-gray-600">
                        {t('trainerDashboard.welcome', {
                            firstName: session.user.firstName,
                            lastName: session.user.lastName,
                        })}
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
                            <h3 className="text-lg font-semibold text-blue-900"><Users className="w-5 h-5 inline mr-2" />{t('trainerDashboard.statsCardTraineesTitle')}</h3>
                            <span className="text-3xl font-bold text-blue-600">
                                {traineesCount}
                            </span>
                        </div>
                        <p className="text-blue-700 text-sm">
                            {t('trainerDashboard.statsCardTraineesSub', { count: activeTraineesCount })}
                        </p>
                    </Link>

                    {/* Programs Card */}
                    <Link
                        href="/trainer/programs"
                        className="bg-green-50 hover:bg-green-100 p-6 rounded-lg transition-colors border border-green-200"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold text-green-900">
                                <ClipboardList className="w-5 h-5 inline mr-2" />{t('trainerDashboard.statsCardProgramsTitle')}
                            </h3>
                            <span className="text-3xl font-bold text-green-600">
                                {draftCount + activeCount + completedCount}
                            </span>
                        </div>
                        <p className="text-green-700 text-sm">
                            {t('trainerDashboard.statsCardProgramsSub', {
                                active: activeCount,
                                draft: draftCount,
                            })}
                        </p>
                    </Link>

                    {/* Exercises Card */}
                    <Link
                        href="/trainer/exercises"
                        className="bg-purple-50 hover:bg-purple-100 p-6 rounded-lg transition-colors border border-purple-200"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold text-purple-900">
                                <Dumbbell className="w-5 h-5 inline mr-2" />{t('trainerDashboard.statsCardExercisesTitle')}
                            </h3>
                            <span className="text-3xl font-bold text-purple-600">
                                {exercisesCount}
                            </span>
                        </div>
                        <p className="text-purple-700 text-sm">{t('trainerDashboard.statsCardExercisesSub')}</p>
                    </Link>

                    {/* Current Test Weeks KPI */}
                    <Link
                        href="#current-test-weeks"
                        className="bg-orange-50 hover:bg-orange-100 p-6 rounded-lg transition-colors border border-orange-200"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold text-orange-900">
                                <Flame className="w-5 h-5 inline mr-2" />{t('trainerDashboard.statsCardTestWeeksTitle')}
                            </h3>
                            <div className="text-right">
                                <span className="text-3xl font-bold text-orange-600">
                                    {completedCurrentTestWeeksCount} / {currentTestWeeksCount}
                                </span>
                            </div>
                        </div>
                        <p className="text-orange-700 text-sm">{t('trainerDashboard.statsCardTestWeeksSub')}</p>
                    </Link>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                        {t('trainerDashboard.quickActionsTitle')}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Link
                            href="/trainer/programs/new"
                            className="flex items-center justify-center bg-brand-primary hover:bg-brand-primary-hover text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                        >
                            <Plus className="w-5 h-5 mr-2" />
                            {t('trainerDashboard.quickActionCreateProgram')}
                        </Link>
                        <Link
                            href="/trainer/trainees/new"
                            className="flex items-center justify-center bg-brand-primary hover:bg-brand-primary-hover text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                        >
                            <User className="w-5 h-5 mr-2" />
                            {t('trainerDashboard.quickActionAddTrainee')}
                        </Link>
                        <Link
                            href="/trainer/exercises/new"
                            className="flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                        >
                            <Dumbbell className="w-5 h-5 mr-2" />
                            {t('trainerDashboard.quickActionCreateExercise')}
                        </Link>
                    </div>
                </div>

                {/* Navigation Cards */}
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('trainerDashboard.sectionsTitle')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <NavigationCard
                            href="/trainer/trainees"
                            icon={<Users className="w-6 h-6" />}
                            title={t('trainerDashboard.navTraineesTitle')}
                            description={t('trainerDashboard.navTraineesDescription', { count: traineesCount })}
                            color="blue"
                        />
                        <NavigationCard
                            href="/trainer/programs"
                            icon={<ClipboardList className="w-6 h-6" />}
                            title={t('trainerDashboard.navProgramsTitle')}
                            description={t('trainerDashboard.navProgramsDescription', {
                                active: activeCount,
                                draft: draftCount,
                            })}
                            color="green"
                        />
                        <NavigationCard
                            href="/trainer/exercises"
                            icon={<Dumbbell className="w-6 h-6" />}
                            title={t('trainerDashboard.navExercisesTitle')}
                            description={t('trainerDashboard.navExercisesDescription', { count: exercisesCount })}
                            color="purple"
                        />
                        <NavigationCard
                            href="/trainer/profile"
                            icon={<User className="w-6 h-6" />}
                            title={t('trainerDashboard.navProfileTitle')}
                            description={t('trainerDashboard.navProfileDescription')}
                            color="secondary"
                        />
                    </div>
                </div>

                <div id="current-test-weeks" className="bg-white rounded-lg shadow-md p-6 scroll-mt-24">
                    <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                {t('trainerDashboard.testKpiTitle')}
                            </h2>
                            <p className="mt-1 text-sm text-gray-600">
                                {t('trainerDashboard.testKpiDescription')}
                            </p>
                        </div>
                        <div className="rounded-full bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-800">
                            {t('trainerDashboard.testKpiUsers', {
                                completed: completedCurrentTestWeeksCount,
                                total: currentTestWeeksCount,
                            })}
                        </div>
                    </div>

                    {currentTestWeekAssignments.length > 0 ? (
                        <div className="space-y-3">
                            {currentTestWeekAssignments.map((testWeek) => {
                                const testWeekEndDate = testWeek.startDate
                                    ? addDays(testWeek.startDate, 6)
                                    : null
                                const isTestWeekCompleted =
                                    testWeek.plannedTestsCount > 0 &&
                                    testWeek.completedTestsCount === testWeek.plannedTestsCount

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
                                                <span className="font-medium text-gray-900">{t('trainerDashboard.programLabel')}:</span>{' '}
                                                {testWeek.program.title}
                                            </div>
                                            <ProgressBar
                                                current={testWeek.completedTestsCount}
                                                total={testWeek.plannedTestsCount}
                                                label={t('trainerDashboard.testCompletedLabel')}
                                                size="sm"
                                                color={testWeek.completedTestsCount === testWeek.plannedTestsCount ? 'success' : 'warning'}
                                                className="max-w-md"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-3 text-sm text-gray-600 md:items-end md:text-right">
                                            <div className="font-semibold text-gray-900">
                                                {t('trainerDashboard.weekLabel', { week: testWeek.weekNumber })}
                                            </div>
                                            <div>
                                                {testWeek.startDate
                                                    ? t('trainerDashboard.weekRangeLabel', {
                                                        start: formatDate(testWeek.startDate, 'medium'),
                                                        end: formatDate(testWeekEndDate, 'medium'),
                                                    })
                                                    : t('trainerDashboard.datesUnavailable')}
                                            </div>
                                            <Link
                                                href={`/trainer/programs/${testWeek.program.id}`}
                                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 font-semibold text-brand-primary shadow-sm ring-1 ring-inset ring-brand-primary/20 transition-colors hover:bg-brand-primary/5"
                                            >
                                                <Eye className="h-4 w-4" />
                                                {t('trainerDashboard.goToProgram')}
                                            </Link>
                                            {isTestWeekCompleted ? (
                                                <Link
                                                    href={`/trainer/programs/${testWeek.program.id}/tests?backContext=dashboard`}
                                                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-50 px-3 py-2 font-semibold text-orange-700 shadow-sm ring-1 ring-inset ring-orange-200 transition-colors hover:bg-orange-100"
                                                >
                                                    <FlaskConical className="h-4 w-4" />
                                                    {t('trainerDashboard.openResults')}
                                                </Link>
                                            ) : (
                                                <span
                                                    aria-disabled="true"
                                                    className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-gray-100 px-3 py-2 font-semibold text-gray-400 ring-1 ring-inset ring-gray-200"
                                                >
                                                    <FlaskConical className="h-4 w-4" />
                                                    {t('trainerDashboard.openResults')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm text-gray-600">
                            {t('trainerDashboard.noCurrentTestWeeks')}
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    )
}
