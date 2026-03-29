'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import LoadingSpinner from '@/components/LoadingSpinner'
import { useToast } from '@/components/ToastNotification'

interface Trainee {
    id: string
    firstName: string
    lastName: string
    email: string
    isActive: boolean
    createdAt: string
}

export default function TrainerTraineesPage() {
    const router = useRouter()
    const { showToast } = useToast()
    const [trainees, setTrainees] = useState<Trainee[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

    useEffect(() => {
        fetchTrainees()
    }, [])

    const fetchTrainees = async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/users?role=trainee')
            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error?.message || 'Errore nel caricamento atleti')
            }

            setTrainees(data.data.users)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleToggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            const endpoint = currentStatus
                ? `/api/users/${id}/deactivate`
                : `/api/users/${id}/activate`

            const res = await fetch(endpoint, { method: 'PATCH' })
            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error?.message || 'Errore modifica status')
            }

            fetchTrainees()
        } catch (err: any) {
            showToast(err.message, 'error')
        }
    }

    const filteredTrainees = trainees.filter((trainee) => {
        const matchesSearch =
            trainee.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            trainee.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            trainee.email.toLowerCase().includes(searchTerm.toLowerCase())

        const matchesStatus =
            statusFilter === 'all' ||
            (statusFilter === 'active' && trainee.isActive) ||
            (statusFilter === 'inactive' && !trainee.isActive)

        return matchesSearch && matchesStatus
    })

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
                    <h1 className="text-3xl font-bold text-gray-900">I Miei Atleti</h1>
                    <p className="text-gray-600 mt-2">
                        Gestisci i tuoi atleti e monitora i loro progressi
                    </p>
                </div>

                {/* Actions Bar */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                        {/* Search */}
                        <div className="flex-1 max-w-md">
                            <input
                                type="text"
                                placeholder="🔍 Cerca atleta (nome, cognome, email)..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                            />
                        </div>

                        {/* Filters */}
                        <div className="flex items-center space-x-4">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as any)}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                            >
                                <option value="all">Tutti gli stati</option>
                                <option value="active">Attivi</option>
                                <option value="inactive">Disattivati</option>
                            </select>

                            <Link
                                href="/trainer/trainees/new"
                                className="bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold px-6 py-2 rounded-lg transition-colors"
                            >
                                ➕ Nuovo Atleta
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {/* Trainees Table */}
                {filteredTrainees.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-md p-12 text-center">
                        <p className="text-gray-500 text-lg">
                            {searchTerm || statusFilter !== 'all'
                                ? 'Nessun atleta trovato con questi filtri'
                                : 'Nessun atleta assegnato. Inizia aggiungendone uno!'}
                        </p>
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow-md overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Atleta
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Email
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Data Creazione
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Azioni
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredTrainees.map((trainee) => (
                                    <tr key={trainee.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-semibold text-gray-900">
                                                {trainee.firstName} {trainee.lastName}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-600">
                                                {trainee.email}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span
                                                className={`px-3 py-1 text-xs font-semibold rounded-full ${trainee.isActive
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                    }`}
                                            >
                                                {trainee.isActive ? 'Attivo' : 'Disattivato'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {new Date(trainee.createdAt).toLocaleDateString('it-IT')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end space-x-2">
                                                <Link
                                                    href={`/trainer/trainees/${trainee.id}`}
                                                    className="text-brand-primary hover:text-brand-primary/80 font-semibold"
                                                >
                                                    Dettagli
                                                </Link>
                                                <button
                                                    onClick={() =>
                                                        handleToggleStatus(
                                                            trainee.id,
                                                            trainee.isActive
                                                        )
                                                    }
                                                    className={`font-semibold ${trainee.isActive
                                                        ? 'text-red-600 hover:text-red-700'
                                                        : 'text-green-600 hover:text-green-700'
                                                        }`}
                                                >
                                                    {trainee.isActive ? 'Disattiva' : 'Attiva'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
