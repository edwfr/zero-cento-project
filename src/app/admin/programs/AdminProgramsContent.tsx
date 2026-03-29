'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'

interface Program {
    id: string
    title: string
    status: 'draft' | 'active' | 'completed'
    startDate: string | null
    endDate: string | null
    createdAt: string
    trainee: { id: string; firstName: string; lastName: string } | null
    trainer: { id: string; firstName: string; lastName: string } | null
}

const STATUS_BADGE: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    active: 'bg-green-100 text-green-800',
    completed: 'bg-gray-100 text-gray-800',
}

const STATUS_LABEL: Record<string, string> = {
    draft: 'Bozza',
    active: 'Attivo',
    completed: 'Completato',
}

const PAGE_SIZE = 15

export default function AdminProgramsContent() {
    const [programs, setPrograms] = useState<Program[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [searchTerm, setSearchTerm] = useState('')
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [page, setPage] = useState(1)

    useEffect(() => {
        const fetchPrograms = async () => {
            try {
                setLoading(true)
                const res = await fetch('/api/programs?limit=200')
                const data = await res.json()
                if (!res.ok) throw new Error(data.error?.message || 'Errore caricamento programmi')
                setPrograms(data.data.programs)
            } catch (err: any) {
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }
        fetchPrograms()
    }, [])

    useEffect(() => {
        setPage(1)
    }, [searchTerm, filterStatus])

    const filtered = useMemo(() => {
        const term = searchTerm.toLowerCase()
        return programs.filter((p) => {
            const matchesSearch =
                !term ||
                p.title.toLowerCase().includes(term) ||
                `${p.trainee?.firstName} ${p.trainee?.lastName}`.toLowerCase().includes(term) ||
                `${p.trainer?.firstName} ${p.trainer?.lastName}`.toLowerCase().includes(term)
            const matchesStatus = filterStatus === 'all' || p.status === filterStatus
            return matchesSearch && matchesStatus
        })
    }, [programs, searchTerm, filterStatus])

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#FFA700]" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                {error}
            </div>
        )
    }

    return (
        <div>
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-3 mb-4 items-start md:items-center">
                <input
                    type="text"
                    placeholder="🔍 Cerca per titolo, atleta o trainer..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                />
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                >
                    <option value="all">Tutti gli stati</option>
                    <option value="draft">Bozza</option>
                    <option value="active">Attivo</option>
                    <option value="completed">Completato</option>
                </select>
            </div>

            <div className="text-sm text-gray-500 mb-4">
                {filtered.length} programmi trovati su {programs.length} totali
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                {['Titolo', 'Atleta', 'Trainer', 'Stato', 'Inizio', 'Fine', 'Azioni'].map(
                                    (h) => (
                                        <th
                                            key={h}
                                            className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase"
                                        >
                                            {h}
                                        </th>
                                    )
                                )}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {paginated.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-6 py-12 text-center text-gray-500 text-sm"
                                    >
                                        Nessun programma trovato
                                    </td>
                                </tr>
                            ) : (
                                paginated.map((program) => (
                                    <tr key={program.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-semibold text-gray-900 text-sm">
                                                {program.title}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                            {program.trainee
                                                ? `${program.trainee.firstName} ${program.trainee.lastName}`
                                                : '—'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                            {program.trainer
                                                ? `${program.trainer.firstName} ${program.trainer.lastName}`
                                                : '—'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span
                                                className={`px-2 py-1 text-xs font-semibold rounded-full ${STATUS_BADGE[program.status]}`}
                                            >
                                                {STATUS_LABEL[program.status]}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {program.startDate
                                                ? new Date(program.startDate).toLocaleDateString('it-IT')
                                                : '—'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {program.endDate
                                                ? new Date(program.endDate).toLocaleDateString('it-IT')
                                                : '—'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <div className="flex space-x-3">
                                                <Link
                                                    href={`/trainer/programs/${program.id}/progress`}
                                                    className="text-[#FFA700] hover:text-[#FF9500] font-semibold"
                                                >
                                                    Progress
                                                </Link>
                                                <Link
                                                    href={`/trainer/programs/${program.id}/reports`}
                                                    className="text-blue-600 hover:text-blue-800 font-semibold"
                                                >
                                                    Report
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                        Pagina {page} di {totalPages}
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => setPage(1)}
                            disabled={page === 1}
                            className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                        >
                            «
                        </button>
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                        >
                            ‹
                        </button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const start = Math.max(1, Math.min(page - 2, totalPages - 4))
                            const p = start + i
                            return (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={`px-3 py-1 text-sm border rounded-lg transition-colors ${p === page
                                            ? 'bg-[#FFA700] text-white border-[#FFA700]'
                                            : 'border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    {p}
                                </button>
                            )
                        })}
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                        >
                            ›
                        </button>
                        <button
                            onClick={() => setPage(totalPages)}
                            disabled={page === totalPages}
                            className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                        >
                            »
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
