import { describe, expect, it } from 'vitest'
import { resolveEffectiveWeightDisplay } from '@/app/trainer/programs/[id]/edit/effective-weight-display'

describe('resolveEffectiveWeightDisplay', () => {
    it('uses persisted effective weight in read-only mode when available', () => {
        expect(
            resolveEffectiveWeightDisplay({
                readOnly: true,
                previewEffectiveWeight: 97.5,
                persistedEffectiveWeight: 95,
            })
        ).toBe(95)
    })

    it('falls back to preview effective weight in read-only mode when persisted is missing', () => {
        expect(
            resolveEffectiveWeightDisplay({
                readOnly: true,
                previewEffectiveWeight: 97.5,
                persistedEffectiveWeight: null,
            })
        ).toBe(97.5)
    })

    it('prioritizes preview effective weight in edit mode', () => {
        expect(
            resolveEffectiveWeightDisplay({
                readOnly: false,
                previewEffectiveWeight: 97.5,
                persistedEffectiveWeight: 95,
            })
        ).toBe(97.5)
    })

    it('falls back to persisted effective weight in edit mode when preview is missing', () => {
        expect(
            resolveEffectiveWeightDisplay({
                readOnly: false,
                previewEffectiveWeight: null,
                persistedEffectiveWeight: 95,
            })
        ).toBe(95)
    })

    it('returns null when no effective weight value is available', () => {
        expect(
            resolveEffectiveWeightDisplay({
                readOnly: false,
                previewEffectiveWeight: null,
                persistedEffectiveWeight: null,
            })
        ).toBeNull()
    })
})