'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import LoadingSpinner from '@/components/LoadingSpinner'

interface Exercise {
    id: string
    name: string
    type: 'fundamental' | 'accessory'
}

interface WorkoutExercise {
    id: string
    order: number
    sets: number
    repsMin: number
    repsMax: number
    restSeconds: number
    targetRPE: number
    notes: string | null
    exercise: Exercise
}

interface Workout {
    id: string
    dayOfWeek: number
    order: number
    workoutExercises: WorkoutExercise[]
}

interface Program {
    id: string
    title: string
    trainee: {
        firstName: string
        lastName: string
    }
}

const DAY_NAMES = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']

export default function WorkoutDetailPage() {
    const router = useRouter()
    const params = useParams()
    const programId = params.id as string
    const workoutId = params.wId as string

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [program, setProgram] = useState<Program | null>(null)
    const [workout, setWorkout] = useState<Workout | null>(null)
    const [exercises, setExercises] = useState<Exercise[]>([])
    const [error, setError] = useState<string | null>(null)

    // Add exercise form
    const [showAddForm, setShowAddForm] = useState(false)
    const [selectedExerciseId, setSelectedExerciseId] = useState('')
    const [sets, setSets] = useState(3)
    const [repsMin, setRepsMin] = useState(8)
    const [repsMax, setRepsMax] = useState(10)
    const [restSeconds, setRestSeconds] = useState(120)
    const [targetRPE, setTargetRPE] = useState(7)
    const [notes, setNotes] = useState('')

    useEffect(() => {
        fetchData()
    }, [workoutId])

    const fetchData = async () => {
        try {
            setLoading(true)

            const [programRes, workoutRes, exercisesRes] = await Promise.all([
                fetch(`/api/programs/${programId}`),
                fetch(`/api/workouts/${workoutId}`),
                fetch('/api/exercises'),
            ])

            const [programData, workoutData, exercisesData] = await Promise.all([
                programRes.json(),
                workoutRes.json(),
                exercisesRes.json(),
            ])

            if (!programRes.ok || !workoutRes.ok || !exercisesRes.ok) {
                throw new Error('Errore caricamento dati')
            }

            setProgram(programData.data.program)
            setWorkout(workoutData.data.workout)
            setExercises(exercisesData.data.exercises)

            if (exercisesData.data.exercises.length > 0) {
                setSelectedExerciseId(exercisesData.data.exercises[0].id)
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleAddExercise = async () => {
        if (!workout || !selectedExerciseId) return

        try {
            setSaving(true)

            const res = await fetch(`/api/workouts/${workoutId}/exercises`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    exerciseId: selectedExerciseId,
                    order: workout.workoutExercises.length + 1,
                    sets,
                    repsMin,
                    repsMax,
                    restSeconds,
                    targetRPE,
                    notes: notes.trim() || null,
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error?.message || 'Errore aggiunta esercizio')
            }

            // Refresh workout
            await fetchData()

            // Reset form
            setShowAddForm(false)
            setSets(3)
            setRepsMin(8)
            setRepsMax(10)
            setRestSeconds(120)
            setTargetRPE(7)
            setNotes('')
        } catch (err: any) {
            alert(err.message)
        } finally {
            setSaving(false)
        }
    }

    const handleDeleteExercise = async (workoutExerciseId: string) => {
        if (!confirm('Rimuovere questo esercizio dal workout?')) return

        try {
            const res = await fetch(`/api/workouts/${workoutId}/exercises/${workoutExerciseId}`, {
                method: 'DELETE',
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error?.message || 'Errore rimozione esercizio')
            }

            await fetchData()
        } catch (err: any) {
            alert(err.message)
        }
    }

    const handleMoveExercise = async (workoutExerciseId: string, direction: 'up' | 'down') => {
        if (!workout) return

        const exercises = [...workout.workoutExercises].sort((a, b) => a.order - b.order)
        const index = exercises.findIndex((e) => e.id === workoutExerciseId)

        if (
            (direction === 'up' && index === 0) ||
            (direction === 'down' && index === exercises.length - 1)
        ) {
            return
        }

        const newIndex = direction === 'up' ? index - 1 : index + 1

        // Swap orders
        const temp = exercises[index].order
        exercises[index].order = exercises[newIndex].order
        exercises[newIndex].order = temp

        try {
            // Update both exercises
            await Promise.all([
                fetch(`/api/workouts/${workoutId}/exercises/${exercises[index].id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order: exercises[index].order }),
                }),
                fetch(`/api/workouts/${workoutId}/exercises/${exercises[newIndex].id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order: exercises[newIndex].order }),
                }),
            ])

            await fetchData()
        } catch (err: any) {
            alert(err.message)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <LoadingSpinner size="lg" color="primary" />
            </div>
        )
    }

    if (error || !workout || !program) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg">
                    {error || 'Workout non trovato'}
                </div>
            </div>
        )
    }

    const sortedExercises = [...workout.workoutExercises].sort((a, b) => a.order - b.order)

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href={`/trainer/programs/${programId}/edit`}
                        className="text-brand-primary hover:text-brand-primary/80 text-sm font-semibold mb-4 inline-block"
                    >
                        ← Torna alla panoramica settimane
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900">
                        {DAY_NAMES[workout.dayOfWeek]} - {program.title}
                    </h1>
                    <p className="text-gray-600 mt-2">
                        per {program.trainee.firstName} {program.trainee.lastName}
                    </p>
                </div>

                {/* Exercises List */}
                {sortedExercises.length > 0 ? (
                    <div className="space-y-4 mb-6">
                        {sortedExercises.map((we, index) => (
                            <div key={we.id} className="bg-white rounded-lg shadow-md p-6">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3 mb-2">
                                            <span className="text-2xl font-bold text-gray-400">
                                                {index + 1}
                                            </span>
                                            <h3 className="text-xl font-bold text-gray-900">
                                                {we.exercise.name}
                                            </h3>
                                            <span
                                                className={`px-2 py-1 text-xs font-semibold rounded ${we.exercise.type === 'fundamental'
                                                    ? 'bg-purple-100 text-purple-800'
                                                    : 'bg-gray-100 text-gray-800'
                                                    }`}
                                            >
                                                {we.exercise.type === 'fundamental'
                                                    ? 'Fondamentale'
                                                    : 'Accessorio'}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                                            <div>
                                                <p className="text-xs text-gray-600 mb-1">Serie</p>
                                                <p className="text-lg font-semibold text-gray-900">
                                                    {we.sets}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-600 mb-1">
                                                    Ripetizioni
                                                </p>
                                                <p className="text-lg font-semibold text-gray-900">
                                                    {we.repsMin === we.repsMax
                                                        ? we.repsMin
                                                        : `${we.repsMin}-${we.repsMax}`}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-600 mb-1">Riposo</p>
                                                <p className="text-lg font-semibold text-gray-900">
                                                    {Math.floor(we.restSeconds / 60)}:
                                                    {(we.restSeconds % 60)
                                                        .toString()
                                                        .padStart(2, '0')}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-600 mb-1">RPE</p>
                                                <p className="text-lg font-semibold text-gray-900">
                                                    {we.targetRPE}
                                                </p>
                                            </div>
                                        </div>

                                        {we.notes && (
                                            <p className="text-sm text-gray-600 mt-3 italic">
                                                📝 {we.notes}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex flex-col space-y-2 ml-4">
                                        <button
                                            onClick={() => handleMoveExercise(we.id, 'up')}
                                            disabled={index === 0}
                                            className="p-2 text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
                                        >
                                            ▲
                                        </button>
                                        <button
                                            onClick={() => handleMoveExercise(we.id, 'down')}
                                            disabled={index === sortedExercises.length - 1}
                                            className="p-2 text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
                                        >
                                            ▼
                                        </button>
                                        <button
                                            onClick={() => handleDeleteExercise(we.id)}
                                            className="p-2 text-red-600 hover:text-red-800"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow-md p-12 text-center mb-6">
                        <div className="text-5xl mb-4">💪</div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                            Nessun Esercizio Configurato
                        </h3>
                        <p className="text-gray-600">
                            Inizia ad aggiungere esercizi a questo workout
                        </p>
                    </div>
                )}

                {/* Add Exercise Button */}
                {!showAddForm && (
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="w-full bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold py-4 px-6 rounded-lg transition-colors mb-6"
                    >
                        + Aggiungi Esercizio
                    </button>
                )}

                {/* Add Exercise Form */}
                {showAddForm && (
                    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">
                            Aggiungi Esercizio
                        </h3>

                        <div className="space-y-4">
                            {/* Exercise Selection */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Esercizio *
                                </label>
                                <select
                                    value={selectedExerciseId}
                                    onChange={(e) => setSelectedExerciseId(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                                >
                                    {exercises.map((ex) => (
                                        <option key={ex.id} value={ex.id}>
                                            {ex.name} ({ex.type === 'fundamental' ? 'Fondamentale' : 'Accessorio'})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Sets */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Serie *
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={sets}
                                        onChange={(e) => setSets(parseInt(e.target.value))}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                                    />
                                </div>

                                {/* Reps Min */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Reps Min *
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="50"
                                        value={repsMin}
                                        onChange={(e) => setRepsMin(parseInt(e.target.value))}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                                    />
                                </div>

                                {/* Reps Max */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Reps Max *
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="50"
                                        value={repsMax}
                                        onChange={(e) => setRepsMax(parseInt(e.target.value))}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                                    />
                                </div>

                                {/* Rest */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Riposo (sec) *
                                    </label>
                                    <input
                                        type="number"
                                        min="30"
                                        max="600"
                                        step="30"
                                        value={restSeconds}
                                        onChange={(e) => setRestSeconds(parseInt(e.target.value))}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                                    />
                                </div>
                            </div>

                            {/* RPE */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    RPE Target *
                                </label>
                                <div className="flex space-x-2">
                                    {[6, 7, 8, 9, 10].map((rpe) => (
                                        <button
                                            key={rpe}
                                            type="button"
                                            onClick={() => setTargetRPE(rpe)}
                                            className={`flex-1 py-2 text-sm font-semibold rounded transition-colors ${targetRPE === rpe
                                                ? 'bg-[#FFA700] text-white'
                                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                }`}
                                        >
                                            {rpe}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Note (opzionali)
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="es. Pausa di 2 secondi al petto"
                                    rows={3}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex space-x-4">
                                <button
                                    onClick={handleAddExercise}
                                    disabled={saving}
                                    className="flex-1 bg-[#FFA700] hover:bg-[#FF9500] disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
                                >
                                    {saving ? <LoadingSpinner size="sm" color="white" /> : 'Aggiungi'}
                                </button>
                                <button
                                    onClick={() => setShowAddForm(false)}
                                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
                                >
                                    Annulla
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Bottom Actions */}
                <div className="flex space-x-4">
                    <Link
                        href={`/trainer/programs/${programId}/edit`}
                        className="flex-1 bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold py-3 px-6 rounded-lg text-center transition-colors"
                    >
                        Torna alla Panoramica
                    </Link>
                </div>
            </div>
        </div>
    )
}
