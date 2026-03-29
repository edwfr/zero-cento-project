'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import LoadingSpinner from '@/components/LoadingSpinner'

interface Trainee {
    id: string
    firstName: string
    lastName: string
}

interface Exercise {
    id: string
    name: string
    type: 'fundamental' | 'accessory'
}

interface PersonalRecord {
    id: string
    weight: number
    reps: number
    recordDate: string
    notes: string | null
    exercise: Exercise
}

export default function TraineeRecordsManagementPage() {
    const params = useParams<{ id: string }>()
    const traineeId = params.id

    const [loading, setLoading] = useState(true)
    const [trainee, setTrainee] = useState<Trainee | null>(null)
    const [records, setRecords] = useState<PersonalRecord[]>([])
    const [exercises, setExercises] = useState<Exercise[]>([])
    const [error, setError] = useState<string | null>(null)

    // Add modal state
    const [showAddModal, setShowAddModal] = useState(false)
    const [addLoading, setAddLoading] = useState(false)
    const [selectedExerciseId, setSelectedExerciseId] = useState('')
    const [weight, setWeight] = useState('')
    const [reps, setReps] = useState('')
    const [recordDate, setRecordDate] = useState(new Date().toISOString().split('T')[0])
    const [notes, setNotes] = useState('')

    useEffect(() => {
        fetchData()
    }, [traineeId])

    const fetchData = async () => {
        try {
            setLoading(true)

            const [traineeRes, recordsRes, exercisesRes] = await Promise.all([
                fetch(`/api/users/${traineeId}`),
                fetch(`/api/personal-records?traineeId=${traineeId}`),
                fetch('/api/exercises?limit=100'),
            ])

            const [traineeData, recordsData, exercisesData] = await Promise.all([
                traineeRes.json(),
                recordsRes.json(),
                exercisesRes.json(),
            ])

            if (!traineeRes.ok) {
                throw new Error(traineeData.error?.message || 'Atleta non trovato')
            }

            setTrainee(traineeData.data.user)
            setRecords(recordsData.data?.records || [])
            setExercises(exercisesData.data?.exercises || [])

            if (exercisesData.data?.exercises?.length > 0) {
                setSelectedExerciseId(exercisesData.data.exercises[0].id)
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleAddRecord = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (!selectedExerciseId || !weight || !reps) {
            setError('Compila tutti i campi obbligatori')
            return
        }

        try {
            setAddLoading(true)

            const res = await fetch('/api/personal-records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    traineeId,
                    exerciseId: selectedExerciseId,
                    weight: parseFloat(weight),
                    reps: parseInt(reps),
                    recordDate,
                    notes: notes || undefined,
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error?.message || 'Errore creazione massimale')
            }

            // Reset form
            setWeight('')
            setReps('')
            setNotes('')
            setRecordDate(new Date().toISOString().split('T')[0])
            setShowAddModal(false)

            // Refresh data
            fetchData()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setAddLoading(false)
        }
    }

    const handleDeleteRecord = async (recordId: string, exerciseName: string) => {
        if (!confirm(`Sei sicuro di voler eliminare il massimale di ${exerciseName}?`)) {
            return
        }

        try {
            const res = await fetch(`/api/personal-records/${recordId}`, {
                method: 'DELETE',
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error?.message || 'Errore eliminazione massimale')
            }

            fetchData()
        } catch (err: any) {
            alert(err.message)
        }
    }

    const calculateOneRepMax = (weight: number, reps: number): number => {
        if (reps === 1) return weight
        // Brzycki formula
        return Math.round(weight * (36 / (37 - reps)) * 10) / 10
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <LoadingSpinner size="lg" />
            </div>
        )
    }

    if (error && !trainee) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg">
                        {error}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href={`/trainer/trainees/${traineeId}`}
                        className="text-brand-primary hover:text-brand-primary/80 text-sm font-semibold mb-4 inline-block"
                    >
                        ← Torna al profilo atleta
                    </Link>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">
                                Gestione Massimali
                            </h1>
                            {trainee && (
                                <p className="text-gray-600 mt-2">
                                    {trainee.firstName} {trainee.lastName}
                                </p>
                            )}
                        </div>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold px-6 py-2 rounded-lg transition-colors"
                        >
                            ➕ Aggiungi Massimale
                        </button>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {/* Records Table */}
                {records.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-md p-12 text-center">
                        <div className="text-5xl mb-4">💪</div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">
                            Nessun Massimale Registrato
                        </h2>
                        <p className="text-gray-600 mb-6">
                            Inizia aggiungendo i massimali dell'atleta per monitorare i progressi
                        </p>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold px-6 py-3 rounded-lg transition-colors"
                        >
                            Aggiungi Primo Massimale
                        </button>
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow-md overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                        Esercizio
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                        Peso (kg)
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                        Ripetizioni
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                        1RM Stimato
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                        Data
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                        Note
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                                        Azioni
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {records.map((record) => (
                                    <tr key={record.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-gray-900">
                                                {record.exercise.name}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {record.exercise.type === 'fundamental'
                                                    ? 'Fondamentale'
                                                    : 'Accessorio'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                            {record.weight} kg
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                            {record.reps} reps
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-[#FFA700]">
                                            {calculateOneRepMax(record.weight, record.reps)} kg
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                            {new Date(record.recordDate).toLocaleDateString('it-IT')}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {record.notes || '—'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <button
                                                onClick={() =>
                                                    handleDeleteRecord(record.id, record.exercise.name)
                                                }
                                                className="text-red-600 hover:text-red-800 text-sm font-semibold"
                                            >
                                                Elimina
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Add Modal */}
                {showAddModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg max-w-2xl w-full p-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">
                                Aggiungi Massimale
                            </h2>

                            <form onSubmit={handleAddRecord} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Esercizio *
                                    </label>
                                    <select
                                        value={selectedExerciseId}
                                        onChange={(e) => setSelectedExerciseId(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                                        required
                                    >
                                        {exercises.map((ex) => (
                                            <option key={ex.id} value={ex.id}>
                                                {ex.name} ({ex.type === 'fundamental' ? 'Fondamentale' : 'Accessorio'})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Peso (kg) *
                                        </label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            min="0"
                                            value={weight}
                                            onChange={(e) => setWeight(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                                            placeholder="es. 100"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Ripetizioni *
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="30"
                                            value={reps}
                                            onChange={(e) => setReps(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                                            placeholder="es. 5"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Data Massimale *
                                    </label>
                                    <input
                                        type="date"
                                        value={recordDate}
                                        onChange={(e) => setRecordDate(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Note (opzionali)
                                    </label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        rows={2}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                                        placeholder="Note aggiuntive..."
                                    />
                                </div>

                                {/* Estimated 1RM Preview */}
                                {weight && reps && (
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <div className="text-sm text-gray-600 mb-1">
                                            1RM Stimato (formula Brzycki):
                                        </div>
                                        <div className="text-2xl font-bold text-[#FFA700]">
                                            {calculateOneRepMax(parseFloat(weight), parseInt(reps))} kg
                                        </div>
                                    </div>
                                )}

                                <div className="flex space-x-4 pt-4">
                                    <button
                                        type="submit"
                                        disabled={addLoading}
                                        className="flex-1 bg-[#FFA700] hover:bg-[#FF9500] disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center"
                                    >
                                        {addLoading ? <LoadingSpinner size="sm" color="white" /> : 'Salva Massimale'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowAddModal(false)
                                            setError(null)
                                        }}
                                        className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 rounded-lg transition-colors"
                                    >
                                        Annulla
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
