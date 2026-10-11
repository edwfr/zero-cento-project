'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import '@/lib/i18n/client'
import { SkeletonTable, ActionIconButton, InlineActions } from '@/components'
import ConfirmationModal from '@/components/ConfirmationModal'
import { useToast } from '@/components/ToastNotification'
import { Input } from '@/components/Input'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatDate } from '@/lib/date-format'

interface TemplateListItem {
    id: string
    name: string
    workoutsPerWeek: number
    exerciseCount: number
    usageCount: number
    lastUsedAt: string | null
    updatedAt: string
}

type SortKey = 'name' | 'workoutsPerWeek' | 'exerciseCount' | 'usageCount' | 'lastUsedAt' | 'updatedAt'

export default function TrainerTemplatesContent() {
    const { t } = useTranslation(['trainer', 'common'])
    const { showToast } = useToast()
    const [templates, setTemplates] = useState<TemplateListItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [sortKey, setSortKey] = useState<SortKey>('updatedAt')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
    const [toDelete, setToDelete] = useState<TemplateListItem | null>(null)

    const fetchTemplates = useCallback(async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/workout-templates')
            const json = await res.json()
            if (!res.ok) throw new Error(getApiErrorMessage(json, t('trainer:templates.loadError'), t))
            setTemplates(json.data)
        } catch (err) {
            setError(err instanceof Error ? err.message : t('trainer:templates.loadError'))
        } finally {
            setLoading(false)
        }
    }, [t])

    useEffect(() => {
        void fetchTemplates()
    }, [fetchTemplates])

    const visible = useMemo(() => {
        const term = search.trim().toLowerCase()
        const filtered = term ? templates.filter((tpl) => tpl.name.toLowerCase().includes(term)) : templates
        const dir = sortDir === 'asc' ? 1 : -1
        return [...filtered].sort((a, b) => {
            const av = a[sortKey]
            const bv = b[sortKey]
            if (av === bv) return 0
            if (av === null) return -1 * dir
            if (bv === null) return 1 * dir
            if (typeof av === 'string' && typeof bv === 'string') {
                return av.localeCompare(bv, 'it', { sensitivity: 'base' }) * dir
            }
            return (av < bv ? -1 : 1) * dir
        })
    }, [templates, search, sortKey, sortDir])

    const toggleSort = (key: SortKey) => {
        if (key === sortKey) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        } else {
            setSortKey(key)
            setSortDir(key === 'name' ? 'asc' : 'desc')
        }
    }

    const handleDelete = async () => {
        if (!toDelete) return
        const target = toDelete
        try {
            const res = await fetch(`/api/workout-templates/${target.id}`, { method: 'DELETE' })
            if (!res.ok) {
                const json = await res.json().catch(() => ({}))
                throw new Error(getApiErrorMessage(json, t('trainer:templates.deleteError'), t))
            }
            setTemplates((current) => current.filter((tpl) => tpl.id !== target.id))
            showToast(t('trainer:templates.deleted'), 'success')
        } catch (err) {
            showToast(err instanceof Error ? err.message : t('trainer:templates.deleteError'), 'error')
        } finally {
            setToDelete(null)
        }
    }

    const columns: { key: SortKey; label: string }[] = [
        { key: 'name', label: t('trainer:templates.colName') },
        { key: 'workoutsPerWeek', label: t('trainer:templates.colWorkouts') },
        { key: 'exerciseCount', label: t('trainer:templates.colExercises') },
        { key: 'usageCount', label: t('trainer:templates.colUsage') },
        { key: 'lastUsedAt', label: t('trainer:templates.colLastUsed') },
        { key: 'updatedAt', label: t('trainer:templates.colUpdated') },
    ]

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{t('trainer:templates.title')}</h1>
                    <p className="text-gray-600 mt-1">{t('trainer:templates.subtitle')}</p>
                </div>
                <Link
                    href="/trainer/templates/new"
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-brand-primary text-white hover:bg-brand-primary-hover"
                >
                    <Plus className="w-4 h-4" />
                    {t('trainer:templates.newTemplate')}
                </Link>
            </header>

            {loading && <SkeletonTable />}
            {error && <p className="text-state-error">{error}</p>}

            {!loading && !error && templates.length === 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center space-y-3">
                    <h2 className="text-lg font-semibold text-gray-900">{t('trainer:templates.emptyTitle')}</h2>
                    <p className="text-gray-600">{t('trainer:templates.emptyDescription')}</p>
                    <Link
                        href="/trainer/templates/new"
                        className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-brand-primary text-white hover:bg-brand-primary-hover"
                    >
                        {t('trainer:templates.newTemplate')}
                    </Link>
                </div>
            )}

            {!loading && !error && templates.length > 0 && (
                <div className="space-y-4">
                    <Input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t('trainer:templates.searchPlaceholder')}
                        aria-label={t('trainer:templates.searchPlaceholder')}
                    />
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-left text-gray-600">
                                <tr>
                                    {columns.map((col) => (
                                        <th key={col.key} className="px-4 py-3 font-medium">
                                            <button
                                                type="button"
                                                onClick={() => toggleSort(col.key)}
                                                className="inline-flex items-center gap-1 hover:text-gray-900"
                                            >
                                                {col.label}
                                                {sortKey === col.key &&
                                                    (sortDir === 'asc' ? (
                                                        <ArrowUp className="w-3 h-3" />
                                                    ) : (
                                                        <ArrowDown className="w-3 h-3" />
                                                    ))}
                                            </button>
                                        </th>
                                    ))}
                                    <th className="px-4 py-3 font-medium">{t('trainer:templates.colActions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {visible.map((tpl) => (
                                    <tr key={tpl.id}>
                                        <td className="px-4 py-3 font-medium text-gray-900">{tpl.name}</td>
                                        <td className="px-4 py-3">{tpl.workoutsPerWeek}</td>
                                        <td className="px-4 py-3">{tpl.exerciseCount}</td>
                                        <td className="px-4 py-3">{tpl.usageCount}</td>
                                        <td className="px-4 py-3">
                                            {tpl.lastUsedAt ? formatDate(tpl.lastUsedAt) : t('trainer:templates.neverUsed')}
                                        </td>
                                        <td className="px-4 py-3">{formatDate(tpl.updatedAt)}</td>
                                        <td className="px-4 py-3">
                                            <InlineActions>
                                                <ActionIconButton
                                                    variant="edit"
                                                    label={t('trainer:templates.edit')}
                                                    href={`/trainer/templates/${tpl.id}`}
                                                />
                                                <ActionIconButton
                                                    variant="delete"
                                                    label={t('trainer:templates.delete')}
                                                    onClick={() => setToDelete(tpl)}
                                                />
                                            </InlineActions>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {toDelete && (
                <ConfirmationModal
                    isOpen={true}
                    onClose={() => setToDelete(null)}
                    onConfirm={handleDelete}
                    title={t('trainer:templates.deleteTitle')}
                    message={t('trainer:templates.deleteMessage')}
                    confirmText={t('trainer:templates.delete')}
                    variant="danger"
                />
            )}
        </div>
    )
}
