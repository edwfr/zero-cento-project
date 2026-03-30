'use client'

import { ReactNode } from 'react'

/**
 * Base Skeleton Component
 * Animated skeleton loader for content placeholders
 */
interface SkeletonProps {
    className?: string
    variant?: 'text' | 'rectangular' | 'circular' | 'rounded'
    width?: string | number
    height?: string | number
    animation?: 'pulse' | 'wave' | 'none'
}

export default function Skeleton({
    className = '',
    variant = 'rectangular',
    width,
    height,
    animation = 'pulse',
}: SkeletonProps) {
    const variantClasses = {
        text: 'rounded',
        rectangular: '',
        circular: 'rounded-full',
        rounded: 'rounded-lg',
    }

    const animationClasses = {
        pulse: 'animate-pulse',
        wave: 'animate-shimmer',
        none: '',
    }

    const style: React.CSSProperties = {}
    if (width !== undefined) style.width = typeof width === 'number' ? `${width}px` : width
    if (height !== undefined) style.height = typeof height === 'number' ? `${height}px` : height

    return (
        <div
            className={`
                bg-gray-200
                ${variantClasses[variant]}
                ${animationClasses[animation]}
                ${className}
            `}
            style={style}
            aria-busy="true"
            aria-live="polite"
        />
    )
}

/**
 * Skeleton Text
 * For single or multiple lines of text
 */
interface SkeletonTextProps {
    lines?: number
    lineHeight?: string
    gap?: string
    className?: string
    lastLineWidth?: string // Width of the last line (e.g., '60%')
}

export function SkeletonText({
    lines = 1,
    lineHeight = 'h-4',
    gap = 'gap-2',
    className = '',
    lastLineWidth = '100%',
}: SkeletonTextProps) {
    return (
        <div className={`flex flex-col ${gap} ${className}`}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    variant="text"
                    className={lineHeight}
                    width={i === lines - 1 && lines > 1 ? lastLineWidth : '100%'}
                />
            ))}
        </div>
    )
}

/**
 * Skeleton Card
 * For StatCard, NavigationCard, or generic card layouts
 */
interface SkeletonCardProps {
    className?: string
    children?: ReactNode
}

export function SkeletonCard({ className = '', children }: SkeletonCardProps) {
    if (children) {
        return (
            <div className={`bg-white rounded-lg shadow-md p-6 ${className}`} aria-busy="true">
                {children}
            </div>
        )
    }

    // Default stat card skeleton
    return (
        <div className={`bg-white rounded-lg shadow-md p-6 ${className}`} aria-busy="true">
            <div className="flex items-start justify-between mb-4">
                <Skeleton variant="circular" width={48} height={48} />
                <Skeleton variant="rounded" width={60} height={24} />
            </div>
            <SkeletonText lines={1} lineHeight="h-8" className="mb-2" />
            <SkeletonText lines={1} lineHeight="h-4" lastLineWidth="60%" />
        </div>
    )
}

/**
 * Skeleton Table
 * For data tables with rows and columns
 */
interface SkeletonTableProps {
    rows?: number
    columns?: number
    showHeader?: boolean
    className?: string
}

export function SkeletonTable({
    rows = 5,
    columns = 4,
    showHeader = true,
    className = '',
}: SkeletonTableProps) {
    return (
        <div className={`bg-white rounded-lg shadow-md overflow-hidden ${className}`} aria-busy="true">
            <table className="min-w-full divide-y divide-gray-200">
                {showHeader && (
                    <thead className="bg-gray-50">
                        <tr>
                            {Array.from({ length: columns }).map((_, i) => (
                                <th key={i} className="px-6 py-4">
                                    <Skeleton className="h-4 w-24" variant="text" />
                                </th>
                            ))}
                        </tr>
                    </thead>
                )}
                <tbody className="bg-white divide-y divide-gray-200">
                    {Array.from({ length: rows }).map((_, rowIndex) => (
                        <tr key={rowIndex}>
                            {Array.from({ length: columns }).map((_, colIndex) => (
                                <td key={colIndex} className="px-6 py-4">
                                    <SkeletonText lines={1} lineHeight="h-4" />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

/**
 * Skeleton List
 * For vertical lists of items
 */
interface SkeletonListProps {
    items?: number
    showImage?: boolean
    className?: string
}

export function SkeletonList({ items = 3, showImage = false, className = '' }: SkeletonListProps) {
    return (
        <div className={`space-y-4 ${className}`} aria-busy="true">
            {Array.from({ length: items }).map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-md p-4 flex items-center gap-4">
                    {showImage && <Skeleton variant="circular" width={48} height={48} />}
                    <div className="flex-1">
                        <SkeletonText lines={2} lineHeight="h-4" lastLineWidth="70%" />
                    </div>
                </div>
            ))}
        </div>
    )
}

/**
 * Skeleton Dashboard
 * Complete dashboard layout with cards and content
 */
interface SkeletonDashboardProps {
    cards?: number
    showTable?: boolean
    className?: string
}

export function SkeletonDashboard({
    cards = 3,
    showTable = false,
    className = '',
}: SkeletonDashboardProps) {
    return (
        <div className={`space-y-6 ${className}`} aria-busy="true">
            {/* Header */}
            <div className="mb-8">
                <Skeleton className="h-8 w-64 mb-2" variant="text" />
                <Skeleton className="h-4 w-96" variant="text" />
            </div>

            {/* Stat Cards Grid */}
            {cards > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    {Array.from({ length: cards }).map((_, i) => (
                        <SkeletonCard key={i} />
                    ))}
                </div>
            )}

            {/* Optional Table */}
            {showTable && <SkeletonTable rows={5} columns={4} />}
        </div>
    )
}

/**
 * Skeleton Form
 * For form layouts with inputs
 */
interface SkeletonFormProps {
    fields?: number
    className?: string
}

export function SkeletonForm({ fields = 4, className = '' }: SkeletonFormProps) {
    return (
        <div className={`bg-white rounded-lg shadow-md p-6 space-y-6 ${className}`} aria-busy="true">
            {Array.from({ length: fields }).map((_, i) => (
                <div key={i}>
                    <Skeleton className="h-4 w-32 mb-2" variant="text" />
                    <Skeleton className="h-10 w-full" variant="rounded" />
                </div>
            ))}
            <div className="flex gap-4 justify-end mt-8">
                <Skeleton className="h-10 w-24" variant="rounded" />
                <Skeleton className="h-10 w-32" variant="rounded" />
            </div>
        </div>
    )
}

/**
 * Skeleton Navigation
 * For navigation card grids
 */
interface SkeletonNavigationProps {
    cards?: number
    className?: string
}

export function SkeletonNavigation({ cards = 4, className = '' }: SkeletonNavigationProps) {
    return (
        <div
            className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${Math.min(cards, 4)} gap-6 ${className}`}
            aria-busy="true"
        >
            {Array.from({ length: cards }).map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-md p-6">
                    <Skeleton variant="circular" width={48} height={48} className="mb-4" />
                    <SkeletonText lines={2} lineHeight="h-5" lastLineWidth="80%" />
                </div>
            ))}
        </div>
    )
}

/**
 * Skeleton Detail
 * For detail/profile pages with mixed content
 */
export function SkeletonDetail({ className = '' }: { className?: string }) {
    return (
        <div className={`bg-white rounded-lg shadow-md p-6 space-y-6 ${className}`} aria-busy="true">
            {/* Header with avatar */}
            <div className="flex items-center gap-4 pb-6 border-b">
                <Skeleton variant="circular" width={80} height={80} />
                <div className="flex-1">
                    <Skeleton className="h-8 w-48 mb-2" variant="text" />
                    <Skeleton className="h-4 w-32" variant="text" />
                </div>
            </div>

            {/* Content sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <Skeleton className="h-6 w-32 mb-3" variant="text" />
                    <SkeletonText lines={3} lineHeight="h-4" gap="gap-2" />
                </div>
                <div>
                    <Skeleton className="h-6 w-32 mb-3" variant="text" />
                    <SkeletonText lines={3} lineHeight="h-4" gap="gap-2" />
                </div>
            </div>

            {/* Additional info */}
            <div className="pt-6 border-t">
                <Skeleton className="h-6 w-40 mb-4" variant="text" />
                <SkeletonList items={2} className="space-y-2" />
            </div>
        </div>
    )
}
