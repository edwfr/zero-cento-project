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
import { getApiErrorMessage } from '@/lib/api-error'
import { FileText, Pencil, Trash2, Dumbbell, Lock, Unlock } from 'lucide-react'

interface Exercise {
    id: string
    name: string
    type: 'fundamental' | 'accessory'
    notes?: string[] // Array of variants/notes
}

interface WorkoutExercise {
    id: string
    order: number
    variant: string | null
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
    dayIndex: number
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
    const [variant, setVariant] = useState('')
    const [sets, setSets] = useState<number | undefined>(undefined)
    const [reps, setReps] = useState('')
    const [restTime, setRestTime] = useState<RestTime | undefined>(undefined)
    const [targetRpe, setTargetRpe] = useState<number | undefined>(undefined)
    const [weightType, setWeightType] = useState<WeightType | undefined>(undefined)
    const [weight, setWeight] = useState<number | undefined>(undefined)
    const [isWarmup, setIsWarmup] = useState(false)
    const [notes, setNotes] = useState('')
    const [variantMode, setVariantMode] = useState<'select' | 'freetext'>('select')
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
                throw new Error(t('workoutDetail.errorNotFound'))
            }

            setWorkout(foundWorkout)
            setExercises(exercisesData.data.items)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setLoading(false)
        }
    }

    const resetForm = () => {
        setSelectedExerciseId('')
        setVariant('')
        setSets(undefined)
        setReps('')
        setRestTime(undefined)
        setTargetRpe(undefined)
        setWeightType(undefined)
        setWeight(undefined)
        setIsWarmup(false)
        setNotes('')
        setVariantMode('select')
        setEditingExerciseId(null)
    }

    const loadExerciseForEdit = (we: WorkoutExercise) => {
        setEditingExerciseId(we.id)
        setSelectedExerciseId(we.exercise.id)
        setVariant(we.variant ?? '')

        // Determine if variant is from predefined options or free text
        const exercise = exercises.find(ex => ex.id === we.exercise.id)
        const hasVariant = (we.variant ?? '').trim() !== ''
        const isVariantInOptions = hasVariant && (exercise?.notes?.includes(we.variant ?? '') ?? false)
        setVariantMode(hasVariant && !isVariantInOptions ? 'freetext' : 'select')

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

        // Validate required fields
        if (!sets || !reps || !restTime || !weightType) {
            showToast(t('workoutDetail.errorMissingFields') || 'Compila tutti i campi obbligatori', 'error')
            return
        }

        try {
            setSaving(true)

            const payload = {
                exerciseId: selectedExerciseId,
                variant: variant.trim() || null,
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
                throw new Error(getApiErrorMessage(data, t('workoutDetail.errorSave'), t))
            }

            showToast(editingExerciseId ? t('workoutDetail.exerciseSaved') : t('workoutDetail.exerciseAdded'), 'success')

            // Refresh workout
            await fetchData()

            // Reset form
            setShowAddForm(false)
            resetForm()
        } catch (err: unknown) {
            showToast(err instanceof Error ? err.message : String(err), 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleDeleteExercise = (workoutExerciseId: string) => {
        setConfirmModal({
            title: t('workoutDetail.removeExerciseTitle'),
            message: t('workoutDetail.removeExerciseMessage'),
            confirmText: t('workoutDetail.removeExerciseConfirm'),
            variant: 'danger',
            onConfirm: async () => {
                setConfirmModal(null)
                try {
                    const res = await fetch(`/api/programs/${programId}/workouts/${workoutId}/exercises/${workoutExerciseId}`, {
                        method: 'DELETE',
                    })

                    if (!res.ok) {
                        const data = await res.json()
                        throw new Error(getApiErrorMessage(data, t('workoutDetail.errorRemove'), t))
                    }

                    showToast(t('workoutDetail.exerciseRemoved'), 'success')
                    await fetchData()
                } catch (err: unknown) {
                    showToast(err instanceof Error ? err.message : String(err), 'error')
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
        } catch (err: unknown) {
            showToast(err instanceof Error ? err.message : String(err), 'error')
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
                    {error || t('workoutDetail.errorNotFound')}
                </div>
            </div>
        )
    }

    const sortedExercises = [...workout.workoutExercises].sort((a, b) => a.order - b.order)

    const exerciseOptions: AutocompleteOption[] = exercises
        .map(ex => ({
            id: ex.id,
            label: ex.name,
            sublabel: ex.type === 'fundamental' ? t('exercises.fundamental') : t('exercises.accessory')
        }))
        .sort((a, b) => a.label.localeCompare(b.label, 'it', { sensitivity: 'base' }))

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
                        {`Giorno ${workout.dayIndex}`} - {program.title}
                    </h1>
                    <p className="text-gray-600 mt-2">
                        {t('workoutDetail.forTrainee')} {program.trainee.firstName} {program.trainee.lastName}
                    </p>
                    {workout.notes && (
                        <p className="text-gray-700 mt-2 italic">📝 {workout.notes}</p>
                    )}
                </div>

                {/* Exercises List */}
                {sortedExercises.length > 0 ? (
                    <div className="space-y-3 mb-6">
                        {sortedExercises.map((we, index) => (
                            <div key={we.id} className="bg-white rounded-lg shadow-md p-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center space-x-2">
                                                <span className="text-xl font-bold text-gray-400">
                                                    {index + 1}
                                                </span>
                                                <h3 className="text-lg font-bold text-gray-900">
                                                    {we.exercise.name}
                                                    {we.variant && (
                                                        <span className="text-gray-600 font-normal ml-2">({we.variant})</span>
                                                    )}
                                                </h3>
                                                <span
                                                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${we.exercise.type === 'fundamental'
                                                        ? 'bg-red-100 text-red-700 border-red-300'
                                                        : 'bg-blue-100 text-blue-700 border-blue-300'
                                                        }`}
                                                >
                                                    {we.exercise.type === 'fundamental'
                                                        ? t('exercises.fundamental')
                                                        : t('exercises.accessory')}
                                                </span>
                                                {we.isWarmup && (
                                                    <span className="px-1.5 py-0.5 text-xs font-semibold rounded bg-yellow-100 text-yellow-800">
                                                        🔥 {t('workoutDetail.warmupTag')}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={() => loadExerciseForEdit(we)}
                                                    className="p-1.5 text-[#FFA700] hover:text-[#FF9500] hover:bg-orange-50 rounded transition-colors"
                                                    title={t('workoutDetail.editBtn')}
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteExercise(we.id)}
                                                    className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                                                    title={t('workoutDetail.deleteBtn')}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-3">
                                            <div>
                                                <p className="text-xs text-gray-500 mb-0.5">{t('workoutDetail.setsCol')}</p>
                                                <p className="text-base font-semibold text-gray-900">
                                                    {we.sets}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 mb-0.5">
                                                    {t('workoutDetail.repsCol')}
                                                </p>
                                                <p className="text-base font-semibold text-gray-900">
                                                    {we.reps}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 mb-0.5">{t('workoutDetail.restCol')}</p>
                                                <p className="text-base font-semibold text-gray-900">
                                                    {getRestTimeLabel(we.restTime)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 mb-0.5">{t('workoutDetail.rpeCol')}</p>
                                                <p className="text-base font-semibold text-gray-900">
                                                    {we.targetRpe ?? '-'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 mb-0.5">{t('workoutDetail.weightTypeCol')}</p>
                                                <p className="text-base font-semibold text-gray-900">
                                                    {getWeightTypeLabel(we.weightType)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 mb-0.5">{t('workoutDetail.weightCol')}</p>
                                                <p className="text-base font-semibold text-gray-900">
                                                    {we.weight ? `${we.weight}` : '-'}
                                                </p>
                                            </div>
                                        </div>

                                        {we.notes && (
                                            <p className="text-sm text-gray-600 mt-2 italic">
                                                📝 {we.notes}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex flex-col space-y-1 ml-3">
                                        <button
                                            onClick={() => handleMoveExercise(we.id, 'up')}
                                            disabled={index === 0}
                                            className="p-1 text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
                                            title={t('workoutDetail.moveUp')}
                                        >
                                            ▲
                                        </button>
                                        <button
                                            onClick={() => handleMoveExercise(we.id, 'down')}
                                            disabled={index === sortedExercises.length - 1}
                                            className="p-1 text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
                                            title={t('workoutDetail.moveDown')}
                                        >
                                            ▼
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
                            {t('workoutDetail.noExercisesDesc')}
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
                        {t('workoutDetail.addExercise')}
                    </button>
                )}

                {/* Add/Edit Exercise Form */}
                {showAddForm && (
                    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">
                            {editingExerciseId ? t('workoutDetail.editExerciseTitle') : t('workoutDetail.addExerciseTitle')}
                        </h3>

                        <div className="space-y-6">
                            {/* Exercise Selection with Autocomplete */}
                            <AutocompleteSearch
                                options={exerciseOptions}
                                value={selectedExerciseId}
                                onSelect={(option) => setSelectedExerciseId(option?.id || '')}
                                label={t('workoutDetail.exerciseLabel')}
                                placeholder={t('exercises.searchExercise')}
                                required
                                disabled={!!editingExerciseId} // Cannot change exercise when editing
                            />

                            {/* Variant */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-semibold text-gray-700">
                                        {t('workoutDetail.variantLabel') || 'Variante'}
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setVariantMode(variantMode === 'select' ? 'freetext' : 'select')
                                        }}
                                        disabled={saving}
                                        className="flex items-center space-x-1 px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                                        title={variantMode === 'select' ? 'Passa a testo libero' : 'Passa a selezione'}
                                    >
                                        {variantMode === 'select' ? (
                                            <>
                                                <Lock className="w-3 h-3" />
                                                <span>Testo libero</span>
                                            </>
                                        ) : (
                                            <>
                                                <Unlock className="w-3 h-3" />
                                                <span>Selezione</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                {variantMode === 'select' ? (
                                    <AutocompleteSearch
                                        options={
                                            selectedExerciseId && exercises.find(ex => ex.id === selectedExerciseId)?.notes
                                                ? exercises.find(ex => ex.id === selectedExerciseId)!.notes!.map((note) => ({
                                                    id: note,
                                                    label: note,
                                                }))
                                                : []
                                        }
                                        value={variant}
                                        onSelect={(option) => setVariant(option?.id || '')}
                                        placeholder="es. bilanciere, manubri, presa stretta..."
                                        disabled={saving || !selectedExerciseId}
                                    />
                                ) : (
                                    <input
                                        type="text"
                                        value={variant}
                                        onChange={(e) => setVariant(e.target.value)}
                                        disabled={saving}
                                        placeholder="es. bilanciere, manubri, presa stretta..."
                                        maxLength={100}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                                    />
                                )}

                                <p className="text-xs text-gray-500 mt-1">
                                    {variantMode === 'select' && 'Seleziona una variante predefinita o passa a testo libero'}
                                    {variantMode === 'freetext' && t('workoutDetail.variantHelp')}
                                </p>
                            </div>

                            {/* Sets */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    {t('workoutDetail.setsLabel')} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={sets ?? ''}
                                    onChange={(e) => setSets(e.target.value ? parseInt(e.target.value) : undefined)}
                                    disabled={saving}
                                    placeholder="es. 3"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                                />
                            </div>

                            {/* Reps - using RepsInput component */}
                            <RepsInput
                                value={reps}
                                onChange={setReps}
                                disabled={saving}
                                required={true}
                            />

                            {/* Rest Time - using RestTimeSelector component */}
                            <RestTimeSelector
                                value={restTime}
                                onChange={setRestTime}
                                disabled={saving}
                                required={true}
                            />

                            {/* RPE Target */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    {t('workoutDetail.rpeTargetLabel')}
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
                                required={true}
                            />

                            {/* Weight Amount */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    {weightType?.startsWith('percentage') ? t('workoutDetail.weightRequired') : t('workoutDetail.weightLabel')}
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
                                    {weightType === 'absolute' && t('workoutDetail.weightKg')}
                                    {weightType === 'percentage_1rm' && t('workoutDetail.weightPct1rm')}
                                    {weightType === 'percentage_rm' && t('workoutDetail.weightPctRm')}
                                    {weightType === 'percentage_previous' && t('workoutDetail.weightPctPrev')}
                                    {!weightType && (t('workoutDetail.selectWeightTypeFirst') || 'Seleziona prima il tipo di peso')}
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
                                    {t('workoutDetail.warmupLabel')}
                                </label>
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
                                        t('workoutDetail.saveChanges')
                                    ) : (
                                        t('workoutDetail.add')
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
                                    {t('workoutDetail.cancel')}
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
                        {t('workoutDetail.backToOverview')}
                    </Link>
                    {program.status === 'draft' && sortedExercises.length > 0 && (
                        <Link
                            href={`/trainer/programs/${programId}/publish`}
                            className="flex-1 bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold py-3 px-6 rounded-lg text-center transition-colors"
                        >
                            {t('workoutDetail.saveAndPublish')}
                        </Link>
                    )}
                </div>
            </div>
        </div>
    )
}
