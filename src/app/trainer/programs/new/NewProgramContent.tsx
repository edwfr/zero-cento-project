'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import LoadingSpinner from '@/components/LoadingSpinner'
import { BarChart3 } from 'lucide-react'

interface Trainee {
    id: string
    firstName: string
    lastName: string
}

export default function NewProgramContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [loading, setLoading] = useState(false)
    const [trainees, setTrainees] = useState<Trainee[]>([])
    const [error, setError] = useState<string | null>(null)

    // Form state
    const [title, setTitle] = useState('')
    const [traineeId, setTraineeId] = useState('')
    const [isSbdProgram, setIsSbdProgram] = useState(false)
    const [durationWeeks, setDurationWeeks] = useState(4)
    const [workoutsPerWeek, setWorkoutsPerWeek] = useState(3)

    useEffect(() => {
        fetchTrainees()
    }, [])

    const fetchTrainees = async () => {
        try {
            const res = await fetch('/api/users?role=trainee')
            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error?.message || 'Errore caricamento atleti')
            }

            const activeTrainees = data.data.items.filter((t: any) => t.isActive)
            setTrainees(activeTrainees)

            // Check if traineeId is provided in URL params
            const urlTraineeId = searchParams.get('traineeId')
            if (urlTraineeId && activeTrainees.some((t: Trainee) => t.id === urlTraineeId)) {
                setTraineeId(urlTraineeId)
            } else if (activeTrainees.length > 0) {
                setTraineeId(activeTrainees[0].id)
            }
        } catch (err: any) {
            setError(err.message)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        // Validation
        if (!title.trim()) {
            setError('Il nome del programma è obbligatorio')
            return
        }

        if (!traineeId) {
            setError('Seleziona un atleta')
            return
        }

        if (durationWeeks < 1 || durationWeeks > 52) {
            setError('La durata deve essere tra 1 e 52 settimane')
            return
        }

        if (workoutsPerWeek < 1 || workoutsPerWeek > 7) {
            setError('Gli allenamenti settimanali devono essere tra 1 e 7')
            return
        }

        try {
            setLoading(true)

            const res = await fetch('/api/programs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    traineeId,
                    isSbdProgram,
                    durationWeeks,
                    workoutsPerWeek,
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error?.message || 'Errore creazione programma')
            }

            // Redirect to program detail/edit
            router.push(`/trainer/programs/${data.data.program.id}/edit`)
        } catch (err: any) {
            setError(err.message)
            setLoading(false)
        }
    }

    if (trainees.length === 0 && !error) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="bg-white rounded-lg shadow-md p-8 max-w-md text-center">
                    <div className="text-5xl mb-4">👥</div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        Nessun Atleta Disponibile
                    </h2>
                    <p className="text-gray-600 mb-6">
                        Devi avere almeno un atleta attivo per creare un programma
                    </p>
                    <Link
                        href="/trainer/trainees/new"
                        className="inline-block bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold px-6 py-3 rounded-lg transition-colors"
                    >
                        Aggiungi Atleta
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-3xl mx-auto">
            {/* Progress Indicator */}
            <div className="mb-8">
                <div className="flex items-center justify-center space-x-4 mb-4">
                    <div className="flex items-center">
                        <div className="w-10 h-10 bg-[#FFA700] text-white rounded-full flex items-center justify-center font-bold">
                            1
                        </div>
                        <span className="ml-2 font-semibold text-gray-900">Setup</span>
                    </div>
                    <div className="w-16 h-1 bg-gray-300"></div>
                    <div className="flex items-center">
                        <div className="w-10 h-10 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center font-bold">
                            2
                        </div>
                        <span className="ml-2 text-gray-500">Esercizi</span>
                    </div>
                    <div className="w-16 h-1 bg-gray-300"></div>
                    <div className="flex items-center">
                        <div className="w-10 h-10 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center font-bold">
                            3
                        </div>
                        <span className="ml-2 text-gray-500">Revisione</span>
                    </div>
                    <div className="w-16 h-1 bg-gray-300"></div>
                    <div className="flex items-center">
                        <div className="w-10 h-10 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center font-bold">
                            4
                        </div>
                        <span className="ml-2 text-gray-500">Pubblica</span>
                    </div>
                </div>
            </div>

            {/* Header */}
            <div className="mb-8">
                <Link
                    href="/trainer/programs"
                    className="text-brand-primary hover:text-brand-primary/80 text-sm font-semibold mb-4 inline-block"
                >
                    ← Torna ai programmi
                </Link>
                <h1 className="text-3xl font-bold text-gray-900">Nuovo Programma - Setup</h1>
                <p className="text-gray-600 mt-2">
                    Configura le informazioni base del programma di allenamento
                </p>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
                    {error}
                </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
                {/* Program Title */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Nome Programma *
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={loading}
                        placeholder="es. Programma Forza Base 8 Settimane"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                        required
                    />
                </div>

                {/* Trainee Selection */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Atleta *
                    </label>
                    <select
                        value={traineeId}
                        onChange={(e) => setTraineeId(e.target.value)}
                        disabled={loading}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                        required
                    >
                        {trainees.map((trainee) => (
                            <option key={trainee.id} value={trainee.id}>
                                {trainee.firstName} {trainee.lastName}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-4">
                    <label className="flex items-start gap-3">
                        <input
                            type="checkbox"
                            checked={isSbdProgram}
                            onChange={(e) => setIsSbdProgram(e.target.checked)}
                            disabled={loading}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-[#FFA700] focus:ring-[#FFA700]"
                        />
                        <span>
                            <span className="block text-sm font-semibold text-gray-900">Programma SBD</span>
                            <span className="block text-sm text-gray-600">
                                Abilita la reportistica SBD nelle schermate del programma e dei workout.
                            </span>
                        </span>
                    </label>
                </div>

                {/* Duration Weeks */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Durata (settimane) *
                    </label>
                    <div className="flex items-center space-x-4">
                        <input
                            type="number"
                            min="1"
                            max="52"
                            value={durationWeeks}
                            onChange={(e) => setDurationWeeks(parseInt(e.target.value))}
                            disabled={loading}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                            required
                        />
                        <div className="flex space-x-2">
                            {[3, 4, 5, 6].map((weeks) => (
                                <button
                                    key={weeks}
                                    type="button"
                                    onClick={() => setDurationWeeks(weeks)}
                                    disabled={loading}
                                    className={`px-3 py-1 text-sm font-semibold rounded ${durationWeeks === weeks
                                        ? 'bg-[#FFA700] text-white'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {weeks}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Workouts Per Week */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Allenamenti per settimana *
                    </label>
                    <div className="flex items-center space-x-4">
                        <input
                            type="number"
                            min="1"
                            max="7"
                            value={workoutsPerWeek}
                            onChange={(e) => setWorkoutsPerWeek(parseInt(e.target.value))}
                            disabled={loading}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                            required
                        />
                        <div className="flex space-x-2">
                            {[2, 3, 4].map((workouts) => (
                                <button
                                    key={workouts}
                                    type="button"
                                    onClick={() => setWorkoutsPerWeek(workouts)}
                                    disabled={loading}
                                    className={`px-3 py-1 text-sm font-semibold rounded ${workoutsPerWeek === workouts
                                        ? 'bg-[#FFA700] text-white'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {workouts}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Summary */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="mb-2 flex items-center gap-2 text-blue-900">
                        <BarChart3 className="h-4 w-4" />
                        <p className="text-sm font-semibold">Riepilogo</p>
                    </div>
                    <p className="text-sm text-blue-700">
                        Verranno create{' '}
                        <span className="font-semibold">{durationWeeks} settimane</span> con{' '}
                        <span className="font-semibold">
                            {workoutsPerWeek} allenamenti per settimana
                        </span>
                        , per un totale di{' '}
                        <span className="font-semibold">
                            {durationWeeks * workoutsPerWeek} workout
                        </span>{' '}
                        da configurare.
                    </p>
                </div>

                {/* Actions */}
                <div className="flex space-x-4 pt-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 bg-[#FFA700] hover:bg-[#FF9500] disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
                    >
                        {loading ? (
                            <LoadingSpinner size="sm" color="white" />
                        ) : (
                            'Avanti: Configura Esercizi →'
                        )}
                    </button>
                    <Link
                        href="/trainer/programs"
                        className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg text-center transition-colors"
                    >
                        Annulla
                    </Link>
                </div>
            </form>
        </div>
    )
}
