'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { SkeletonTable } from '@/components'
import LoadingSpinner from '@/components/LoadingSpinner'
import { useToast } from '@/components/ToastNotification'
import ConfirmationModal from '@/components/ConfirmationModal'
import { formatDate, formatDateForInput, getTodayForInput } from '@/lib/date-format'

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

interface GroupedExerciseRecord {
    exercise: Exercise
    oneRM: PersonalRecord | null
    threeRM: PersonalRecord | null
    fiveRM: PersonalRecord | null
    tenRM: PersonalRecord | null
    allRecords: PersonalRecord[]
}

export default function TraineeRecordsContent() {
    const params = useParams<{ id: string }>()
    const traineeId = params.id

    const [loading, setLoading] = useState(true)
    const [trainee, setTrainee] = useState<Trainee | null>(null)
    const [records, setRecords] = useState<PersonalRecord[]>([])
    const [groupedRecords, setGroupedRecords] = useState<GroupedExerciseRecord[]>([])
    const [exercises, setExercises] = useState<Exercise[]>([])
    const [error, setError] = useState<string | null>(null)

    // Add/Edit modal state
    const [showModal, setShowModal] = useState(false)
    const [modalLoading, setModalLoading] = useState(false)
    const [editingRecord, setEditingRecord] = useState<PersonalRecord | null>(null)
    const [selectedExerciseId, setSelectedExerciseId] = useState('')
    const [weight, setWeight] = useState('')
    const [reps, setReps] = useState('')
    const [recordDate, setRecordDate] = useState(getTodayForInput())
    const [notes, setNotes] = useState('')
    const [confirmModal, setConfirmModal] = useState<{
        title: string
        message: string
        onConfirm: () => void
        confirmText?: string
        variant?: 'danger' | 'warning' | 'info' | 'success'
    } | null>(null)
    const { showToast } = useToast()

    useEffect(() => {
        fetchData()
    }, [traineeId])

    useEffect(() => {
        // Group records by exercise and find best records for each rep range
        const grouped = groupRecordsByExercise(records)
        setGroupedRecords(grouped)
    }, [records])

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
            setRecords(recordsData.data?.items || [])
            setExercises(exercisesData.data?.items || [])

            if (exercisesData.data?.items?.length > 0) {
                setSelectedExerciseId(exercisesData.data.items[0].id)
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const groupRecordsByExercise = (records: PersonalRecord[]): GroupedExerciseRecord[] => {
        const exerciseMap = new Map<string, GroupedExerciseRecord>()

        records.forEach((record) => {
            const exerciseId = record.exercise.id
            if (!exerciseMap.has(exerciseId)) {
                exerciseMap.set(exerciseId, {
                    exercise: record.exercise,
                    oneRM: null,
                    threeRM: null,
                    fiveRM: null,
                    tenRM: null,
                    allRecords: [],
                })
            }

            const group = exerciseMap.get(exerciseId)!
            group.allRecords.push(record)

            // Find best record for each rep range based on estimated 1RM
            const estimated1RM = calculateOneRepMax(record.weight, record.reps)

            // 1RM: reps = 1
            if (record.reps === 1) {
                if (!group.oneRM || record.weight > group.oneRM.weight) {
                    group.oneRM = record
                }
            }

            // 3RM: reps between 2-4
            if (record.reps >= 2 && record.reps <= 4) {
                if (!group.threeRM || estimated1RM > calculateOneRepMax(group.threeRM.weight, group.threeRM.reps)) {
                    group.threeRM = record
                }
            }

            // 5RM: reps between 5-7
            if (record.reps >= 5 && record.reps <= 7) {
                if (!group.fiveRM || estimated1RM > calculateOneRepMax(group.fiveRM.weight, group.fiveRM.reps)) {
                    group.fiveRM = record
                }
            }

            // 10RM: reps between 8-12
            if (record.reps >= 8 && record.reps <= 12) {
                if (!group.tenRM || estimated1RM > calculateOneRepMax(group.tenRM.weight, group.tenRM.reps)) {
                    group.tenRM = record
                }
            }
        })

        return Array.from(exerciseMap.values()).sort((a, b) => {
            // Sort fundamentals first, then by name
            if (a.exercise.type !== b.exercise.type) {
                return a.exercise.type === 'fundamental' ? -1 : 1
            }
            return a.exercise.name.localeCompare(b.exercise.name)
        })
    }

    const openAddModal = () => {
        setEditingRecord(null)
        setWeight('')
        setReps('')
        setNotes('')
        setRecordDate(getTodayForInput())
        if (exercises.length > 0) {
            setSelectedExerciseId(exercises[0].id)
        }
        setShowModal(true)
        setError(null)
    }

    const openEditModal = (record: PersonalRecord) => {
        setEditingRecord(record)
        setSelectedExerciseId(record.exercise.id)
        setWeight(record.weight.toString())
        setReps(record.reps.toString())
        setRecordDate(formatDateForInput(record.recordDate))
        setNotes(record.notes || '')
        setShowModal(true)
        setError(null)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (!selectedExerciseId || !weight || !reps) {
            setError('Compila tutti i campi obbligatori')
            return
        }

        try {
            setModalLoading(true)

            const payload = {
                ...(editingRecord ? {} : { traineeId }),
                exerciseId: selectedExerciseId,
                weight: parseFloat(weight),
                reps: parseInt(reps),
                recordDate,
                notes: notes || undefined,
            }

            const url = editingRecord
                ? `/api/personal-records/${editingRecord.id}`
                : '/api/personal-records'
            const method = editingRecord ? 'PATCH' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error?.message || `Errore ${editingRecord ? 'aggiornamento' : 'creazione'} massimale`)
            }

            showToast(
                editingRecord ? 'Massimale aggiornato con successo' : 'Massimale aggiunto con successo',
                'success'
            )

            // Reset form
            setShowModal(false)
            setEditingRecord(null)

            // Refresh data
            fetchData()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setModalLoading(false)
        }
    }

    const handleDeleteRecord = (recordId: string, exerciseName: string) => {
        setConfirmModal({
            title: 'Elimina Massimale',
            message: `Sei sicuro di voler eliminare il massimale di ${exerciseName}?`,
            confirmText: 'Elimina',
            variant: 'danger',
            onConfirm: async () => {
                setConfirmModal(null)
                try {
                    const res = await fetch(`/api/personal-records/${recordId}`, {
                        method: 'DELETE',
                    })

                    const data = await res.json()

                    if (!res.ok) {
                        throw new Error(data.error?.message || 'Errore eliminazione massimale')
                    }

                    showToast('Massimale eliminato con successo', 'success')
                    fetchData()
                } catch (err: any) {
                    showToast(err.message, 'error')
                }
            },
        })
    }

    const calculateOneRepMax = (weight: number, reps: number): number => {
        if (reps === 1) return weight
        // Brzycki formula
        return Math.round(weight * (36 / (37 - reps)) * 10) / 10
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 px-4 sm:px-6 lg:px-8 py-8">
                <SkeletonTable rows={10} columns={5} />
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
                            onClick={openAddModal}
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

                {/* Grouped Records by Exercise */}
                {groupedRecords.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-md p-12 text-center">
                        <div className="text-5xl mb-4">💪</div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">
                            Nessun Massimale Registrato
                        </h2>
                        <p className="text-gray-600 mb-6">
                            Inizia aggiungendo i massimali dell'atleta per monitorare i progressi
                        </p>
                        <button
                            onClick={openAddModal}
                            className="bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold px-6 py-3 rounded-lg transition-colors"
                        >
                            Aggiungi Primo Massimale
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {groupedRecords.map((group) => (
                            <div key={group.exercise.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                                {/* Exercise Header */}
                                <div className="bg-gradient-to-r from-brand-primary to-brand-secondary px-6 py-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h2 className="text-xl font-bold text-white">
                                                {group.exercise.name}
                                            </h2>
                                            <p className="text-xs text-white/80 mt-1">
                                                {group.exercise.type === 'fundamental' ? 'Fondamentale' : 'Accessorio'}
                                            </p>
                                        </div>
                                        <div className="text-xs text-white/90">
                                            {group.allRecords.length} {group.allRecords.length === 1 ? 'record' : 'records'}
                                        </div>
                                    </div>
                                </div>

                                {/* Rep Maxes Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-gray-50">
                                    {/* 1RM */}
                                    <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                                        <div className="text-xs font-semibold text-gray-500 uppercase mb-2">1RM</div>
                                        {group.oneRM ? (
                                            <>
                                                <div className="text-2xl font-bold text-[#FFA700] mb-1">
                                                    {group.oneRM.weight} kg
                                                </div>
                                                <div className="text-xs text-gray-600">
                                                    {formatDate(group.oneRM.recordDate)}
                                                </div>
                                                <div className="mt-2 flex space-x-2">
                                                    <button
                                                        onClick={() => openEditModal(group.oneRM!)}
                                                        className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                                                    >
                                                        Modifica
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteRecord(group.oneRM!.id, group.exercise.name)}
                                                        className="text-xs text-red-600 hover:text-red-800 font-semibold"
                                                    >
                                                        Elimina
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-sm text-gray-400">—</div>
                                        )}
                                    </div>

                                    {/* 3RM */}
                                    <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                                        <div className="text-xs font-semibold text-gray-500 uppercase mb-2">3RM</div>
                                        {group.threeRM ? (
                                            <>
                                                <div className="text-2xl font-bold text-[#FFA700] mb-1">
                                                    {group.threeRM.weight} kg
                                                </div>
                                                <div className="text-xs text-gray-600">
                                                    {group.threeRM.reps} reps · {formatDate(group.threeRM.recordDate)}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    Est. 1RM: {calculateOneRepMax(group.threeRM.weight, group.threeRM.reps)} kg
                                                </div>
                                                <div className="mt-2 flex space-x-2">
                                                    <button
                                                        onClick={() => openEditModal(group.threeRM!)}
                                                        className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                                                    >
                                                        Modifica
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteRecord(group.threeRM!.id, group.exercise.name)}
                                                        className="text-xs text-red-600 hover:text-red-800 font-semibold"
                                                    >
                                                        Elimina
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-sm text-gray-400">—</div>
                                        )}
                                    </div>

                                    {/* 5RM */}
                                    <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                                        <div className="text-xs font-semibold text-gray-500 uppercase mb-2">5RM</div>
                                        {group.fiveRM ? (
                                            <>
                                                <div className="text-2xl font-bold text-[#FFA700] mb-1">
                                                    {group.fiveRM.weight} kg
                                                </div>
                                                <div className="text-xs text-gray-600">
                                                    {group.fiveRM.reps} reps · {formatDate(group.fiveRM.recordDate)}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    Est. 1RM: {calculateOneRepMax(group.fiveRM.weight, group.fiveRM.reps)} kg
                                                </div>
                                                <div className="mt-2 flex space-x-2">
                                                    <button
                                                        onClick={() => openEditModal(group.fiveRM!)}
                                                        className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                                                    >
                                                        Modifica
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteRecord(group.fiveRM!.id, group.exercise.name)}
                                                        className="text-xs text-red-600 hover:text-red-800 font-semibold"
                                                    >
                                                        Elimina
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-sm text-gray-400">—</div>
                                        )}
                                    </div>

                                    {/* 10RM */}
                                    <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                                        <div className="text-xs font-semibold text-gray-500 uppercase mb-2">10RM</div>
                                        {group.tenRM ? (
                                            <>
                                                <div className="text-2xl font-bold text-[#FFA700] mb-1">
                                                    {group.tenRM.weight} kg
                                                </div>
                                                <div className="text-xs text-gray-600">
                                                    {group.tenRM.reps} reps · {formatDate(group.tenRM.recordDate)}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    Est. 1RM: {calculateOneRepMax(group.tenRM.weight, group.tenRM.reps)} kg
                                                </div>
                                                <div className="mt-2 flex space-x-2">
                                                    <button
                                                        onClick={() => openEditModal(group.tenRM!)}
                                                        className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                                                    >
                                                        Modifica
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteRecord(group.tenRM!.id, group.exercise.name)}
                                                        className="text-xs text-red-600 hover:text-red-800 font-semibold"
                                                    >
                                                        Elimina
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-sm text-gray-400">—</div>
                                        )}
                                    </div>
                                </div>

                                {/* All Records Table */}
                                {group.allRecords.length > 0 && (
                                    <details className="border-t border-gray-200">
                                        <summary className="px-6 py-3 cursor-pointer hover:bg-gray-50 text-sm font-semibold text-gray-700">
                                            Mostra tutti i {group.allRecords.length} record
                                        </summary>
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-6 py-2 text-left text-xs font-semibold text-gray-500">Peso</th>
                                                        <th className="px-6 py-2 text-left text-xs font-semibold text-gray-500">Reps</th>
                                                        <th className="px-6 py-2 text-left text-xs font-semibold text-gray-500">1RM Est.</th>
                                                        <th className="px-6 py-2 text-left text-xs font-semibold text-gray-500">Data</th>
                                                        <th className="px-6 py-2 text-left text-xs font-semibold text-gray-500">Note</th>
                                                        <th className="px-6 py-2 text-right text-xs font-semibold text-gray-500">Azioni</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {group.allRecords
                                                        .sort((a, b) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime())
                                                        .map((record) => (
                                                            <tr key={record.id} className="hover:bg-gray-50">
                                                                <td className="px-6 py-2 text-sm font-semibold text-gray-900">
                                                                    {record.weight} kg
                                                                </td>
                                                                <td className="px-6 py-2 text-sm text-gray-700">
                                                                    {record.reps}
                                                                </td>
                                                                <td className="px-6 py-2 text-sm font-semibold text-[#FFA700]">
                                                                    {calculateOneRepMax(record.weight, record.reps)} kg
                                                                </td>
                                                                <td className="px-6 py-2 text-sm text-gray-700">
                                                                    {formatDate(record.recordDate)}
                                                                </td>
                                                                <td className="px-6 py-2 text-sm text-gray-600 max-w-xs truncate">
                                                                    {record.notes || '—'}
                                                                </td>
                                                                <td className="px-6 py-2 text-sm text-right space-x-2">
                                                                    <button
                                                                        onClick={() => openEditModal(record)}
                                                                        className="text-blue-600 hover:text-blue-800 font-semibold"
                                                                    >
                                                                        Modifica
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteRecord(record.id, group.exercise.name)}
                                                                        className="text-red-600 hover:text-red-800 font-semibold"
                                                                    >
                                                                        Elimina
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </details>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Add/Edit Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg max-w-2xl w-full p-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">
                                {editingRecord ? 'Modifica Massimale' : 'Aggiungi Massimale'}
                            </h2>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Esercizio *
                                    </label>
                                    <select
                                        value={selectedExerciseId}
                                        onChange={(e) => setSelectedExerciseId(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                                        required
                                        disabled={!!editingRecord}
                                    >
                                        {exercises.map((ex) => (
                                            <option key={ex.id} value={ex.id}>
                                                {ex.name} ({ex.type === 'fundamental' ? 'Fondamentale' : 'Accessorio'})
                                            </option>
                                        ))}
                                    </select>
                                    {editingRecord && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            Non è possibile cambiare esercizio durante la modifica
                                        </p>
                                    )}
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
                                            max="1000"
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
                                            max="100"
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
                                        max={getTodayForInput()}
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
                                        maxLength={500}
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
                                        disabled={modalLoading}
                                        className="flex-1 bg-[#FFA700] hover:bg-[#FF9500] disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center"
                                    >
                                        {modalLoading ? (
                                            <LoadingSpinner size="sm" color="white" />
                                        ) : editingRecord ? (
                                            'Aggiorna Massimale'
                                        ) : (
                                            'Salva Massimale'
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowModal(false)
                                            setEditingRecord(null)
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
