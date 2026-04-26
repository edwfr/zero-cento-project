'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { PersonalRecordsExplorer, RPEOneRMTable, SkeletonTable } from '@/components'
import { Plus, Dumbbell } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'
import { useToast } from '@/components/ToastNotification'
import ConfirmationModal from '@/components/ConfirmationModal'
import { formatDateForInput, getTodayForInput } from '@/lib/date-format'
import { estimateOneRMFromRpeTable } from '@/lib/calculations'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { FormLabel } from '@/components/FormLabel'

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

interface PersonalRecordExercise {
    id: string
    name: string
    type?: string
}

interface PersonalRecord {
    id: string
    weight: number
    reps: number
    recordDate: string
    notes: string | null
    exercise: PersonalRecordExercise
}

export default function TraineeRecordsContent() {
    const params = useParams<{ id: string }>()
    const traineeId = params.id
    const { t } = useTranslation('trainer')
    const [loading, setLoading] = useState(true)
    const [trainee, setTrainee] = useState<Trainee | null>(null)
    const [records, setRecords] = useState<PersonalRecord[]>([])
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

    const sortExercisesByName = (items: Exercise[]) => {
        return [...items].sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }))
    }

    const fetchData = useCallback(async () => {
        try {
            setLoading(true)

            const [traineeRes, recordsRes, exercisesRes] = await Promise.all([
                fetch(`/api/users/${traineeId}`),
                fetch(`/api/personal-records?traineeId=${traineeId}`),
                fetch('/api/exercises?limit=500'),
            ])

            const [traineeData, recordsData, exercisesData] = await Promise.all([
                traineeRes.json(),
                recordsRes.json(),
                exercisesRes.json(),
            ])

            if (!traineeRes.ok) {
                throw new Error(getApiErrorMessage(traineeData, 'Atleta non trovato', t))
            }

            const sortedExercises = sortExercisesByName(exercisesData.data?.items || [])

            setTrainee(traineeData.data.user)
            setRecords(recordsData.data?.items || [])
            setExercises(sortedExercises)

            if (sortedExercises.length > 0) {
                setSelectedExerciseId(sortedExercises[0].id)
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [traineeId, t])

    useEffect(() => {
        void fetchData()
    }, [fetchData])

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
                throw new Error(getApiErrorMessage(data, editingRecord ? 'Errore aggiornamento massimale' : 'Errore creazione massimale', t))
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
                        throw new Error(getApiErrorMessage(data, 'Errore eliminazione massimale', t))
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
        const normalizedOneRM = estimateOneRMFromRpeTable(weight, reps, 10)
        return Math.round(normalizedOneRM * 10) / 10
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
                        <Button
                            onClick={openAddModal}
                            variant="primary"
                            size="md"
                            icon={<Plus size={16} />}
                        >
                            Aggiungi Massimale
                        </Button>
                    </div>
                </div>

                <RPEOneRMTable className="mb-6" />

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {/* Records Explorer */}
                {records.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-md p-12 text-center">
                        <div className="mb-4 flex justify-center"><Dumbbell size={48} className="text-gray-300" /></div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">
                            Nessun Massimale Registrato
                        </h2>
                        <p className="text-gray-600 mb-6">
                            Inizia aggiungendo i massimali dell&apos;atleta per monitorare i progressi
                        </p>
                        <Button
                            onClick={openAddModal}
                            variant="primary"
                            size="lg"
                        >
                            Aggiungi Primo Massimale
                        </Button>
                    </div>
                ) : (
                    <PersonalRecordsExplorer
                        records={records}
                        calculateOneRepMax={calculateOneRepMax}
                        onEditRecord={openEditModal}
                        onDeleteRecord={(record) => handleDeleteRecord(record.id, record.exercise.name)}
                    />
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
                                    <FormLabel required>
                                        {t('personalRecords.exercise')}
                                    </FormLabel>
                                    <select
                                        value={selectedExerciseId}
                                        onChange={(e) => setSelectedExerciseId(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                                        required
                                        disabled={!!editingRecord}
                                    >
                                        {exercises.map((ex) => (
                                            <option key={ex.id} value={ex.id}>
                                                {ex.name} ({ex.type === 'fundamental' ? t('exercises.fundamental') : t('exercises.accessory')})
                                            </option>
                                        ))}
                                    </select>
                                    {editingRecord && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            {t('personalRecords.cannotChangeExercise')}
                                        </p>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <FormLabel required>
                                            Peso (kg)
                                        </FormLabel>
                                        <Input
                                            type="number"
                                            step="0.5"
                                            min="0"
                                            max="1000"
                                            value={weight}
                                            onChange={(e) => setWeight(e.target.value)}
                                            inputSize="md"
                                            placeholder="es. 100"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <FormLabel required>
                                            Ripetizioni
                                        </FormLabel>
                                        <Input
                                            type="number"
                                            min="1"
                                            max="100"
                                            value={reps}
                                            onChange={(e) => setReps(e.target.value)}
                                            inputSize="md"
                                            placeholder="es. 5"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <FormLabel required>
                                        Data Massimale
                                    </FormLabel>
                                    <Input
                                        type="date"
                                        value={recordDate}
                                        max={getTodayForInput()}
                                        onChange={(e) => setRecordDate(e.target.value)}
                                        inputSize="md"
                                        required
                                    />
                                </div>

                                <div>
                                    <FormLabel>
                                        Note (opzionali)
                                    </FormLabel>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        rows={2}
                                        maxLength={500}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                                        placeholder="Note aggiuntive..."
                                    />
                                </div>

                                {/* Estimated 1RM Preview */}
                                {weight && reps && (
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <div className="text-sm text-gray-600 mb-1">
                                            1RM Normalizzato (tabella RPE Mike Tuchscherer - RPE 10):
                                        </div>
                                        <div className="text-2xl font-bold text-brand-primary">
                                            {calculateOneRepMax(parseFloat(weight), parseInt(reps))} kg
                                        </div>
                                    </div>
                                )}

                                <div className="flex space-x-4 pt-4">
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        size="lg"
                                        className="flex-1"
                                        disabled={modalLoading}
                                        isLoading={modalLoading}
                                        loadingText={editingRecord ? 'Aggiorna Massimale' : 'Salva Massimale'}
                                    >
                                        {editingRecord ? 'Aggiorna Massimale' : 'Salva Massimale'}
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={() => {
                                            setShowModal(false)
                                            setEditingRecord(null)
                                            setError(null)
                                        }}
                                        variant="secondary"
                                        size="lg"
                                        className="flex-1"
                                    >
                                        Annulla
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
