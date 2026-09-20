import { describe, it, expect } from 'vitest'

describe('test setup: web storage', () => {
    it('exposes a usable localStorage', () => {
        expect(typeof localStorage.clear).toBe('function')
        localStorage.setItem('k', 'v')
        expect(localStorage.getItem('k')).toBe('v')
        expect(localStorage.length).toBe(1)
        localStorage.removeItem('k')
        expect(localStorage.getItem('k')).toBeNull()
    })

    it('exposes a usable sessionStorage', () => {
        sessionStorage.setItem('k', 'v')
        expect(sessionStorage.getItem('k')).toBe('v')
    })

    it('starts every test with an empty localStorage', () => {
        expect(localStorage.length).toBe(0)
        localStorage.setItem('leak', '1')
    })

    it('does not leak storage between tests', () => {
        expect(localStorage.getItem('leak')).toBeNull()
        expect(localStorage.length).toBe(0)
    })

    it('exposes the same storage on window and globalThis', () => {
        localStorage.setItem('shared', '1')
        expect(window.localStorage.getItem('shared')).toBe('1')
    })
})
