'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import LoadingSpinner from '@/components/LoadingSpinner'
import ConfirmationModal from '@/components/ConfirmationModal'
import ProgramMuscleGroupCharts from '@/components/ProgramMuscleGroupCharts'
import { useToast } from '@/components/ToastNotification'
import WeekTypeBadge from '@/components/WeekTypeBadge'
import EditProgramMetadata from './EditProgramMetadata'
import MovementPatternTag from '@/components/MovementPatternTag'
import { ClipboardList, Flame, Wind, ArrowLeft, FileEdit, Copy } from 'lucide-react'

// Brand primary color - default per movement pattern senza colore personalizzato
const PRIMARY_COLOR = '#FFA700'

interface MovementPattern {
    id: string
    name: string
    color: string
}

interface WorkoutExerciseMuscleGroup {
    coefficient: number
    muscleGroup: {
        id: string
        name: string
    }
}

interface WorkoutExercise {
    id: string
    sets: number
    isWarmup: boolean
    exercise: {
        id: string
        name: string
        exerciseMuscleGroups: WorkoutExerciseMuscleGroup[]
    }
}

interface Workout {
    id: string
    dayOfWeek: number
    order: number
    exerciseCount: number
    movementPatterns: MovementPattern[]
    workoutExercises: WorkoutExercise[]
}

interface Week {
    id: string
    weekNumber: number
    weekType: 'normal' | 'test' | 'deload'
    workouts: Workout[]
}

interface Program {
    id: string
    title: string
    status: 'draft' | 'active' | 'completed'
    trainee: {
        id: string
        firstName: string
        lastName: string
    }
    durationWeeks: number
    workoutsPerWeek: number
    weeks: Week[]
}

interface EditProgramContentProps {
    readOnly?: boolean
}

export default function EditProgramContent({ readOnly = false }: EditProgramContentProps) {
    const params = useParams()
    const programId = params.id as string
    const { showToast } = useToast()
    const { t } = useTranslation('trainer')

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [copyingFirstWeek, setCopyingFirstWeek] = useState(false)
    const [program, setProgram] = useState<Program | null>(null)
    const [error, setError] = useState<string | null>(null)
    const loadingRef = useRef(false)
    const [confirmCopyOpen, setConfirmCopyOpen] = useState(false)

    useEffect(() => {
        fetchProgram()
    }, [programId])

    // Ricarica i dati quando si torna alla pagina (ad esempio dopo aver modificato un workout)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && !loadingRef.current) {
                fetchProgram()
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, []) // array vuoto: si registra una sola volta

    const fetchProgram = async () => {
        if (loadingRef.current) return
        loadingRef.current = true
        try {
            setLoading(true)
            const res = await fetch(`/api/programs/${programId}`, {
                cache: 'no-store',
            })
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('editProgram.errorLoading'), t))
            }

            // Trasforma i dati per calcolare exerciseCount e estrarre movement patterns da workoutExercises
            const transformedProgram = {
                ...data.data.program,
                weeks: data.data.program.weeks.map((week: any) => ({
                    ...week,
                    workouts: week.workouts.map((workout: any) => {
                        const workoutExercises = workout.workoutExercises || []
                        const trainerId = data.data.program.trainerId

                        // Estrai movement pattern (uno per esercizio, con duplicati)
                        console.log(
                            `[workout ${workout.id}] exercises:`,
                            workoutExercises.map((we: any) => ({
                                exercise: we.exercise?.name,
                                movementPattern: we.exercise?.movementPattern?.name ?? '⚠️ missing',
                            }))
                        )
                        const movementPatterns: MovementPattern[] = []
                        workoutExercises.forEach((we: any) => {
                            if (we.exercise?.movementPattern) {
                                const mp = we.exercise.movementPattern
                                const customColor = mp.movementPatternColors?.find(
                                    (c: any) => c.trainerId === trainerId
                                )?.color
                                movementPatterns.push({
                                    id: mp.id,
                                    name: mp.name,
                                    color: customColor || PRIMARY_COLOR,
                                })
                            }
                        })

                        return {
                            id: workout.id,
                            dayOfWeek: workout.dayOfWeek,
                            order: workout.order,
                            exerciseCount: workoutExercises.length,
                            movementPatterns,
                            workoutExercises: workoutExercises.map((we: any) => ({
                                id: we.id,
                                sets: we.sets,
                                isWarmup: we.isWarmup,
                                exercise: {
                                    id: we.exercise.id,
                                    name: we.exercise.name,
                                    exerciseMuscleGroups: we.exercise.exerciseMuscleGroups || [],
                                },
                            })),
                        }
                    }),
                })),
            }

            setProgram(transformedProgram)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('editProgram.errorLoading'))
        } finally {
            setLoading(false)
            loadingRef.current = false
        }
    }

    const handleWeekTypeChange = async (weekId: string, newType: 'normal' | 'test' | 'deload') => {
        if (!program) return

        try {
            setSaving(true)

            const res = await fetch(`/api/weeks/${weekId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ weekType: newType }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('editProgram.errorEditWeek'), t))
            }

            await fetchProgram()
        } catch (err: unknown) {
            showToast(err instanceof Error ? err.message : t('editProgram.errorEditWeek'), 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleCopyFirstWeekWorkouts = async () => {
        try {
            setCopyingFirstWeek(true)

            const res = await fetch(`/api/programs/${programId}/copy-first-week`, {
                method: 'POST',
            })
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('editProgram.copyFirstWeekError'), t))
            }

            await fetchProgram()
            showToast(t('editProgram.copyFirstWeekSuccess'), 'success')
            setConfirmCopyOpen(false)
        } catch (err: unknown) {
            showToast(
                err instanceof Error ? err.message : t('editProgram.copyFirstWeekError'),
                'error'
            )
        } finally {
            setCopyingFirstWeek(false)
        }
    }

    const getTotalExercises = () => {
        if (!program) return 0
        return program.weeks.reduce(
            (total, week) =>
                total + week.workouts.reduce((sum, w) => sum + w.exerciseCount, 0),
            0
        )
    }

    const getCompletedWorkouts = () => {
        if (!program) return 0
        return program.weeks.reduce(
            (total, week) => total + week.workouts.filter((w) => w.exerciseCount > 0).length,
            0
        )
    }

    const totalWorkouts = program ? program.durationWeeks * program.workoutsPerWeek : 0
    const completedWorkouts = getCompletedWorkouts()
    const progressPercent = totalWorkouts > 0 ? Math.round((completedWorkouts / totalWorkouts) * 100) : 0

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <LoadingSpinner size="lg" color="primary" />
            </div>
        )
    }

    if (error || !program) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg">
                    {error || t('editProgram.notFound')}
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Progress Indicator - Only in Edit Mode */}
                {!readOnly && (
                    <div className="mb-8">
                        <div className="flex items-center justify-center space-x-4 mb-4">
                            <div className="flex items-center">
                                <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">
                                    ✓
                                </div>
                                <span className="ml-2 font-semibold text-gray-900">{t('editProgram.stepSetup')}</span>
                            </div>
                            <div className="w-16 h-1 bg-[#FFA700]"></div>
                            <div className="flex items-center">
                                <div className="w-10 h-10 bg-[#FFA700] text-white rounded-full flex items-center justify-center font-bold">
                                    2
                                </div>
                                <span className="ml-2 font-semibold text-gray-900">{t('editProgram.stepExercises')}</span>
                            </div>
                            <div className="w-16 h-1 bg-gray-300"></div>
                            <div className="flex items-center">
                                <div className="w-10 h-10 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center font-bold">
                                    3
                                </div>
                                <span className="ml-2 text-gray-500">{t('editProgram.stepReview')}</span>
                            </div>
                            <div className="w-16 h-1 bg-gray-300"></div>
                            <div className="flex items-center">
                                <div className="w-10 h-10 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center font-bold">
                                    4
                                </div>
                                <span className="ml-2 text-gray-500">{t('editProgram.stepPublish')}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/trainer/programs"
                        className="text-brand-primary hover:text-brand-primary/80 text-sm font-semibold mb-4 inline-flex items-center gap-1"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {t('editProgram.backToPrograms')}
                    </Link>
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">{program.title}</h1>
                            <p className="text-gray-600 mt-2">
                                {t('editProgram.forTrainee', { name: `${program.trainee.firstName} ${program.trainee.lastName}` })} •{' '}
                                {t('editProgram.programMeta', { duration: program.durationWeeks, perWeek: program.workoutsPerWeek })}
                            </p>
                        </div>
                        <div>
                            {readOnly && program.status === 'draft' && (
                                <Link
                                    href={`/trainer/programs/${programId}/edit`}
                                    className="bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold py-2 px-4 rounded-lg transition-colors inline-flex items-center gap-2"
                                >
                                    <FileEdit className="w-4 h-4" />
                                    {t('editProgram.editProgram', 'Modifica Programma')}
                                </Link>
                            )}
                            {!readOnly && (
                                <EditProgramMetadata
                                    programId={programId}
                                    initialTitle={program.title}
                                    initialTraineeId={program.trainee.id}
                                    initialDurationWeeks={program.durationWeeks}
                                    initialWorkoutsPerWeek={program.workoutsPerWeek}
                                    status={program.status}
                                    onUpdate={fetchProgram}
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Progress Card */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-sm font-semibold text-gray-700">
                                {t('editProgram.progressTitle')}
                            </p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">
                                {t('editProgram.workoutsConfigured', { completed: completedWorkouts, total: totalWorkouts })}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-3xl font-bold text-[#FFA700]">{progressPercent}%</p>
                            <p className="text-sm text-gray-600">{t('editProgram.completion')}</p>
                        </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                            className="bg-[#FFA700] h-3 rounded-full transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                    <p className="text-sm text-gray-600 mt-4">
                        {t('editProgram.totalExercises')} <span className="font-semibold">{getTotalExercises()}</span>
                    </p>
                </div>

                {/* Weeks Overview */}
                <div className="space-y-6">
                    {program.weeks.map((week) => (
                        <div key={week.id} className="bg-white rounded-lg shadow-md p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-4">
                                    <h3 className="text-xl font-bold text-gray-900">
                                        {t('editProgram.week')} {week.weekNumber}
                                    </h3>
                                    {!readOnly && week.weekNumber === 1 && program.weeks.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => setConfirmCopyOpen(true)}
                                            disabled={copyingFirstWeek || saving}
                                            className="inline-flex items-center gap-2 rounded-lg border border-brand-primary/20 bg-brand-primary/10 px-3 py-2 text-sm font-semibold text-brand-primary transition-colors hover:bg-brand-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {copyingFirstWeek ? (
                                                <LoadingSpinner size="sm" color="primary" />
                                            ) : (
                                                <Copy className="h-4 w-4" />
                                            )}
                                            {t('editProgram.copyFirstWeekButton')}
                                        </button>
                                    )}
                                    {readOnly ? (
                                        <div className="flex items-center gap-2">
                                            <WeekTypeBadge weekType={week.weekType} />
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleWeekTypeChange(week.id, 'normal')}
                                                disabled={saving}
                                                className={`px-3 py-1 text-xs font-semibold rounded-full border-2 transition-all flex items-center gap-1.5 ${week.weekType === 'normal'
                                                    ? 'bg-gray-500 text-white border-gray-500'
                                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                                    }`}
                                            >
                                                <ClipboardList className="w-3.5 h-3.5" />
                                                Standard
                                            </button>
                                            <button
                                                onClick={() => handleWeekTypeChange(week.id, 'test')}
                                                disabled={saving}
                                                className={`px-3 py-1 text-xs font-semibold rounded-full border-2 transition-all flex items-center gap-1.5 ${week.weekType === 'test'
                                                    ? 'bg-week-test text-white border-week-test'
                                                    : 'bg-white text-week-test-dark border-week-test hover:bg-week-test-light'
                                                    }`}
                                            >
                                                <Flame className="w-3.5 h-3.5" />
                                                Test
                                            </button>
                                            <button
                                                onClick={() => handleWeekTypeChange(week.id, 'deload')}
                                                disabled={saving}
                                                className={`px-3 py-1 text-xs font-semibold rounded-full border-2 transition-all flex items-center gap-1.5 ${week.weekType === 'deload'
                                                    ? 'bg-week-deload text-white border-week-deload'
                                                    : 'bg-white text-week-deload-dark border-week-deload hover:bg-week-deload-light'
                                                    }`}
                                            >
                                                <Wind className="w-3.5 h-3.5" />
                                                Scarico
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <p className="text-sm text-gray-600">
                                    {t('editProgram.workoutsConfiguredShort', { done: week.workouts.filter((w) => w.exerciseCount > 0).length, total: week.workouts.length })}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {week.workouts.map((workout) => {
                                    const workoutCard = (
                                        <div
                                            className={`border-2 rounded-lg p-4 transition-all ${workout.exerciseCount > 0
                                                ? 'border-green-300 bg-green-50'
                                                : 'border-gray-300 bg-white'
                                                } ${!readOnly ? 'hover:shadow-md hover:border-green-400' : ''}`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="font-semibold text-gray-900">
                                                    {(t('editProgram.dayNames', { returnObjects: true }) as string[])[workout.dayOfWeek]}
                                                </p>
                                                {workout.exerciseCount > 0 ? (
                                                    <span className="text-green-600 text-sm font-semibold">
                                                        ✓
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 text-sm">⚠️</span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-600 mb-2">
                                                {workout.exerciseCount > 0
                                                    ? t('editProgram.exercisesCount', { count: workout.exerciseCount })
                                                    : t('editProgram.noExercises')}
                                            </p>
                                            {workout.movementPatterns.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mb-2">
                                                    {workout.movementPatterns.map((mp, idx) => (
                                                        <MovementPatternTag
                                                            key={`${mp.id}-${idx}`}
                                                            name={mp.name}
                                                            color={mp.color}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                            {!readOnly && (
                                                <p className="text-xs text-[#FFA700] font-semibold mt-2">
                                                    {workout.exerciseCount > 0
                                                        ? t('editProgram.edit')
                                                        : t('editProgram.configure')}
                                                </p>
                                            )}
                                        </div>
                                    )

                                    return readOnly ? (
                                        <div key={workout.id}>
                                            {workoutCard}
                                        </div>
                                    ) : (
                                        <Link
                                            key={workout.id}
                                            href={`/trainer/programs/${programId}/workouts/${workout.id}`}
                                        >
                                            {workoutCard}
                                        </Link>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <ProgramMuscleGroupCharts weeks={program.weeks} />

                {/* Action Buttons - Only in Edit Mode */}
                {!readOnly && (
                    <div className="flex space-x-4 mt-8">
                        <Link
                            href={`/trainer/programs/${programId}/review`}
                            className={`flex-1 py-3 px-6 rounded-lg font-semibold text-center transition-colors ${completedWorkouts === totalWorkouts
                                ? 'bg-[#FFA700] hover:bg-[#FF9500] text-white'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                            onClick={(e) => {
                                if (completedWorkouts < totalWorkouts) {
                                    e.preventDefault()
                                    showToast(t('editProgram.configureAllFirst'), 'warning')
                                }
                            }}
                        >
                            {t('editProgram.nextReview')}
                        </Link>
                        <Link
                            href="/trainer/programs"
                            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
                        >
                            {t('editProgram.saveDraft')}
                        </Link>
                    </div>
                )}

                <ConfirmationModal
                    isOpen={confirmCopyOpen}
                    onClose={() => {
                        if (!copyingFirstWeek) {
                            setConfirmCopyOpen(false)
                        }
                    }}
                    onConfirm={handleCopyFirstWeekWorkouts}
                    title={t('editProgram.copyFirstWeekTitle')}
                    message={t('editProgram.copyFirstWeekMessage')}
                    confirmText={t('editProgram.copyFirstWeekConfirm')}
                    variant="warning"
                    isLoading={copyingFirstWeek}
                />
            </div>
        </div>
    )
}
