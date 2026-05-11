interface ResolveEffectiveWeightDisplayInput {
    readOnly: boolean
    previewEffectiveWeight: number | null
    persistedEffectiveWeight: number | null
}

export function resolveEffectiveWeightDisplay({
    readOnly,
    previewEffectiveWeight,
    persistedEffectiveWeight,
}: ResolveEffectiveWeightDisplayInput): number | null {
    if (readOnly) {
        return typeof persistedEffectiveWeight === 'number'
            ? persistedEffectiveWeight
            : previewEffectiveWeight
    }

    if (typeof previewEffectiveWeight === 'number') {
        return previewEffectiveWeight
    }

    return typeof persistedEffectiveWeight === 'number' ? persistedEffectiveWeight : null
}