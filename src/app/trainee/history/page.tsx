'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import LoadingSpinner from '@/components/LoadingSpinner'
import { formatDate } from '@/lib/date-format'

interface Program {
    id: string
    title: string
    status: 'draft' | 'active' | 'completed'
    startDate: string
    endDate: string | null
    durationWeeks: number
    completedWorkouts: number
    totalWorkouts: number
    trainer: {
        firstName: string
        lastName: string
    }
}

export default function HistoryPage() {
    const [loading, setLoading] = useState(true)
    const [programs, setPrograms] = useState<Program[]>([])
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchHistory()
    }, [])

    const fetchHistory = async () => {
        try {
            setLoading(true)

            const res = await fetch('/api/programs?status=completed')
            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error?.message || 'Errore caricamento storico')
            }

            setPrograms(data.data.programs)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const calculateCompletionPercent = (program: Program): number => {
        if (program.totalWorkouts === 0) return 0
        return Math.round((program.completedWorkouts / program.totalWorkouts) * 100)
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <LoadingSpinner size="lg" color="primary" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg">
                    {error}
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/trainee/dashboard"
                        className="text-brand-primary hover:text-brand-primary/80 text-sm font-semibold mb-4 inline-block"
                    >
                        ← Torna alla Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900">📊 Storico Programmi</h1>
                    <p className="text-gray-600 mt-2">
                        Rivedi i tuoi programmi di allenamento completati
                    </p>
                </div>

                {programs.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-md p-12 text-center">
                        <div className="text-5xl mb-4">📋</div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">
                            Nessun Programma Completato
                        </h2>
                        <p className="text-gray-600 mb-6">
                            Hai appena iniziato! Completa il tuo primo programma per vederlo qui
                        </p>
                        <Link
                            href="/trainee/dashboard"
                            className="inline-block bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold px-6 py-3 rounded-lg transition-colors"
                        >
                            Vai alla Dashboard
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {programs
                            .sort(
                                (a, b) =>
                                    new Date(b.endDate || b.startDate).getTime() -
                                    new Date(a.endDate || a.startDate).getTime()
                            )
                            .map((program) => {
                                const completionPercent = calculateCompletionPercent(program)

                                return (
                                    <div
                                        key={program.id}
                                        className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex-1">
                                                <div className="flex items-center space-x-3 mb-2">
                                                    <h3 className="text-2xl font-bold text-gray-900">
                                                        {program.title}
                                                    </h3>
                                                    <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                                        ✓ Completato
                                                    </span>
                                                </div>
                                                <p className="text-gray-600">
                                                    con {program.trainer.firstName}{' '}
                                                    {program.trainer.lastName}
                                                </p>
                                            </div>

                                            <div className="text-right">
                                                <p className="text-3xl font-bold text-green-600">
                                                    {completionPercent}%
                                                </p>
                                                <p className="text-sm text-gray-600">completamento</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-4">
                                            <div>
                                                <p className="text-sm text-gray-600 mb-1">
                                                    Data Inizio
                                                </p>
                                                <p className="font-semibold text-gray-900">
                                                    {formatDate(program.startDate)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-600 mb-1">
                                                    Data Fine
                                                </p>
                                                <p className="font-semibold text-gray-900">
                                                    {formatDate(program.endDate)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-600 mb-1">Durata</p>
                                                <p className="font-semibold text-gray-900">
                                                    {program.durationWeeks} settimane
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-600 mb-1">Workout</p>
                                                <p className="font-semibold text-gray-900">
                                                    {program.completedWorkouts} /{' '}
                                                    {program.totalWorkouts}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                                            <div
                                                className="bg-green-500 h-3 rounded-full transition-all duration-500"
                                                style={{ width: `${completionPercent}%` }}
                                            />
                                        </div>

                                        <div className="flex space-x-4">
                                            <button
                                                disabled
                                                className="flex-1 bg-gray-300 text-gray-600 font-semibold py-2 px-4 rounded-lg cursor-not-allowed"
                                            >
                                                Visualizza Dettagli (Coming Soon)
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                    </div>
                )}

                {/* Stats Summary */}
                {programs.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                        <div className="bg-white rounded-lg shadow-md p-6 text-center">
                            <p className="text-sm text-gray-600 mb-1">Programmi Completati</p>
                            <p className="text-3xl font-bold text-[#FFA700]">{programs.length}</p>
                        </div>
                        <div className="bg-white rounded-lg shadow-md p-6 text-center">
                            <p className="text-sm text-gray-600 mb-1">Totale Settimane</p>
                            <p className="text-3xl font-bold text-[#FFA700]">
                                {programs.reduce((sum, p) => sum + p.durationWeeks, 0)}
                            </p>
                        </div>
                        <div className="bg-white rounded-lg shadow-md p-6 text-center">
                            <p className="text-sm text-gray-600 mb-1">Totale Workout</p>
                            <p className="text-3xl font-bold text-[#FFA700]">
                                {programs.reduce((sum, p) => sum + p.completedWorkouts, 0)}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
