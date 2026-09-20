import '@testing-library/jest-dom'
import { vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'

// Mock Next.js router
vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
        refresh: vi.fn(),
        back: vi.fn(),
    }),
    useParams: () => ({}),
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
    redirect: vi.fn(),
}))

// Mock Next.js Link. The factory is async so React is imported as a module
// (this file is .ts, so no JSX) instead of being pulled in with require().
vi.mock('next/link', async () => {
    const React = await import('react')
    return {
        default: ({ children, href, ...props }: { children?: ReactNode; href: string }) =>
            React.createElement('a', { href, ...props }, children),
    }
})

// Mock Supabase clients
vi.mock('@/lib/supabase-client', () => ({
    createClient: () => ({
        auth: {
            getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
            onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
            signInWithPassword: vi.fn(),
            signOut: vi.fn(),
            resetPasswordForEmail: vi.fn(),
            updateUser: vi.fn(),
        },
    }),
}))

vi.mock('@/lib/supabase-server', () => ({
    createServerClient: vi.fn(),
}))

// Mock react-i18next
// IMPORTANT: stableT must be created inside the factory to avoid hoisting issues,
// but still be a stable reference across renders (not a new function per useTranslation() call).
vi.mock('react-i18next', () => {
    const stableT = (key: string) => key
    return {
        useTranslation: () => ({
            t: stableT,
            i18n: { language: 'en', changeLanguage: vi.fn() },
        }),
        Trans: ({ children }: { children: React.ReactNode }) => children,
        initReactI18next: { type: '3rdParty', init: vi.fn() },
    }
})

// Shared, fully typed Prisma mock (tests/helpers/prisma-mock.ts).
// The factory is async so the helper module is loaded after vi.mock hoisting.
vi.mock('@/lib/prisma', async () => {
    const { prismaMock } = await import('../helpers/prisma-mock')
    return { prisma: prismaMock }
})

beforeEach(async () => {
    const { resetPrismaMock } = await import('../helpers/prisma-mock')
    resetPrismaMock()
})

// Node >= 25 ships a native localStorage that shadows jsdom's and throws on
// access unless --localstorage-file is set. Install an in-memory Storage
// whenever the ambient one is missing or unusable, so tests behave the same
// on Node 20 (CI) and Node 26 (local).
function createMemoryStorage(): Storage {
    let store = new Map<string, string>()
    return {
        get length() {
            return store.size
        },
        clear() {
            store = new Map()
        },
        getItem(key: string) {
            return store.has(key) ? store.get(key)! : null
        },
        key(index: number) {
            return Array.from(store.keys())[index] ?? null
        },
        removeItem(key: string) {
            store.delete(key)
        },
        setItem(key: string, value: string) {
            store.set(key, String(value))
        },
    } as Storage
}

function isUsableStorage(candidate: unknown): boolean {
    try {
        const storage = candidate as Storage | undefined
        if (!storage || typeof storage.clear !== 'function') return false
        storage.setItem('__probe__', '1')
        storage.removeItem('__probe__')
        return true
    } catch {
        return false
    }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
    if (!isUsableStorage((globalThis as Record<string, unknown>)[name])) {
        const storage = createMemoryStorage()
        Object.defineProperty(globalThis, name, { value: storage, configurable: true, writable: true })
        if (typeof window !== 'undefined' && window !== (globalThis as unknown as Window)) {
            Object.defineProperty(window, name, { value: storage, configurable: true, writable: true })
        }
    }
}

beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
})
