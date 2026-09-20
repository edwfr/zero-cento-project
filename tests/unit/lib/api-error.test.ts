import { describe, it, expect, vi } from 'vitest'
import { getApiErrorMessage } from '@/lib/api-error'
import type { TFunction } from 'i18next'

// The fake t only needs the (key, options) overload getApiErrorMessage uses.
const createMockT = () => vi.fn((key: string, options?: { defaultValue?: string }) => {
    const translations: Record<string, string> = {
        'errors:exercise.nameExists': 'Un esercizio con questo nome esiste gia',
        'errors:user.notFound': 'Utente non trovato',
        'errors:program.createDenied': 'Puoi creare programmi solo per i tuoi atleti',
        'errors:feedback.modifyDenied': 'Puoi modificare solo il tuo feedback',
        'errors:validation.invalidMuscleGroupId': 'ID gruppo muscolare non valido',
        'validation:validation.invalidMuscleGroupId': 'ID gruppo muscolare non valido',
    }

    return translations[key] ?? options?.defaultValue ?? key
})

describe('getApiErrorMessage', () => {
    it('should translate error key using errors namespace', () => {
        const mockT = createMockT()

        const apiResponse = {
            error: {
                code: 'CONFLICT',
                message: 'Exercise with this name already exists',
                key: 'exercise.nameExists'
            }
        }

        const result = getApiErrorMessage(apiResponse, 'Errore generico', mockT as unknown as TFunction)

        expect(mockT).toHaveBeenCalledWith('errors:exercise.nameExists', { defaultValue: 'Errore generico' })
        expect(result).toBe('Un esercizio con questo nome esiste gia')
    })

    it('should return fallback when no error key is present', () => {
        const mockT = vi.fn()

        const apiResponse = {
            error: {
                code: 'CONFLICT',
                message: 'Some error'
            }
        }

        const result = getApiErrorMessage(apiResponse, 'Errore generico', mockT as unknown as TFunction)

        expect(mockT).not.toHaveBeenCalled()
        expect(result).toBe('Errore generico')
    })

    it('should return fallback when data is not an error object', () => {
        const mockT = vi.fn()

        const result1 = getApiErrorMessage(null, 'Errore generico', mockT as unknown as TFunction)
        const result2 = getApiErrorMessage(undefined, 'Errore generico', mockT as unknown as TFunction)
        const result3 = getApiErrorMessage({ data: 'success' }, 'Errore generico', mockT as unknown as TFunction)

        expect(mockT).not.toHaveBeenCalled()
        expect(result1).toBe('Errore generico')
        expect(result2).toBe('Errore generico')
        expect(result3).toBe('Errore generico')
    })

    it('should handle various error keys correctly', () => {
        const mockT = createMockT()

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
            const result = getApiErrorMessage(response, 'Fallback', mockT as unknown as TFunction)
            expect(result).toBe(expected)
        })
    })

    it('should prioritize details message key over generic error key', () => {
        const mockT = createMockT()

        const apiResponse = {
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid input',
                key: 'validation.invalidInput',
                details: [
                    {
                        message: 'validation.invalidMuscleGroupId',
                        path: ['muscleGroups', 0, 'muscleGroupId']
                    }
                ]
            }
        }

        const result = getApiErrorMessage(apiResponse, 'Errore generico', mockT as unknown as TFunction)

        expect(result).toBe('ID gruppo muscolare non valido')
    })

    it('should return details message as-is when no translation exists', () => {
        const mockT = createMockT()

        const apiResponse = {
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid input',
                details: [
                    {
                        message: 'validation.unknownKey'
                    }
                ]
            }
        }

        const result = getApiErrorMessage(apiResponse, 'Errore generico', mockT as unknown as TFunction)

        expect(result).toBe('validation.unknownKey')
    })
})
