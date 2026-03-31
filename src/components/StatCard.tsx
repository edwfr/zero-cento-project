'use client'

import { ReactNode } from 'react'

interface StatCardProps {
    title: string
    value: string | number
    subtitle?: string
    icon?: ReactNode
    trend?: {
        value: number
        label: string
        isPositive: boolean
    }
    color?: 'primary' | 'success' | 'info' | 'warning' | 'danger' | 'gray'
    onClick?: () => void
    className?: string
}

/**
 * StatCard Component
 * Dashboard statistics card with icon, value, and optional trend indicator
 */
export default function StatCard({
    title,
    value,
    subtitle,
    icon,
    trend,
    color = 'primary',
    onClick,
    className = '',
}: StatCardProps) {
    const colorClasses = {
        primary: 'bg-[#FFA700]/10 text-[#FFA700]',
        success: 'bg-green-100 text-green-600',
        info: 'bg-blue-100 text-blue-600',
        warning: 'bg-yellow-100 text-yellow-600',
        danger: 'bg-red-100 text-red-600',
        gray: 'bg-gray-100 text-gray-600',
    }

    const trendColorClasses = trend?.isPositive
        ? 'text-green-600 bg-green-50'
        : 'text-red-600 bg-red-50'

    const cardClasses = `
        bg-white rounded-lg shadow-md p-6 transition-all
        ${onClick ? 'cursor-pointer hover:shadow-lg hover:scale-105' : ''}
        ${className}
    `

    return (
        <div className={cardClasses} onClick={onClick}>
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-600 mb-1">{title}</p>
                    <p className="text-3xl font-bold text-gray-900">{value}</p>
                    {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
                </div>

                {icon && (
                    <div
                        className={`p-3 rounded-lg ${colorClasses[color]}`}
                        aria-hidden="true"
                    >
                        {icon}
                    </div>
                )}
            </div>

            {trend && (
                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${trendColorClasses}`}>
                    <span className="mr-1">{trend.isPositive ? '↑' : '↓'}</span>
                    <span>{Math.abs(trend.value)}%</span>
                    <span className="ml-1 text-gray-600">{trend.label}</span>
                </div>
            )}
        </div>
    )
}
