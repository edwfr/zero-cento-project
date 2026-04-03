'use client'

import { useState, useEffect } from 'react'
import LoadingSpinner from '@/components/LoadingSpinner'
import { useToast } from '@/components/ToastNotification'
import { Pencil } from 'lucide-react'

interface Trainee {
    id: string
    firstName: string
    lastName: string
}

interface EditProgramMetadataProps {
    programId: string
    initialTitle: string
    initialTraineeId: string
    initialIsSbdProgram: boolean
    initialDurationWeeks: number
    initialWorkoutsPerWeek: number
    status: 'draft' | 'active' | 'completed'
    onUpdate: () => void
}

export default function EditProgramMetadata({
    programId,
    initialTitle,
    initialTraineeId,
    initialIsSbdProgram,
    initialDurationWeeks,
    initialWorkoutsPerWeek,
    status,
    onUpdate,
}: EditProgramMetadataProps) {
    const { showToast } = useToast()
    const [isOpen, setIsOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [trainees, setTrainees] = useState<Trainee[]>([])

    const [title, setTitle] = useState(initialTitle)
    const [traineeId, setTraineeId] = useState(initialTraineeId)
    const [isSbdProgram, setIsSbdProgram] = useState(initialIsSbdProgram)
    const [durationWeeks, setDurationWeeks] = useState(initialDurationWeeks)
    const [workoutsPerWeek, setWorkoutsPerWeek] = useState(initialWorkoutsPerWeek)

    useEffect(() => {
        if (isOpen) {
            fetchTrainees()
        }
    }, [isOpen])

    const fetchTrainees = async () => {
        try {
            const res = await fetch('/api/users?role=trainee')
            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error?.message || 'Errore caricamento atleti')
            }

            const activeTrainees = data.data.items.filter((t: any) => t.isActive)
            setTrainees(activeTrainees)
        } catch (err: any) {
            showToast(err.message, 'error')
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (status !== 'draft') {
            showToast('Solo i programmi in bozza possono essere modificati', 'error')
            return
        }

        try {
            setSaving(true)

            const res = await fetch(`/api/programs/${programId}`, {
                method: 'PUT',
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
                throw new Error(data.error?.message || 'Errore aggiornamento programma')
            }

            showToast('Programma aggiornato con successo', 'success')
            setIsOpen(false)
            onUpdate()
        } catch (err: any) {
            showToast(err.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleOpen = () => {
        if (status !== 'draft') {
            showToast(
                'Solo i programmi in bozza possono essere modificati. I programmi attivi o completati non possono essere modificati.',
                'warning'
            )
            return
        }
        setIsOpen(true)
    }

    if (!isOpen) {
        return (
            <button
                onClick={handleOpen}
                className="text-sm text-brand-primary hover:text-brand-primary/80 font-semibold"
            >
                <span className="inline-flex items-center gap-1.5">
                    <Pencil className="w-4 h-4" />
                    Modifica Info Programma
                </span>
            </button>
        )
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b px-6 py-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-gray-900">
                            Modifica Informazioni Programma
                        </h2>
                        <button
                            onClick={() => setIsOpen(false)}
                            disabled={saving}
                            className="text-gray-400 hover:text-gray-600 text-2xl font-bold disabled:opacity-50"
                        >
                            ×
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {status !== 'draft' && (
                        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
                            ⚠️ Attenzione: Solo i programmi in bozza possono essere modificati
                        </div>
                    )}

                    <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-4">
                        <label className="flex items-start gap-3">
                            <input
                                type="checkbox"
                                checked={isSbdProgram}
                                onChange={(e) => setIsSbdProgram(e.target.checked)}
                                disabled={saving || status !== 'draft'}
                                className="mt-1 h-4 w-4 rounded border-gray-300 text-[#FFA700] focus:ring-[#FFA700]"
                            />
                            <span>
                                <span className="block text-sm font-semibold text-gray-900">Programma SBD</span>
                                <span className="block text-sm text-gray-600">
                                    Mostra o nasconde la reportistica SBD nelle schermate del programma.
                                </span>
                            </span>
                        </label>
                    </div>

                    {/* Program Title */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Nome Programma *
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            disabled={saving || status !== 'draft'}
                            placeholder="es. Programma Forza Base 8 Settimane"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                            required
                        />
                    </div>

                    {/* Trainee Selection */}
                    {trainees.length > 0 && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Atleta *
                            </label>
                            <select
                                value={traineeId}
                                onChange={(e) => setTraineeId(e.target.value)}
                                disabled={saving || status !== 'draft'}
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
                    )}

                    {/* Duration Weeks */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Durata (settimane) *
                        </label>
                        <div className="space-y-2">
                            <input
                                type="number"
                                min="1"
                                max="52"
                                value={durationWeeks}
                                onChange={(e) => setDurationWeeks(parseInt(e.target.value) || 1)}
                                disabled={saving || status !== 'draft'}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                                required
                            />
                            {durationWeeks !== initialDurationWeeks && (
                                <p className="text-sm text-amber-600">
                                    ⚠️ Modifica della durata: le settimane esistenti verranno mantenute.
                                    Potrebbe essere necessario aggiungere o rimuovere settimane manualmente.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Workouts Per Week */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Allenamenti per settimana *
                        </label>
                        <div className="space-y-2">
                            <input
                                type="number"
                                min="1"
                                max="7"
                                value={workoutsPerWeek}
                                onChange={(e) => setWorkoutsPerWeek(parseInt(e.target.value) || 1)}
                                disabled={saving || status !== 'draft'}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                                required
                            />
                            {workoutsPerWeek !== initialWorkoutsPerWeek && (
                                <p className="text-sm text-amber-600">
                                    ⚠️ Modifica degli allenamenti settimanali: i workout esistenti verranno mantenuti.
                                    Potrebbe essere necessario aggiungere o rimuovere workout manualmente.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Updated Summary */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm font-semibold text-blue-900 mb-2">📊 Configurazione</p>
                        <p className="text-sm text-blue-700">
                            <span className="font-semibold">{durationWeeks} settimane</span> ×{' '}
                            <span className="font-semibold">{workoutsPerWeek} allenamenti/settimana</span> ={' '}
                            <span className="font-semibold">{durationWeeks * workoutsPerWeek} workout totali</span>
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-4 pt-4 border-t">
                        <button
                            type="submit"
                            disabled={saving || status !== 'draft'}
                            className="flex-1 bg-[#FFA700] hover:bg-[#FF9500] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
                        >
                            {saving ? <LoadingSpinner size="sm" color="white" /> : 'Salva Modifiche'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            disabled={saving}
                            className="flex-1 bg-gray-300 hover:bg-gray-400 disabled:opacity-50 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
                        >
                            Annulla
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
