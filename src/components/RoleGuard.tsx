'use client'

import { ReactNode, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'

interface RoleGuardProps {
    children: ReactNode
    allowedRoles: Array<'admin' | 'trainer' | 'trainee'>
    userRole?: 'admin' | 'trainer' | 'trainee'
    fallback?: ReactNode
    redirectTo?: string
}

/**
 * RoleGuard Component
 * HOC to protect routes based on user role
 * Redirects or shows fallback if user doesn't have access
 */
export default function RoleGuard({
    children,
    allowedRoles,
    userRole,
    fallback,
    redirectTo,
}: RoleGuardProps) {
    const router = useRouter()
    const { t } = useTranslation('common')

    useEffect(() => {
        if (!userRole) {
            if (redirectTo) {
                router.push(redirectTo)
            }
            return
        }

        if (!allowedRoles.includes(userRole)) {
            if (redirectTo) {
                router.push(redirectTo)
            }
        }
    }, [userRole, allowedRoles, redirectTo, router])

    // No user role - don't render
    if (!userRole) {
        return fallback ? <>{fallback}</> : null
    }

    // User doesn't have access
    if (!allowedRoles.includes(userRole)) {
        if (fallback) {
            return <>{fallback}</>
        }

        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
                    <div className="text-6xl mb-4">🚫</div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('errors.accessDeniedTitle')}</h1>
                    <p className="text-gray-600 mb-6">
                        {t('errors.accessDeniedMessage')}
                    </p>
                    <button
                        onClick={() => router.back()}
                        className="bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold px-6 py-3 rounded-lg transition-colors"
                    >
                        {t('common.back')}
                    </button>
                </div>
            </div>
        )
    }

    // User has access - render children
    return <>{children}</>
}
