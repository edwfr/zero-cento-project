'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import UserCreateModal from './UserCreateModal'
import UserEditModal from './UserEditModal'
import UserDeleteModal from './UserDeleteModal'
import { useToast } from '@/components/ToastNotification'
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

export default function UsersTable() {
    const { t } = useTranslation(['admin', 'common'])
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [filterRole, setFilterRole] = useState<string>('all')
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [deletingUser, setDeletingUser] = useState<User | null>(null)
    const { showToast } = useToast()

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true)
            const url = filterRole === 'all'
                ? '/api/users'
                : `/api/users?role=${filterRole}`

            const response = await fetch(url)
            const data = await response.json()

            if (!response.ok) {
                throw new Error(getApiErrorMessage(data, t('common:errors.loadingError'), t))
            }

            setUsers(data.data.items)
            setError('')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [filterRole, t])

    useEffect(() => {
        void fetchUsers()
    }, [fetchUsers])

    const handleUserCreated = () => {
        fetchUsers()
        setIsCreateModalOpen(false)
    }

    const handleUserUpdated = () => {
        fetchUsers()
        setEditingUser(null)
    }

    const handleUserDeleted = () => {
        fetchUsers()
        setDeletingUser(null)
    }

    const handleToggleStatus = async (user: User) => {
        try {
            const endpoint = user.isActive
                ? `/api/users/${user.id}/deactivate`
                : `/api/users/${user.id}/activate`

            const response = await fetch(endpoint, { method: 'POST' })
            const data = await response.json()

            if (!response.ok) {
                throw new Error(getApiErrorMessage(data, t('common:errors.updateError'), t))
            }

            fetchUsers()
        } catch (err: any) {
            showToast(`${t('common:common.error')}: ${err.message}`, 'error')
        }
    }

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'admin':
                return 'bg-purple-100 text-purple-800'
            case 'trainer':
                return 'bg-blue-100 text-blue-800'
            case 'trainee':
                return 'bg-green-100 text-green-800'
            default:
                return 'bg-gray-100 text-gray-800'
        }
    }

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'admin':
                return t('common:roles.admin')
            case 'trainer':
                return t('common:roles.trainer')
            case 'trainee':
                return t('common:roles.trainee')
            default:
                return role
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
            </div>
        )
    }

    return (
        <div>
            {/* Filters and Actions */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-4">
                    <label className="text-sm font-medium text-gray-700">{t('admin:users.filterByRole')}</label>
                    <select
                        value={filterRole}
                        onChange={(e) => setFilterRole(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary text-gray-900"
                    >
                        <option value="all" className="text-gray-900">{t('common:common.all')}</option>
                        <option value="admin" className="text-gray-900">{t('common:roles.admin')}</option>
                        <option value="trainer" className="text-gray-900">{t('common:roles.trainer')}</option>
                        <option value="trainee" className="text-gray-900">{t('admin:users.athletes')}</option>
                    </select>
                </div>

                <Button
                    onClick={() => setIsCreateModalOpen(true)}
                    variant="primary"
                    size="md"
                    icon={(
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    )}
                >
                    {t('admin:users.createUser')}
                </Button>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {t('admin:users.user')}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {t('common:common.email')}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {t('admin:users.role')}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {t('common:common.status')}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {t('admin:users.createdDate')}
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {t('common:common.actions')}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {users.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                                    {t('admin:users.noUsersFound')}
                                </td>
                            </tr>
                        ) : (
                            users.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">
                                            {user.firstName} {user.lastName}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-600">{user.email}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                                            {getRoleLabel(user.role)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <button
                                            onClick={() => handleToggleStatus(user)}
                                            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full cursor-pointer ${user.isActive
                                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                                : 'bg-red-100 text-red-800 hover:bg-red-200'
                                                }`}
                                        >
                                            {user.isActive ? t('common:common.active') : t('common:common.inactive')}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {formatDate(user.createdAt)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end space-x-2">
                                            <button
                                                onClick={() => setEditingUser(user)}
                                                className="text-brand-primary hover:text-brand-primary/80"
                                                title={t('common:common.edit')}
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => setDeletingUser(user)}
                                                className="text-red-600 hover:text-red-900"
                                                title={t('common:common.delete')}
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

            {/* Modals */}
            {isCreateModalOpen && (
                <UserCreateModal
                    onClose={() => setIsCreateModalOpen(false)}
                    onUserCreated={handleUserCreated}
                />
            )}

            {editingUser && (
                <UserEditModal
                    user={editingUser}
                    onClose={() => setEditingUser(null)}
                    onUserUpdated={handleUserUpdated}
                />
            )}

            {deletingUser && (
                <UserDeleteModal
                    user={deletingUser}
                    onClose={() => setDeletingUser(null)}
                    onUserDeleted={handleUserDeleted}
                />
            )}
        </div>
    )
}

