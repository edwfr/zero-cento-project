import { describe, it, expect, vi } from 'vitest'
import { getApiErrorMessage } from '@/lib/api-error'

describe('getApiErrorMessage', () => {
    it('should translate error key using errors namespace', () => {
        const mockT = vi.fn((key: string) => {
            if (key === 'errors:exercise.nameExists') {
                return 'Un esercizio con questo nome esiste già'
            }
            return key
        })

        const apiResponse = {
            error: {
                code: 'CONFLICT',
                message: 'Exercise with this name already exists',
                key: 'exercise.nameExists'
            }
        }

        const result = getApiErrorMessage(apiResponse, 'Errore generico', mockT as any)

        expect(mockT).toHaveBeenCalledWith('errors:exercise.nameExists', { defaultValue: 'Errore generico' })
        expect(result).toBe('Un esercizio con questo nome esiste già')
    })

    it('should return fallback when no error key is present', () => {
        const mockT = vi.fn()

        const apiResponse = {
            error: {
                code: 'CONFLICT',
                message: 'Some error'
            }
        }

        const result = getApiErrorMessage(apiResponse, 'Errore generico', mockT as any)

        expect(mockT).not.toHaveBeenCalled()
        expect(result).toBe('Errore generico')
    })

    it('should return fallback when data is not an error object', () => {
        const mockT = vi.fn()

        const result1 = getApiErrorMessage(null, 'Errore generico', mockT as any)
        const result2 = getApiErrorMessage(undefined, 'Errore generico', mockT as any)
        const result3 = getApiErrorMessage({ data: 'success' }, 'Errore generico', mockT as any)

        expect(mockT).not.toHaveBeenCalled()
        expect(result1).toBe('Errore generico')
        expect(result2).toBe('Errore generico')
        expect(result3).toBe('Errore generico')
    })

    it('should handle various error keys correctly', () => {
        const mockT = vi.fn((key: string) => {
            const translations: Record<string, string> = {
                'errors:user.notFound': 'Utente non trovato',
                'errors:program.createDenied': 'Puoi creare programmi solo per i tuoi atleti',
                'errors:feedback.modifyDenied': 'Puoi modificare solo il tuo feedback'
            }
            return translations[key] || key
        })

        const testCases = [
            {
                response: { error: { key: 'user.notFound' } },
                expected: 'Utente non trovato'
            },
            {
                response: { error: { key: 'program.createDenied' } },
                expected: 'Puoi creare programmi solo per i tuoi atleti'
            },
            {
                response: { error: { key: 'feedback.modifyDenied' } },
                expected: 'Puoi modificare solo il tuo feedback'
            }
        ]

        testCases.forEach(({ response, expected }) => {
            const result = getApiErrorMessage(response, 'Fallback', mockT as any)
            expect(result).toBe(expected)
        })
    })
})
