'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import LoadingSpinner from '@/components/LoadingSpinner'
import { useToast } from '@/components/ToastNotification'
import ConfirmationModal from '@/components/ConfirmationModal'
import AutocompleteSearch, { AutocompleteOption } from '@/components/AutocompleteSearch'
import WeightTypeSelector from '@/components/WeightTypeSelector'
import RestTimeSelector from '@/components/RestTimeSelector'
import RepsInput from '@/components/RepsInput'
import { WeightType, RestTime } from '@prisma/client'
import { useTranslation } from 'react-i18next'

interface Exercise {
    id: string
    name: string
    type: 'fundamental' | 'accessory'
}

interface WorkoutExercise {
    id: string
    order: number
    sets: number
    reps: string
    restTime: RestTime
    targetRpe: number | null
    weightType: WeightType
    weight: number | null
    isWarmup: boolean
    notes: string | null
    exercise: Exercise
}

interface Workout {
    id: string
    dayLabel: string
    notes: string | null
    workoutExercises: WorkoutExercise[]
}

interface Program {
    id: string
    title: string
    status: string
    trainee: {
        firstName: string
        lastName: string
    }
}

export default function WorkoutDetailContent() {
    const router = useRouter()
    const params = useParams()
    const programId = params.id as string
    const workoutId = params.wId as string
    const { t } = useTranslation(['trainer', 'common'])

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [program, setProgram] = useState<Program | null>(null)
    const [workout, setWorkout] = useState<Workout | null>(null)
    const [exercises, setExercises] = useState<Exercise[]>([])
    const [error, setError] = useState<string | null>(null)

    // Add/Edit exercise form
    const [showAddForm, setShowAddForm] = useState(false)
    const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null)
    const [selectedExerciseId, setSelectedExerciseId] = useState('')
    const [sets, setSets] = useState(3)
    const [reps, setReps] = useState('8')
    const [restTime, setRestTime] = useState<RestTime>('m2')
    const [targetRpe, setTargetRpe] = useState<number | undefined>(7)
    const [weightType, setWeightType] = useState<WeightType>('absolute')
    const [weight, setWeight] = useState<number | undefined>(undefined)
    const [isWarmup, setIsWarmup] = useState(false)
    const [notes, setNotes] = useState('')
    const { showToast } = useToast()
    const [confirmModal, setConfirmModal] = useState<{
        title: string
        message: string
        onConfirm: () => void
        confirmText?: string
        variant?: 'danger' | 'warning' | 'info' | 'success'
    } | null>(null)

    useEffect(() => {
        fetchData()
    }, [workoutId])

    const fetchData = async () => {
        try {
            setLoading(true)

            const [programRes, exercisesRes] = await Promise.all([
                fetch(`/api/programs/${programId}`),
                fetch('/api/exercises'),
            ])

            const [programData, exercisesData] = await Promise.all([
                programRes.json(),
                exercisesRes.json(),
            ])

            if (!programRes.ok || !exercisesRes.ok) {
                throw new Error(t('common:errors.loadFailed'))
            }

            setProgram(programData.data.program)

            // Extract workout from the nested program structure
            const foundWorkout = programData.data.program.weeks
                .flatMap((w: any) => w.workouts)
                .find((wo: any) => wo.id === workoutId)

            if (!foundWorkout) {
                throw new Error('Workout non trovato')
            }

            setWorkout(foundWorkout)
            setExercises(exercisesData.data.items)

            if (exercisesData.data.items.length > 0) {
                setSelectedExerciseId(exercisesData.data.items[0].id)
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const resetForm = () => {
        setSelectedExerciseId(exercises.length > 0 ? exercises[0].id : '')
        setSets(3)
        setReps('8')
        setRestTime('m2')
        setTargetRpe(7)
        setWeightType('absolute')
        setWeight(undefined)
        setIsWarmup(false)
        setNotes('')
        setEditingExerciseId(null)
    }

    const loadExerciseForEdit = (we: WorkoutExercise) => {
        setEditingExerciseId(we.id)
        setSelectedExerciseId(we.exercise.id)
        setSets(we.sets)
        setReps(we.reps)
        setRestTime(we.restTime)
        setTargetRpe(we.targetRpe ?? undefined)
        setWeightType(we.weightType)
        setWeight(we.weight ?? undefined)
        setIsWarmup(we.isWarmup)
        setNotes(we.notes ?? '')
        setShowAddForm(true)
    }

    const handleSaveExercise = async () => {
        if (!workout || !selectedExerciseId) return

        try {
            setSaving(true)

            const payload = {
                exerciseId: selectedExerciseId,
                order: editingExerciseId
                    ? workout.workoutExercises.find(e => e.id === editingExerciseId)?.order
                    : workout.workoutExercises.length + 1,
                sets,
                reps,
                targetRpe: targetRpe ?? null,
                weightType,
                weight: weight ?? null,
                restTime,
                isWarmup,
                notes: notes.trim() || null,
            }

            let res
            if (editingExerciseId) {
                // Update existing exercise
                res = await fetch(`/api/programs/${programId}/workouts/${workoutId}/exercises/${editingExerciseId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
            } else {
                // Add new exercise
                res = await fetch(`/api/programs/${programId}/workouts/${workoutId}/exercises`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
            }

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error?.message || 'Errore salvataggio esercizio')
            }

            showToast(editingExerciseId ? 'Esercizio aggiornato' : 'Esercizio aggiunto', 'success')

            // Refresh workout
            await fetchData()

            // Reset form
            setShowAddForm(false)
            resetForm()
        } catch (err: any) {
            showToast(err.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleDeleteExercise = (workoutExerciseId: string) => {
        setConfirmModal({
            title: 'Rimuovi Esercizio',
            message: 'Rimuovere questo esercizio dal workout?',
            confirmText: 'Rimuovi',
            variant: 'danger',
            onConfirm: async () => {
                setConfirmModal(null)
                try {
                    const res = await fetch(`/api/programs/${programId}/workouts/${workoutId}/exercises/${workoutExerciseId}`, {
                        method: 'DELETE',
                    })

                    if (!res.ok) {
                        const data = await res.json()
                        throw new Error(data.error?.message || 'Errore rimozione esercizio')
                    }

                    showToast('Esercizio rimosso', 'success')
                    await fetchData()
                } catch (err: any) {
                    showToast(err.message, 'error')
                }
            },
        })
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
                fetch(`/api/programs/${programId}/workouts/${workoutId}/exercises/${exercises[index].id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order: exercises[index].order }),
                }),
                fetch(`/api/programs/${programId}/workouts/${workoutId}/exercises/${exercises[newIndex].id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order: exercises[newIndex].order }),
                }),
            ])

            await fetchData()
        } catch (err: any) {
            showToast(err.message, 'error')
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

    const exerciseOptions: AutocompleteOption[] = exercises.map(ex => ({
        id: ex.id,
        label: ex.name,
        sublabel: ex.type === 'fundamental' ? t('exercises.fundamental') : t('exercises.accessory')
    }))

    const getRestTimeLabel = (rt: RestTime): string => {
        const opts = { s30: '30s', m1: '1m', m2: '2m', m3: '3m', m5: '5m' }
        return opts[rt] || rt
    }

    const getWeightTypeLabel = (wt: WeightType): string => {
        const opts = {
            absolute: 'kg',
            percentage_1rm: '% 1RM',
            percentage_rm: '% nRM',
            percentage_previous: '% Prev'
        }
        return opts[wt] || wt
    }

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
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href={`/trainer/programs/${programId}/edit`}
                        className="text-brand-primary hover:text-brand-primary/80 text-sm font-semibold mb-4 inline-block"
                    >
                        ← {t('workouts.backToWeeks')}
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900">
                        {workout.dayLabel} - {program.title}
                    </h1>
                    <p className="text-gray-600 mt-2">
                        per {program.trainee.firstName} {program.trainee.lastName}
                    </p>
                    {workout.notes && (
                        <p className="text-gray-700 mt-2 italic">📝 {workout.notes}</p>
                    )}
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
                                                    ? t('exercises.fundamental')
                                                    : t('exercises.accessory')}
                                            </span>
                                            {we.isWarmup && (
                                                <span className="px-2 py-1 text-xs font-semibold rounded bg-yellow-100 text-yellow-800">
                                                    🔥 Riscaldamento
                                                </span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-4">
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
                                                    {we.reps}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-600 mb-1">Riposo</p>
                                                <p className="text-lg font-semibold text-gray-900">
                                                    {getRestTimeLabel(we.restTime)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-600 mb-1">RPE</p>
                                                <p className="text-lg font-semibold text-gray-900">
                                                    {we.targetRpe ?? '-'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-600 mb-1">Tipo Peso</p>
                                                <p className="text-lg font-semibold text-gray-900">
                                                    {getWeightTypeLabel(we.weightType)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-600 mb-1">Peso</p>
                                                <p className="text-lg font-semibold text-gray-900">
                                                    {we.weight ? `${we.weight}` : '-'}
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
                                            title="Sposta su"
                                        >
                                            ▲
                                        </button>
                                        <button
                                            onClick={() => handleMoveExercise(we.id, 'down')}
                                            disabled={index === sortedExercises.length - 1}
                                            className="p-2 text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
                                            title="Sposta giù"
                                        >
                                            ▼
                                        </button>
                                        <button
                                            onClick={() => loadExerciseForEdit(we)}
                                            className="p-2 text-blue-600 hover:text-blue-800"
                                            title="Modifica"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => handleDeleteExercise(we.id)}
                                            className="p-2 text-red-600 hover:text-red-800"
                                            title="Elimina"
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
                            {t('workouts.noExercises')}
                        </h3>
                        <p className="text-gray-600">
                            Inizia ad aggiungere esercizi a questo workout
                        </p>
                    </div>
                )}

                {/* Add/Edit Exercise Button */}
                {!showAddForm && (
                    <button
                        onClick={() => {
                            resetForm()
                            setShowAddForm(true)
                        }}
                        className="w-full bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold py-4 px-6 rounded-lg transition-colors mb-6"
                    >
                        + Aggiungi Esercizio
                    </button>
                )}

                {/* Add/Edit Exercise Form */}
                {showAddForm && (
                    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">
                            {editingExerciseId ? 'Modifica Esercizio' : 'Aggiungi Esercizio'}
                        </h3>

                        <div className="space-y-6">
                            {/* Exercise Selection with Autocomplete */}
                            <AutocompleteSearch
                                options={exerciseOptions}
                                value={selectedExerciseId}
                                onSelect={(option) => setSelectedExerciseId(option?.id || '')}
                                label="Esercizio *"
                                placeholder={t('exercises.searchExercise')}
                                required
                                disabled={!!editingExerciseId} // Cannot change exercise when editing
                            />

                            {/* Sets */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Serie *
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={sets}
                                    onChange={(e) => setSets(parseInt(e.target.value) || 1)}
                                    disabled={saving}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                                />
                            </div>

                            {/* Reps - using RepsInput component */}
                            <RepsInput
                                value={reps}
                                onChange={setReps}
                                disabled={saving}
                            />

                            {/* Rest Time - using RestTimeSelector component */}
                            <RestTimeSelector
                                value={restTime}
                                onChange={setRestTime}
                                disabled={saving}
                            />

                            {/* RPE Target */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    RPE Target (opzionale)
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {[5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((rpe) => (
                                        <button
                                            key={rpe}
                                            type="button"
                                            onClick={() => setTargetRpe(rpe)}
                                            disabled={saving}
                                            className={`px-4 py-2 text-sm font-semibold rounded transition-colors ${targetRpe === rpe
                                                ? 'bg-[#FFA700] text-white'
                                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                } disabled:opacity-50`}
                                        >
                                            {rpe}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => setTargetRpe(undefined)}
                                        disabled={saving}
                                        className={`px-4 py-2 text-sm font-semibold rounded transition-colors ${targetRpe === undefined
                                            ? 'bg-gray-400 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            } disabled:opacity-50`}
                                    >
                                        N/A
                                    </button>
                                </div>
                            </div>

                            {/* Weight Type - using WeightTypeSelector component */}
                            <WeightTypeSelector
                                value={weightType}
                                onChange={setWeightType}
                                disabled={saving}
                            />

                            {/* Weight Amount */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Peso {weightType.startsWith('percentage') ? '*' : '(opzionale)'}
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max="1000"
                                    step="0.5"
                                    value={weight ?? ''}
                                    onChange={(e) => setWeight(e.target.value ? parseFloat(e.target.value) : undefined)}
                                    disabled={saving}
                                    placeholder={weightType === 'absolute' ? 'es. 100' : 'es. 80'}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    {weightType === 'absolute' && 'Peso in kg'}
                                    {weightType === 'percentage_1rm' && 'Percentuale del massimale (1RM)'}
                                    {weightType === 'percentage_rm' && 'Percentuale di nRM'}
                                    {weightType === 'percentage_previous' && 'Percentuale rispetto alla prima occorrenza'}
                                </p>
                            </div>

                            {/* Is Warmup Checkbox */}
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="isWarmup"
                                    checked={isWarmup}
                                    onChange={(e) => setIsWarmup(e.target.checked)}
                                    disabled={saving}
                                    className="w-5 h-5 text-[#FFA700] border-gray-300 rounded focus:ring-[#FFA700]"
                                />
                                <label htmlFor="isWarmup" className="text-sm font-semibold text-gray-700">
                                    🔥 Serie di riscaldamento
                                </label>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Note (opzionali)
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    disabled={saving}
                                    placeholder="es. Pausa di 2 secondi al petto"
                                    rows={3}
                                    maxLength={500}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    {notes.length}/500 caratteri
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex space-x-4">
                                <button
                                    onClick={handleSaveExercise}
                                    disabled={saving || !selectedExerciseId}
                                    className="flex-1 bg-[#FFA700] hover:bg-[#FF9500] disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
                                >
                                    {saving ? (
                                        <LoadingSpinner size="sm" color="white" />
                                    ) : editingExerciseId ? (
                                        'Salva Modifiche'
                                    ) : (
                                        'Aggiungi'
                                    )}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowAddForm(false)
                                        resetForm()
                                    }}
                                    disabled={saving}
                                    className="bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
                                >
                                    Annulla
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Bottom Actions */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <Link
                        href={`/trainer/programs/${programId}/edit`}
                        className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg text-center transition-colors"
                    >
                        ← Torna alla Panoramica
                    </Link>
                    {program.status === 'draft' && sortedExercises.length > 0 && (
                        <Link
                            href={`/trainer/programs/${programId}/publish`}
                            className="flex-1 bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold py-3 px-6 rounded-lg text-center transition-colors"
                        >
                            Salva e Continua alla Pubblicazione →
                        </Link>
                    )}
                </div>
            </div>
        </div>
    )
}
