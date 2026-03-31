'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { SkeletonList } from '@/components'
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

export default function HistoryContent() {
    const { t } = useTranslation('trainee')
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

            setPrograms(data.data.items)
        } catch (err: unknown) {
            setError((err as Error).message)
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
            <div className="py-8">
                <SkeletonList items={5} />
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg">
                    {error}
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <Link
                    href="/trainee/dashboard"
                    className="text-brand-primary hover:text-brand-primary/80 text-sm font-semibold mb-4 inline-block"
                >
                    {t('history.backToDashboard')}
                </Link>
                <h1 className="text-3xl font-bold text-gray-900">{t('history.title')}</h1>
                <p className="text-gray-600 mt-2">
                    {t('history.description')}
                </p>
            </div>

            {programs.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-12 text-center">
                    <div className="text-5xl mb-4">📋</div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">
                        {t('history.noPrograms')}
                    </h2>
                    <p className="text-gray-600 mb-6">
                        {t('history.noProgramsDesc')}
                    </p>
                    <Link
                        href="/trainee/dashboard"
                        className="inline-block bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold px-6 py-3 rounded-lg transition-colors"
                    >
                        {t('history.goToDashboard')}
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
                                                    {t('history.completed')}
                                                </span>
                                            </div>
                                            <p className="text-gray-600">
                                                {t('history.trainerWith', { firstName: program.trainer.firstName, lastName: program.trainer.lastName })}
                                            </p>
                                        </div>

                                        <div className="text-right">
                                            <p className="text-3xl font-bold text-green-600">
                                                {completionPercent}%
                                            </p>
                                            <p className="text-sm text-gray-600">{t('history.completion')}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-4">
                                        <div>
                                            <p className="text-sm text-gray-600 mb-1">{t('history.startDate')}</p>
                                            <p className="font-semibold text-gray-900">
                                                {formatDate(program.startDate)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600 mb-1">{t('history.endDate')}</p>
                                            <p className="font-semibold text-gray-900">
                                                {formatDate(program.endDate)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600 mb-1">{t('history.duration')}</p>
                                            <p className="font-semibold text-gray-900">
                                                {t('history.weeks', { count: program.durationWeeks })}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600 mb-1">{t('history.workouts')}</p>
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
                                            {t('history.viewDetails')}
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
                        <p className="text-sm text-gray-600 mb-1">{t('history.statsCompleted')}</p>
                        <p className="text-3xl font-bold text-[#FFA700]">{programs.length}</p>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-6 text-center">
                        <p className="text-sm text-gray-600 mb-1">{t('history.statsTotalWeeks')}</p>
                        <p className="text-3xl font-bold text-[#FFA700]">
                            {programs.reduce((sum, p) => sum + p.durationWeeks, 0)}
                        </p>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-6 text-center">
                        <p className="text-sm text-gray-600 mb-1">{t('history.statsTotalWorkouts')}</p>
                        <p className="text-3xl font-bold text-[#FFA700]">
                            {programs.reduce((sum, p) => sum + p.completedWorkouts, 0)}
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
