'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import { SkeletonTable } from '@/components'
import { BarChart2 } from 'lucide-react'
import { formatDate } from '@/lib/date-format'

interface PersonalRecord {
    id: string
    weight: number
    reps: number
    achievedAt: string
    exercise: {
        id: string
        name: string
        type: 'fundamental' | 'accessory'
    }
}

export default function PersonalRecordsContent() {
    const { t } = useTranslation('trainee')
    const [loading, setLoading] = useState(true)
    const [records, setRecords] = useState<PersonalRecord[]>([])
    const [error, setError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [typeFilter, setTypeFilter] = useState<'all' | 'fundamental' | 'accessory'>('all')

    useEffect(() => {
        fetchRecords()
    }, [])

    const fetchRecords = async () => {
        try {
            setLoading(true)

            const res = await fetch('/api/personal-records')
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('records.errorLoading'), t))
            }

            setRecords(data.data.items)
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : t('records.errorLoading')
            setError(message)
        } finally {
            setLoading(false)
        }
    }

    const calculateOneRepMax = (weight: number, reps: number): number => {
        if (reps === 1) return weight
        // Brzycki formula
        return Math.round(weight * (36 / (37 - reps)) * 10) / 10
    }

    const filteredRecords = records.filter((pr) => {
        const matchesSearch = pr.exercise.name.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesType = typeFilter === 'all' || pr.exercise.type === typeFilter
        return matchesSearch && matchesType
    })

    // Group by exercise
    const groupedRecords: Record<string, PersonalRecord[]> = {}
    filteredRecords.forEach((pr) => {
        if (!groupedRecords[pr.exercise.id]) {
            groupedRecords[pr.exercise.id] = []
        }
        groupedRecords[pr.exercise.id].push(pr)
    })

    // Get best record per exercise (highest 1RM)
    const bestRecords = Object.values(groupedRecords).map((prs) => {
        return prs.reduce((best, current) => {
            const bestOrm = calculateOneRepMax(best.weight, best.reps)
            const currentOrm = calculateOneRepMax(current.weight, current.reps)
            return currentOrm > bestOrm ? current : best
        })
    })

    if (loading) {
        return (
            <div className="py-8">
                <SkeletonTable rows={8} columns={4} />
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
                    {t('records.backToDashboard')}
                </Link>
                <h1 className="text-3xl font-bold text-gray-900">{t('records.title')}</h1>
                <p className="text-gray-600 mt-2">
                    {t('records.description')}
                </p>
            </div>

            {records.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-12 text-center">
                    <div className="mb-4"><BarChart2 className="w-16 h-16 mx-auto text-gray-300" /></div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">
                        {t('records.noRecords')}
                    </h2>
                    <p className="text-gray-600">
                        {t('records.noRecordsDesc')}
                    </p>
                </div>
            ) : (
                <>
                    {/* Filters */}
                    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Search */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    {t('records.searchLabel')}
                                </label>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={t('records.searchPlaceholder')}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                                />
                            </div>

                            {/* Type Filter */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    {t('records.typeLabel')}
                                </label>
                                <div className="flex space-x-2">
                                    {[
                                        { value: 'all', label: t('records.typeAll') },
                                        { value: 'fundamental', label: t('records.typeFundamental') },
                                        { value: 'accessory', label: t('records.typeAccessory') },
                                    ].map((option) => (
                                        <button
                                            key={option.value}
                                            onClick={() =>
                                                setTypeFilter(option.value as typeof typeFilter)
                                            }
                                            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${typeFilter === option.value
                                                ? 'bg-[#FFA700] text-white'
                                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Records Grid */}
                    {bestRecords.length === 0 ? (
                        <div className="bg-white rounded-lg shadow-md p-8 text-center">
                            <p className="text-gray-600">{t('records.noRecordsFound')}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {bestRecords
                                .sort((a, b) => a.exercise.name.localeCompare(b.exercise.name))
                                .map((pr) => {
                                    const oneRepMax = calculateOneRepMax(pr.weight, pr.reps)
                                    const allPRs = groupedRecords[pr.exercise.id] || []

                                    return (
                                        <div
                                            key={pr.id}
                                            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                                        >
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-lg font-bold text-gray-900">
                                                    {pr.exercise.name}
                                                </h3>
                                                <span
                                                    className={`px-2 py-1 text-xs font-semibold rounded ${pr.exercise.type === 'fundamental'
                                                        ? 'bg-purple-100 text-purple-800'
                                                        : 'bg-gray-100 text-gray-800'
                                                        }`}
                                                >
                                                    {pr.exercise.type === 'fundamental'
                                                        ? t('records.tagFundamental')
                                                        : t('records.tagAccessory')}
                                                </span>
                                            </div>

                                            <div className="space-y-3 mb-4">
                                                <div>
                                                    <p className="text-sm text-gray-600 mb-1">
                                                        {t('records.bestRecord')}
                                                    </p>
                                                    <p className="text-3xl font-bold text-[#FFA700]">
                                                        {pr.weight} kg
                                                    </p>
                                                    <p className="text-sm text-gray-600">
                                                        {t('records.reps', { count: pr.reps })}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-sm text-gray-600 mb-1">
                                                        {t('records.calculatedOrm')}
                                                    </p>
                                                    <p className="text-2xl font-bold text-gray-900">
                                                        {oneRepMax} kg
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="border-t border-gray-200 pt-3">
                                                <p className="text-xs text-gray-600">
                                                    {t('records.achievedOn')} {formatDate(pr.achievedAt)}
                                                </p>
                                                {allPRs.length > 1 && (
                                                    <p className="text-xs text-gray-600 mt-1">
                                                        {t('records.totalPRs', { count: allPRs.length })}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                        </div>
                    )}
                </>
            )}

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-8">
                <p className="text-sm text-blue-900">
                    <span className="font-semibold">ℹ️</span> {t('records.infoNote')}
                </p>
            </div>
        </div>
    )
}
