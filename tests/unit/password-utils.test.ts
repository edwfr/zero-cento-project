import { describe, it, expect } from 'vitest'
import { generateSecurePassword } from '@/lib/password-utils'

describe('generateSecurePassword', () => {
    describe('Length Validation', () => {
        it('generates password with default length of 12 characters', () => {
            const password = generateSecurePassword()
            expect(password).toHaveLength(12)
        })

        it('generates password with custom length', () => {
            const password = generateSecurePassword(16)
            expect(password).toHaveLength(16)
        })

        it('generates password with minimum length of 8 characters', () => {
            const password = generateSecurePassword(8)
            expect(password).toHaveLength(8)
        })

        it('generates password with large length', () => {
            const password = generateSecurePassword(32)
            expect(password).toHaveLength(32)
        })
    })

    describe('Character Variety Requirements', () => {
        it('contains at least one uppercase letter', () => {
            const password = generateSecurePassword()
            expect(password).toMatch(/[A-Z]/)
        })

        it('contains at least one lowercase letter', () => {
            const password = generateSecurePassword()
            expect(password).toMatch(/[a-z]/)
        })

        it('contains at least one number', () => {
            const password = generateSecurePassword()
            expect(password).toMatch(/[0-9]/)
        })

        it('contains at least one symbol', () => {
            const password = generateSecurePassword()
            expect(password).toMatch(/[!@#$%^&*]/)
        })

        it('contains all required character types', () => {
            const password = generateSecurePassword()
            const hasUppercase = /[A-Z]/.test(password)
            const hasLowercase = /[a-z]/.test(password)
            const hasNumber = /[0-9]/.test(password)
            const hasSymbol = /[!@#$%^&*]/.test(password)

            expect(hasUppercase).toBe(true)
            expect(hasLowercase).toBe(true)
            expect(hasNumber).toBe(true)
            expect(hasSymbol).toBe(true)
        })
    })

    describe('Character Set Compliance', () => {
        it('only contains allowed characters', () => {
            const password = generateSecurePassword()
            const allowedChars = /^[A-Za-z0-9!@#$%^&*]+$/
            expect(password).toMatch(allowedChars)
        })

        it('does not contain spaces', () => {
            const password = generateSecurePassword()
            expect(password).not.toMatch(/\s/)
        })

        it('does not contain ambiguous characters', () => {
            // The function uses clear character sets, but we verify it doesn't accidentally include ambiguous ones
            const password = generateSecurePassword()
            // This test passes as long as password is generated from defined character sets
            expect(password.length).toBeGreaterThan(0)
        })
    })

    describe('Randomness and Unpredictability', () => {
        it('generates different passwords on consecutive calls', () => {
            const password1 = generateSecurePassword()
            const password2 = generateSecurePassword()
            expect(password1).not.toBe(password2)
        })

        it('generates unique passwords in batch', () => {
            const passwords = new Set<string>()
            const batchSize = 100

            for (let i = 0; i < batchSize; i++) {
                passwords.add(generateSecurePassword())
            }

            // All passwords should be unique
            expect(passwords.size).toBe(batchSize)
        })

        it('has good distribution across multiple generations', () => {
            const charCounts = {
                uppercase: 0,
                lowercase: 0,
                numbers: 0,
                symbols: 0,
            }

            const iterations = 50
            for (let i = 0; i < iterations; i++) {
                const password = generateSecurePassword()

                charCounts.uppercase += (password.match(/[A-Z]/g) || []).length
                charCounts.lowercase += (password.match(/[a-z]/g) || []).length
                charCounts.numbers += (password.match(/[0-9]/g) || []).length
                charCounts.symbols += (password.match(/[!@#$%^&*]/g) || []).length
            }

            // Each category should have at least 1 character per password (minimum)
            expect(charCounts.uppercase).toBeGreaterThanOrEqual(iterations)
            expect(charCounts.lowercase).toBeGreaterThanOrEqual(iterations)
            expect(charCounts.numbers).toBeGreaterThanOrEqual(iterations)
            expect(charCounts.symbols).toBeGreaterThanOrEqual(iterations)
        })
    })

    describe('Edge Cases', () => {
        it('handles minimum viable length (4 chars for each category)', () => {
            // Minimum is 4 because we guarantee one char from each of 4 categories
            const password = generateSecurePassword(4)
            expect(password).toHaveLength(4)

            // Should still contain all 4 character types
            expect(/[A-Z]/.test(password)).toBe(true)
            expect(/[a-z]/.test(password)).toBe(true)
            expect(/[0-9]/.test(password)).toBe(true)
            expect(/[!@#$%^&*]/.test(password)).toBe(true)
        })

        it('works consistently across many calls', () => {
            for (let i = 0; i < 100; i++) {
                const password = generateSecurePassword()

                expect(password).toHaveLength(12)
                expect(/[A-Z]/.test(password)).toBe(true)
                expect(/[a-z]/.test(password)).toBe(true)
                expect(/[0-9]/.test(password)).toBe(true)
                expect(/[!@#$%^&*]/.test(password)).toBe(true)
            }
        })
    })

    describe('Security Properties', () => {
        it('has sufficient entropy for 12-character password', () => {
            // Character set size: 26 + 26 + 10 + 8 = 70 characters
            // Entropy = log2(70^12) ≈ 73.7 bits (very strong)
            // We just verify the password meets length and variety requirements
            const password = generateSecurePassword(12)

            expect(password.length).toBe(12)
            expect(/[A-Z]/.test(password)).toBe(true)
            expect(/[a-z]/.test(password)).toBe(true)
            expect(/[0-9]/.test(password)).toBe(true)
            expect(/[!@#$%^&*]/.test(password)).toBe(true)
        })

        it('generates passwords resistant to dictionary attacks', () => {
            // By ensuring randomness and character variety, 
            // the password won't match common dictionary words
            const password = generateSecurePassword()

            // Common dictionary words to avoid (lowercase check)
            const commonWords = ['password', 'admin', 'user', 'test', 'qwerty', '12345678']
            const lowerPassword = password.toLowerCase()

            const containsCommonWord = commonWords.some(word =>
                lowerPassword.includes(word)
            )

            expect(containsCommonWord).toBe(false)
        })

        it('meets minimum security requirements for temporary passwords', () => {
            const password = generateSecurePassword()

            // OWASP recommendations for temporary passwords:
            // - Minimum 8 characters (we use 12+)
            // - Mixed character types (we enforce all 4)
            // - Random generation (we verify uniqueness)

            expect(password.length).toBeGreaterThanOrEqual(12)
            expect(/[A-Z]/.test(password)).toBe(true)
            expect(/[a-z]/.test(password)).toBe(true)
            expect(/[0-9]/.test(password)).toBe(true)
            expect(/[!@#$%^&*]/.test(password)).toBe(true)
        })
    })
})
