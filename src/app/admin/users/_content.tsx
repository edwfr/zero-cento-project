'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import UserCreateModal from '@/components/UserCreateModal'
import UserEditModal from '@/components/UserEditModal'
import UserDeleteModal from '@/components/UserDeleteModal'
import { useToast } from '@/components/ToastNotification'
import ConfirmationModal from '@/components/ConfirmationModal'
import { formatDate } from '@/lib/date-format'
import { Button } from '@/components/Button'

interface User {
    id: string
    email: string
    firstName: string
    lastName: string
    role: 'admin' | 'trainer' | 'trainee'
    isActive: boolean
    createdAt: string
}

const PAGE_SIZE = 15

const ROLE_BADGE: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-800',
    trainer: 'bg-blue-100 text-blue-800',
    trainee: 'bg-green-100 text-green-800',
}

export default function AdminUsersContent() {
    const { t } = useTranslation(['admin', 'common'])
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Filters
    const [searchTerm, setSearchTerm] = useState('')
    const [filterRole, setFilterRole] = useState<string>('all')
    const [filterStatus, setFilterStatus] = useState<string>('all')

    // Pagination
    const [page, setPage] = useState(1)

    // Bulk selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [bulkLoading, setBulkLoading] = useState(false)
    const { showToast } = useToast()
    const [confirmModal, setConfirmModal] = useState<{
        title: string
        message: string
        onConfirm: () => void
        confirmText?: string
        variant?: 'danger' | 'warning' | 'info' | 'success'
    } | null>(null)

    // Modals
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [deletingUser, setDeletingUser] = useState<User | null>(null)

    const fetchUsers = async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/users')
            const data = await res.json()
            if (!res.ok) throw new Error(getApiErrorMessage(data, t('admin:users.loadingError'), t))
            setUsers(data.data.items)
            setSelectedIds(new Set())
            setPage(1)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('admin:users.loadingError'))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchUsers()
    }, [])

    // Reset to page 1 when filters change
    useEffect(() => {
        setPage(1)
        setSelectedIds(new Set())
    }, [searchTerm, filterRole, filterStatus])

    // Filtered + searched list
    const filtered = useMemo(() => {
        const term = searchTerm.toLowerCase()
        return users.filter((u) => {
            const matchesSearch =
                !term ||
                u.firstName.toLowerCase().includes(term) ||
                u.lastName.toLowerCase().includes(term) ||
                u.email.toLowerCase().includes(term)
            const matchesRole = filterRole === 'all' || u.role === filterRole
            const matchesStatus =
                filterStatus === 'all' ||
                (filterStatus === 'active' && u.isActive) ||
                (filterStatus === 'inactive' && !u.isActive)
            return matchesSearch && matchesRole && matchesStatus
        })
    }, [users, searchTerm, filterRole, filterStatus])

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    // Bulk selection helpers
    const allPageSelected =
        paginated.length > 0 && paginated.every((u) => selectedIds.has(u.id))

    const toggleSelectAll = () => {
        if (allPageSelected) {
            const next = new Set(selectedIds)
            paginated.forEach((u) => next.delete(u.id))
            setSelectedIds(next)
        } else {
            const next = new Set(selectedIds)
            paginated.forEach((u) => next.add(u.id))
            setSelectedIds(next)
        }
    }

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelectedIds(next)
    }

    // Bulk activation/deactivation
    const handleBulkStatus = (activate: boolean) => {
        if (selectedIds.size === 0) return
        setConfirmModal({
            title: activate ? t('admin:users.activateUsers') : t('admin:users.deactivateUsers'),
            message: activate
                ? t('admin:users.confirmActivate', { count: selectedIds.size })
                : t('admin:users.confirmDeactivate', { count: selectedIds.size }),
            confirmText: activate ? t('admin:users.activateAll') : t('admin:users.deactivateAll'),
            variant: activate ? 'info' : 'warning',
            onConfirm: async () => {
                setConfirmModal(null)
                try {
                    setBulkLoading(true)
                    await Promise.all(
                        Array.from(selectedIds).map((id) =>
                            fetch(`/api/users/${id}/${activate ? 'activate' : 'deactivate'}`, {
                                method: 'PATCH',
                            })
                        )
                    )
                    await fetchUsers()
                } catch {
                    showToast(t('admin:users.bulkError'), 'error')
                } finally {
                    setBulkLoading(false)
                }
            },
        })
    }

    const handleToggleStatus = async (user: User) => {
        const endpoint = user.isActive
            ? `/api/users/${user.id}/deactivate`
            : `/api/users/${user.id}/activate`
        const res = await fetch(endpoint, { method: 'PATCH' })
        if (res.ok) fetchUsers()
    }

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
            {confirmModal && (
                <ConfirmationModal
                    isOpen={true}
                    onClose={() => setConfirmModal(null)}
                    onConfirm={confirmModal.onConfirm}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    confirmText={confirmModal.confirmText ?? t('admin:users.confirm')}
                    variant={confirmModal.variant ?? 'danger'}
                />
            )}
            {/* Toolbar */}
            <div className="flex flex-col gap-4 mb-6">
                {/* Search + Filters row */}
                <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
                    {/* Search */}
                    <input
                        type="text"
                        placeholder={t('admin:users.searchPlaceholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                    />

                    {/* Role filter */}
                    <select
                        value={filterRole}
                        onChange={(e) => setFilterRole(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                    >
                        <option value="all">{t('admin:users.filterAllRoles')}</option>
                        <option value="admin">{t('common:roles.admin')}</option>
                        <option value="trainer">{t('common:roles.trainer')}</option>
                        <option value="trainee">{t('common:roles.trainee')}</option>
                    </select>

                    {/* Status filter */}
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                    >
                        <option value="all">{t('admin:users.filterAllStatuses')}</option>
                        <option value="active">{t('admin:users.filterStatusActive')}</option>
                        <option value="inactive">{t('admin:users.filterStatusInactive')}</option>
                    </select>

                    <Button
                        onClick={() => setIsCreateOpen(true)}
                        variant="primary"
                        size="md"
                        className="ml-auto whitespace-nowrap"
                    >
                        {t('admin:users.createUser')}
                    </Button>
                </div>

                {/* Bulk action bar */}
                {selectedIds.size > 0 && (
                    <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
                        <span className="text-sm font-semibold text-blue-800">
                            {t('admin:users.selectedCount', { count: selectedIds.size })}
                        </span>
                        <button
                            onClick={() => handleBulkStatus(true)}
                            disabled={bulkLoading}
                            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-1 rounded-lg transition-colors"
                        >
                            ✓ {t('admin:users.activateAll')}
                        </button>
                        <button
                            onClick={() => handleBulkStatus(false)}
                            disabled={bulkLoading}
                            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-1 rounded-lg transition-colors"
                        >
                            ✗ {t('admin:users.deactivateAll')}
                        </button>
                        <button
                            onClick={() => setSelectedIds(new Set())}
                            className="ml-auto text-brand-primary hover:text-brand-primary/80 text-sm font-semibold"
                        >
                            {t('admin:users.deselect')}
                        </button>
                    </div>
                )}

                {/* Results count */}
                <div className="text-sm text-gray-500">
                    {(searchTerm || filterRole !== 'all' || filterStatus !== 'all')
                        ? t('admin:users.foundCountFiltered', { found: filtered.length, total: users.length })
                        : t('admin:users.foundCount', { found: filtered.length })
                    }
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-4">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left">
                                    <input
                                        type="checkbox"
                                        checked={allPageSelected}
                                        onChange={toggleSelectAll}
                                        className="rounded border-gray-300 text-[#FFA700] focus:ring-[#FFA700]"
                                    />
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                    {t('admin:users.colUser')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                    {t('admin:users.colEmail')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                    {t('admin:users.colRole')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                    {t('admin:users.colStatus')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                    {t('admin:users.colCreated')}
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                                    {t('admin:users.colActions')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {paginated.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-6 py-12 text-center text-gray-500 text-sm"
                                    >
                                        {t('admin:users.noUsersFound')}
                                    </td>
                                </tr>
                            ) : (
                                paginated.map((user) => (
                                    <tr
                                        key={user.id}
                                        className={`hover:bg-gray-50 transition-colors ${selectedIds.has(user.id) ? 'bg-blue-50' : ''
                                            }`}
                                    >
                                        <td className="px-4 py-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(user.id)}
                                                onChange={() => toggleSelect(user.id)}
                                                className="rounded border-gray-300 text-[#FFA700] focus:ring-[#FFA700]"
                                            />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-semibold text-gray-900 text-sm">
                                                {user.firstName} {user.lastName}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {user.email}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span
                                                className={`px-2 py-1 text-xs font-semibold rounded-full ${ROLE_BADGE[user.role]}`}
                                            >
                                                {t(`common:roles.${user.role}`)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <button
                                                onClick={() => handleToggleStatus(user)}
                                                className={`px-2 py-1 text-xs font-semibold rounded-full cursor-pointer transition-colors ${user.isActive
                                                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                                    : 'bg-red-100 text-red-800 hover:bg-red-200'
                                                    }`}
                                            >
                                                {user.isActive ? t('admin:users.statusActive') : t('admin:users.statusInactive')}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {formatDate(user.createdAt)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex justify-end space-x-3">
                                                <button
                                                    onClick={() => setEditingUser(user)}
                                                    className="text-brand-primary hover:text-brand-primary/80"
                                                    title={t('admin:users.editUser')}
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => setDeletingUser(user)}
                                                    className="text-red-600 hover:text-red-800"
                                                    title={t('admin:users.deleteUser')}
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
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
                        {t('admin:users.pageInfo', { page, total: totalPages, count: filtered.length })}
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
                                        ? 'bg-brand-primary text-white border-[#FFA700]'
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

            {/* Modals */}
            {isCreateOpen && (
                <UserCreateModal
                    onClose={() => setIsCreateOpen(false)}
                    onUserCreated={() => {
                        fetchUsers()
                        setIsCreateOpen(false)
                    }}
                />
            )}
            {editingUser && (
                <UserEditModal
                    user={editingUser}
                    onClose={() => setEditingUser(null)}
                    onUserUpdated={() => {
                        fetchUsers()
                        setEditingUser(null)
                    }}
                />
            )}
            {deletingUser && (
                <UserDeleteModal
                    user={deletingUser}
                    onClose={() => setDeletingUser(null)}
                    onUserDeleted={() => {
                        fetchUsers()
                        setDeletingUser(null)
                    }}
                />
            )}
        </div>
    )
}
