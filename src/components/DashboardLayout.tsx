'use client'

import { ReactNode, useState } from 'react'
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

const NAV_ITEMS: Record<string, { href: string; icon: string; title: string }[]> = {
    trainer: [
        { href: '/trainer/dashboard', icon: '🏠', title: 'Dashboard' },
        { href: '/trainer/trainees', icon: '👥', title: 'I Miei Atleti' },
        { href: '/trainer/programs', icon: '📋', title: 'Programmi' },
        { href: '/trainer/exercises', icon: '🏋️', title: 'Libreria Esercizi' },
        { href: '/profile', icon: '👤', title: 'Il Mio Profilo' },
    ],
    trainee: [
        { href: '/trainee/dashboard', icon: '🏠', title: 'Dashboard' },
        { href: '/trainee/programs/current', icon: '📅', title: 'Programma Attivo' },
        { href: '/trainee/records', icon: '🏆', title: 'I Miei Massimali' },
        { href: '/trainee/history', icon: '📊', title: 'Storico Allenamenti' },
        { href: '/profile', icon: '👤', title: 'Il Mio Profilo' },
    ],
    admin: [
        { href: '/admin/dashboard', icon: '🏠', title: 'Dashboard' },
        { href: '/admin/users', icon: '👥', title: 'Gestione Utenti' },
        { href: '/admin/exercises', icon: '💪', title: 'Libreria Esercizi' },
        { href: '/admin/programs', icon: '📋', title: 'Programmi Globali' },
        { href: '/admin/statistics', icon: '📊', title: 'Statistiche & Report' },
        { href: '/admin/settings', icon: '⚙️', title: 'Impostazioni' },
    ],
}

export default function DashboardLayout({ user, children }: DashboardLayoutProps) {
    const router = useRouter()
    const [menuOpen, setMenuOpen] = useState(false)

    const handleLogout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push('/login')
    }

    const navItems = NAV_ITEMS[user.role] ?? []

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center space-x-3">
                            {/* Hamburger Button */}
                            <button
                                onClick={() => setMenuOpen(true)}
                                className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 transition-colors"
                                title="Menu di navigazione"
                                aria-label="Apri menu di navigazione"
                            >
                                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            </button>

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
                        </div>

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
                                className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                                title="Il mio profilo"
                            >
                                <svg
                                    className="w-6 h-6 text-gray-600"
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

            {/* Navigation Drawer */}
            {menuOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                        onClick={() => setMenuOpen(false)}
                        aria-hidden="true"
                    />

                    {/* Drawer */}
                    <aside className="fixed top-0 left-0 z-50 h-full w-72 bg-white shadow-2xl flex flex-col">
                        {/* Drawer Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
                            <div>
                                <p className="font-bold text-gray-900">{user.firstName} {user.lastName}</p>
                                <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                            </div>
                            <button
                                onClick={() => setMenuOpen(false)}
                                className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-200 transition-colors"
                                aria-label="Chiudi menu"
                            >
                                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Nav Items */}
                        <nav className="flex-1 overflow-y-auto py-4 px-3">
                            <p className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Navigazione</p>
                            <ul className="space-y-1">
                                {navItems.map((item) => (
                                    <li key={item.href}>
                                        <Link
                                            href={item.href}
                                            onClick={() => setMenuOpen(false)}
                                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 hover:bg-brand-primary/10 hover:text-brand-primary font-medium transition-colors"
                                        >
                                            <span className="text-xl w-7 text-center">{item.icon}</span>
                                            <span>{item.title}</span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </nav>

                        {/* Drawer Footer */}
                        <div className="px-3 py-4 border-t border-gray-200">
                            <button
                                onClick={() => { setMenuOpen(false); handleLogout() }}
                                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50 font-medium transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                <span>Logout</span>
                            </button>
                        </div>
                    </aside>
                </>
            )}

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
        </div>
    )
}
