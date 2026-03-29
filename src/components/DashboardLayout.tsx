'use client'

import { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

interface User {
    id: string
    email: string
    firstName: string
    lastName: string
    role: string
}

interface DashboardLayoutProps {
    user: User
    children: ReactNode
}

export default function DashboardLayout({ user, children }: DashboardLayoutProps) {
    const router = useRouter()

    const handleLogout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push('/login')
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        {/* Logo and App Name */}
                        <Link href={`/${user.role}/dashboard`} className="flex items-center space-x-3 flex-shrink-0">
                            <Image
                                src="/images/logo/logo.png"
                                alt="ZeroCento Logo"
                                width={120}
                                height={40}
                                className="h-10 w-auto"
                                priority
                            />
                            <span className="text-xl font-semibold hidden md:block">
                                <span className="text-gray-900">0-100</span>
                                <span className="text-brand-primary"> Body Lab</span>
                                <span className="text-gray-900"> Training Platform</span>
                            </span>
                        </Link>

                        {/* User Menu */}
                        <div className="flex items-center space-x-4">
                            {/* User Info */}
                            <div className="hidden md:block text-right text-sm">
                                <div className="font-medium text-gray-900">
                                    {user.firstName} {user.lastName}
                                </div>
                                <div className="text-gray-500 capitalize">{user.role}</div>
                            </div>

                            {/* Profile Icon */}
                            <Link
                                href="/profile"
                                className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 hover:bg-blue-200 transition-colors"
                                title="Il mio profilo"
                            >
                                <svg
                                    className="w-6 h-6 text-blue-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                    />
                                </svg>
                            </Link>

                            {/* Logout Icon */}
                            <button
                                onClick={handleLogout}
                                className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 hover:bg-red-200 transition-colors"
                                title="Logout"
                            >
                                <svg
                                    className="w-6 h-6 text-red-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
        </div>
    )
}
