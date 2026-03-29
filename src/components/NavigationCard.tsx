'use client'

import Link from 'next/link'

interface NavigationCardProps {
    href: string
    icon: string
    title: string
    description: string
    color?: 'primary' | 'secondary' | 'blue' | 'green' | 'purple' | 'red' | 'yellow'
}

const colorClasses = {
    primary: {
        bg: 'bg-orange-50',
        hover: 'hover:bg-orange-100',
        border: 'border-orange-200',
        icon: 'bg-brand-primary text-white',
        text: 'text-orange-900',
        desc: 'text-orange-700',
    },
    secondary: {
        bg: 'bg-gray-50',
        hover: 'hover:bg-gray-100',
        border: 'border-gray-200',
        icon: 'bg-gray-900 text-white',
        text: 'text-gray-900',
        desc: 'text-gray-700',
    },
    blue: {
        bg: 'bg-blue-50',
        hover: 'hover:bg-blue-100',
        border: 'border-blue-200',
        icon: 'bg-blue-500 text-white',
        text: 'text-blue-900',
        desc: 'text-blue-700',
    },
    green: {
        bg: 'bg-green-50',
        hover: 'hover:bg-green-100',
        border: 'border-green-200',
        icon: 'bg-green-500 text-white',
        text: 'text-green-900',
        desc: 'text-green-700',
    },
    purple: {
        bg: 'bg-purple-50',
        hover: 'hover:bg-purple-100',
        border: 'border-purple-200',
        icon: 'bg-purple-500 text-white',
        text: 'text-purple-900',
        desc: 'text-purple-700',
    },
    red: {
        bg: 'bg-red-50',
        hover: 'hover:bg-red-100',
        border: 'border-red-200',
        icon: 'bg-red-500 text-white',
        text: 'text-red-900',
        desc: 'text-red-700',
    },
    yellow: {
        bg: 'bg-yellow-50',
        hover: 'hover:bg-yellow-100',
        border: 'border-yellow-200',
        icon: 'bg-yellow-500 text-white',
        text: 'text-yellow-900',
        desc: 'text-yellow-700',
    },
}

export default function NavigationCard({
    href,
    icon,
    title,
    description,
    color = 'primary',
}: NavigationCardProps) {
    const colors = colorClasses[color]

    return (
        <Link
            href={href}
            className={`
                group block rounded-lg border-2 p-5 transition-all duration-200
                ${colors.bg} ${colors.hover} ${colors.border}
                hover:shadow-lg hover:scale-105
            `}
        >
            <div className="flex items-start gap-4">
                {/* Icon */}
                <div
                    className={`
                        flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg text-2xl
                        ${colors.icon}
                        group-hover:scale-110 transition-transform duration-200
                    `}
                >
                    {icon}
                </div>

                {/* Content */}
                <div className="flex-1">
                    <h3 className={`text-lg font-bold ${colors.text} mb-1 group-hover:underline`}>
                        {title}
                    </h3>
                    <p className={`text-sm ${colors.desc}`}>{description}</p>
                </div>

                {/* Arrow */}
                <div className={`text-xl ${colors.text} group-hover:translate-x-1 transition-transform duration-200`}>
                    →
                </div>
            </div>
        </Link>
    )
}
