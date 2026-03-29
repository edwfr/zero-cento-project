'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import LoadingSpinner from '@/components/LoadingSpinner'
import { useToast } from '@/components/ToastNotification'
import ConfirmationModal from '@/components/ConfirmationModal'

interface WorkoutSummary {
    id: string
    dayOfWeek: number
    exerciseCount: number
}

interface WeekSummary {
    weekNumber: number
    weekType: 'loading' | 'deload'
    workouts: WorkoutSummary[]
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
    startDate: string | null
    weeks: WeekSummary[]
}

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

export default function PublishProgramPage() {
    const router = useRouter()
    const params = useParams()
    const programId = params.id as string

    const [loading, setLoading] = useState(true)
    const [publishing, setPublishing] = useState(false)
    const [program, setProgram] = useState<Program | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [startDate, setStartDate] = useState('')
    const [validationErrors, setValidationErrors] = useState<string[]>([])
    const { showToast } = useToast()
    const [confirmModal, setConfirmModal] = useState<{
        title: string
        message: string
        onConfirm: () => void
        confirmText?: string
        variant?: 'danger' | 'warning' | 'info' | 'success'
    } | null>(null)

    useEffect(() => {
        fetchProgram()

        // Set default start date to next Monday
        const today = new Date()
        const nextMonday = new Date(today)
        const daysUntilMonday = (8 - today.getDay()) % 7 || 7
        nextMonday.setDate(today.getDate() + daysUntilMonday)
        setStartDate(nextMonday.toISOString().split('T')[0])
    }, [programId])

    const fetchProgram = async () => {
        try {
            setLoading(true)
            const res = await fetch(`/api/programs/${programId}`)
            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error?.message || 'Errore caricamento programma')
            }

            setProgram(data.data.program)
            validateProgram(data.data.program)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const validateProgram = (prog: Program) => {
        const errors: string[] = []

        // Check all workouts have exercises
        const totalWorkouts = prog.durationWeeks * prog.workoutsPerWeek
        const configuredWorkouts = prog.weeks.reduce(
            (sum, week) => sum + week.workouts.filter((w) => w.exerciseCount > 0).length,
            0
        )

        if (configuredWorkouts < totalWorkouts) {
            errors.push(
                `${totalWorkouts - configuredWorkouts} workout non hanno esercizi configurati`
            )
        }

        // Check at least one fundamental exercise per week
        prog.weeks.forEach((week) => {
            const weekHasExercises = week.workouts.some((w) => w.exerciseCount > 0)
            if (!weekHasExercises) {
                errors.push(`La settimana ${week.weekNumber} non ha alcun esercizio`)
            }
        })

        setValidationErrors(errors)
    }

    const doPublish = async () => {
        setConfirmModal(null)
        try {
            setPublishing(true)

            const res = await fetch(`/api/programs/${programId}/publish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ startDate }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error?.message || 'Errore pubblicazione programma')
            }

            showToast('Programma pubblicato con successo!', 'success')
            router.push('/trainer/programs')
        } catch (err: any) {
            showToast(err.message, 'error')
            setPublishing(false)
        }
    }

    const handlePublish = () => {
        if (!program || validationErrors.length > 0) return

        if (!startDate) {
            showToast('Seleziona una data di inizio', 'error')
            return
        }

        const selectedDate = new Date(startDate)
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        if (selectedDate < today) {
            showToast('La data di inizio non può essere nel passato', 'error')
            return
        }

        setConfirmModal({
            title: 'Pubblica Programma',
            message: "Pubblicare questo programma? L'atleta potrà iniziare ad allenarsi.",
            confirmText: 'Pubblica',
            variant: 'info',
            onConfirm: doPublish,
        })
    }

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
                    {error || 'Programma non trovato'}
                </div>
            </div>
        )
    }

    const totalWorkouts = program.durationWeeks * program.workoutsPerWeek
    const configuredWorkouts = program.weeks.reduce(
        (sum, week) => sum + week.workouts.filter((w) => w.exerciseCount > 0).length,
        0
    )
    const totalExercises = program.weeks.reduce(
        (sum, week) => sum + week.workouts.reduce((s, w) => s + w.exerciseCount, 0),
        0
    )

    const canPublish = validationErrors.length === 0 && program.status === 'draft'

    return (
        <div className="min-h-screen bg-gray-50">
            {confirmModal && (
                <ConfirmationModal
                    isOpen={true}
                    onClose={() => setConfirmModal(null)}
                    onConfirm={confirmModal.onConfirm}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    confirmText={confirmModal.confirmText ?? 'Conferma'}
                    variant={confirmModal.variant ?? 'danger'}
                />
            )}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Progress Indicator */}
                <div className="mb-8">
                    <div className="flex items-center justify-center space-x-4 mb-4">
                        <div className="flex items-center">
                            <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">
                                ✓
                            </div>
                            <span className="ml-2 font-semibold text-gray-900">Setup</span>
                        </div>
                        <div className="w-16 h-1 bg-green-500"></div>
                        <div className="flex items-center">
                            <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">
                                ✓
                            </div>
                            <span className="ml-2 font-semibold text-gray-900">Esercizi</span>
                        </div>
                        <div className="w-16 h-1 bg-[#FFA700]"></div>
                        <div className="flex items-center">
                            <div className="w-10 h-10 bg-[#FFA700] text-white rounded-full flex items-center justify-center font-bold">
                                3
                            </div>
                            <span className="ml-2 font-semibold text-gray-900">Pubblica</span>
                        </div>
                    </div>
                </div>

                {/* Header */}
                <div className="mb-8">
                    <Link
                        href={`/trainer/programs/${programId}/edit`}
                        className="text-brand-primary hover:text-brand-primary/80 text-sm font-semibold mb-4 inline-block"
                    >
                        ← Torna alla modifica
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900">Pubblica Programma</h1>
                    <p className="text-gray-600 mt-2">
                        Rivedi il riepilogo e pubblica il programma per attivarlo
                    </p>
                </div>

                {/* Validation Errors */}
                {validationErrors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
                        <h3 className="text-lg font-bold text-red-900 mb-3">
                            ⚠️ Attenzione: Problemi da Risolvere
                        </h3>
                        <ul className="list-disc list-inside space-y-1">
                            {validationErrors.map((err, idx) => (
                                <li key={idx} className="text-red-800">
                                    {err}
                                </li>
                            ))}
                        </ul>
                        <Link
                            href={`/trainer/programs/${programId}/edit`}
                            className="inline-block mt-4 bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
                        >
                            Torna alla Modifica
                        </Link>
                    </div>
                )}

                {/* Program Summary */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">{program.title}</h2>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                        <div>
                            <p className="text-sm text-gray-600 mb-1">Atleta</p>
                            <p className="text-lg font-semibold text-gray-900">
                                {program.trainee.firstName} {program.trainee.lastName}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 mb-1">Durata</p>
                            <p className="text-lg font-semibold text-gray-900">
                                {program.durationWeeks} settimane
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 mb-1">Workout</p>
                            <p className="text-lg font-semibold text-gray-900">
                                {configuredWorkouts} / {totalWorkouts}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 mb-1">Esercizi</p>
                            <p className="text-lg font-semibold text-gray-900">{totalExercises}</p>
                        </div>
                    </div>

                    {/* Week Overview */}
                    <div className="border-t border-gray-200 pt-4">
                        <h3 className="text-lg font-bold text-gray-900 mb-3">
                            Riepilogo Settimane
                        </h3>
                        <div className="space-y-2">
                            {program.weeks.map((week) => (
                                <div
                                    key={week.weekNumber}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                >
                                    <div className="flex items-center space-x-3">
                                        <span className="font-semibold text-gray-900">
                                            Settimana {week.weekNumber}
                                        </span>
                                        <span
                                            className={`px-2 py-1 text-xs font-semibold rounded-full ${week.weekType === 'loading'
                                                ? 'bg-blue-100 text-blue-800'
                                                : 'bg-green-100 text-green-800'
                                                }`}
                                        >
                                            {week.weekType === 'loading' ? 'Loading' : 'Deload'}
                                        </span>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <div className="flex space-x-1">
                                            {week.workouts.map((w) => (
                                                <div
                                                    key={w.id}
                                                    className={`w-8 h-8 rounded flex items-center justify-center text-xs font-semibold ${w.exerciseCount > 0
                                                        ? 'bg-green-500 text-white'
                                                        : 'bg-gray-300 text-gray-600'
                                                        }`}
                                                    title={`${DAY_NAMES[w.dayOfWeek]}: ${w.exerciseCount} esercizi`}
                                                >
                                                    {DAY_NAMES[w.dayOfWeek][0]}
                                                </div>
                                            ))}
                                        </div>
                                        <span className="text-sm text-gray-600">
                                            {week.workouts.filter((w) => w.exerciseCount > 0).length}/
                                            {week.workouts.length}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Start Date Selection */}
                {canPublish && (
                    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">
                            Data di Inizio Programma
                        </h3>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Seleziona la data del primo giorno del programma *
                            </label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                                required
                            />
                            <p className="text-sm text-gray-600 mt-2">
                                💡 Consiglio: inizia il programma di lunedì per allineare le settimane
                            </p>
                        </div>
                    </div>
                )}

                {/* Publish Actions */}
                <div className="flex space-x-4">
                    {canPublish ? (
                        <>
                            <button
                                onClick={handlePublish}
                                disabled={publishing || !startDate}
                                className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-lg transition-colors flex items-center justify-center"
                            >
                                {publishing ? (
                                    <LoadingSpinner size="sm" color="white" />
                                ) : (
                                    '✅ Pubblica Programma'
                                )}
                            </button>
                            <Link
                                href={`/trainer/programs/${programId}/edit`}
                                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-4 px-6 rounded-lg transition-colors"
                            >
                                Annulla
                            </Link>
                        </>
                    ) : (
                        <Link
                            href={`/trainer/programs/${programId}/edit`}
                            className="flex-1 bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold py-4 px-6 rounded-lg text-center transition-colors"
                        >
                            Torna alla Modifica
                        </Link>
                    )}
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                    <p className="text-sm text-blue-900">
                        <span className="font-semibold">ℹ️ Nota:</span> Una volta pubblicato, il
                        programma passerà allo stato <span className="font-semibold">Active</span> e
                        l'atleta potrà vedere e completare i workout. Non potrai più modificare la
                        struttura del programma, ma potrai sempre aggiungere note e monitorare i
                        progressi.
                    </p>
                </div>
            </div>
        </div>
    )
}
