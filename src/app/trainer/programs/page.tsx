'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LoadingSpinner } from '@/components/LoadingSpinner'

interface Program {
    id: string
    title: string
    status: 'draft' | 'active' | 'completed'
    durationWeeks: number
    workoutsPerWeek: number
    startDate: string | null
    trainee: {
        firstName: string
        lastName: string
    }
    weeks: Array<{ id: string }>
    createdAt: string
}

export default function TrainerProgramsPage() {
    const router = useRouter()
    const [programs, setPrograms] = useState<Program[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<'draft' | 'active' | 'completed'>('active')
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        fetchPrograms()
    }, [])

    const fetchPrograms = async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/programs')
            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error?.message || 'Errore nel caricamento programmi')
            }

            setPrograms(data.data.programs)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string, title: string) => {
        if (!confirm(`Sei sicuro di voler eliminare il programma "${title}"?`)) {
            return
        }

        try {
            const res = await fetch(`/api/programs/${id}`, {
                method: 'DELETE',
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error?.message || 'Errore eliminazione programma')
            }

            fetchPrograms()
        } catch (err: any) {
            alert(err.message)
        }
    }

    const filteredPrograms = programs.filter((prog) => {
        const matchesTab = prog.status === activeTab
        const matchesSearch =
            prog.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            `${prog.trainee.firstName} ${prog.trainee.lastName}`
                .toLowerCase()
                .includes(searchTerm.toLowerCase())

        return matchesTab && matchesSearch
    })

    const statusCounts = {
        draft: programs.filter((p) => p.status === 'draft').length,
        active: programs.filter((p) => p.status === 'active').length,
        completed: programs.filter((p) => p.status === 'completed').length,
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <LoadingSpinner size="lg" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Programmi di Allenamento</h1>
                    <p className="text-gray-600 mt-2">
                        Gestisci i programmi dei tuoi atleti
                    </p>
                </div>

                {/* Actions Bar */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                        {/* Search */}
                        <div className="flex-1 max-w-md">
                            <input
                                type="text"
                                placeholder="🔍 Cerca programma o atleta..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                            />
                        </div>

                        {/* New Program Button */}
                        <Link
                            href="/trainer/programs/new"
                            className="bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold px-6 py-2 rounded-lg transition-colors"
                        >
                            ➕ Nuovo Programma
                        </Link>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {/* Tabs */}
                <div className="mb-6">
                    <div className="border-b border-gray-200">
                        <nav className="-mb-px flex space-x-8">
                            <button
                                onClick={() => setActiveTab('draft')}
                                className={`pb-4 px-1 border-b-2 font-semibold text-sm ${
                                    activeTab === 'draft'
                                        ? 'border-[#FFA700] text-[#FFA700]'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                📝 Bozze ({statusCounts.draft})
                            </button>
                            <button
                                onClick={() => setActiveTab('active')}
                                className={`pb-4 px-1 border-b-2 font-semibold text-sm ${
                                    activeTab === 'active'
                                        ? 'border-[#FFA700] text-[#FFA700]'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                ✅ Attivi ({statusCounts.active})
                            </button>
                            <button
                                onClick={() => setActiveTab('completed')}
                                className={`pb-4 px-1 border-b-2 font-semibold text-sm ${
                                    activeTab === 'completed'
                                        ? 'border-[#FFA700] text-[#FFA700]'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                🏁 Completati ({statusCounts.completed})
                            </button>
                        </nav>
                    </div>
                </div>

                {/* Programs List */}
                {filteredPrograms.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-md p-12 text-center">
                        <p className="text-gray-500 text-lg">
                            {searchTerm
                                ? 'Nessun programma trovato con questi filtri'
                                : `Nessun programma ${activeTab === 'draft' ? 'in bozza' : activeTab === 'active' ? 'attivo' : 'completato'}`}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {filteredPrograms.map((program) => (
                            <div
                                key={program.id}
                                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6"
                            >
                                {/* Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold text-gray-900 mb-1">
                                            {program.title}
                                        </h3>
                                        <p className="text-gray-600">
                                            {program.trainee.firstName} {program.trainee.lastName}
                                        </p>
                                    </div>
                                    <span
                                        className={`px-3 py-1 text-xs font-semibold rounded-full ${
                                            program.status === 'draft'
                                                ? 'bg-yellow-100 text-yellow-800'
                                                : program.status === 'active'
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-gray-100 text-gray-800'
                                        }`}
                                    >
                                        {program.status === 'draft'
                                            ? 'Bozza'
                                            : program.status === 'active'
                                            ? 'Attivo'
                                            : 'Completato'}
                                    </span>
                                </div>

                                {/* Info */}
                                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                                    <div>
                                        <span className="text-gray-500">Durata:</span>
                                        <span className="ml-2 font-semibold text-gray-900">
                                            {program.durationWeeks} settimane
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Allenamenti/sett:</span>
                                        <span className="ml-2 font-semibold text-gray-900">
                                            {program.workoutsPerWeek}
                                        </span>
                                    </div>
                                    {program.startDate && (
                                        <div className="col-span-2">
                                            <span className="text-gray-500">Inizio:</span>
                                            <span className="ml-2 font-semibold text-gray-900">
                                                {new Date(program.startDate).toLocaleDateString(
                                                    'it-IT'
                                                )}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex space-x-2 pt-4 border-t">
                                    <Link
                                        href={`/trainer/programs/${program.id}`}
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-4 rounded-lg text-center transition-colors"
                                    >
                                        Visualizza
                                    </Link>
                                    {program.status === 'draft' && (
                                        <>
                                            <Link
                                                href={`/trainer/programs/${program.id}/edit`}
                                                className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2 px-4 rounded-lg text-center transition-colors"
                                            >
                                                Modifica
                                            </Link>
                                            <button
                                                onClick={() =>
                                                    handleDelete(program.id, program.title)
                                                }
                                                className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors"
                                            >
                                                🗑️
                                            </button>
                                        </>
                                    )}
                                    {program.status === 'active' && (
                                        <Link
                                            href={`/trainer/programs/${program.id}/progress`}
                                            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold py-2 px-4 rounded-lg text-center transition-colors"
                                        >
                                            Progress
                                        </Link>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
