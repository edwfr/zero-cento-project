import type { TFunction } from 'i18next'

/**
 * Extracts a user-facing error message from an API response.
 *
 * If the response contains a semantic `error.key` (e.g. "exercise.notFound"),
 * it is translated via the `errors` i18n namespace using the syntax `errors:key`.
 * Otherwise the provided `fallback` string is returned.
 */
export function getApiErrorMessage(
    data: unknown,
    fallback: string,
    t: TFunction
): string {
    const key =
        data !== null &&
            typeof data === 'object' &&
            'error' in data &&
            data.error !== null &&
            typeof data.error === 'object' &&
            'key' in data.error &&
            typeof (data.error as Record<string, unknown>).key === 'string'
            ? (data.error as Record<string, unknown>).key as string
            : undefined

    if (key) {
        // Use namespace:key syntax for more reliable translation
        return t(`errors:${key}`, { defaultValue: fallback })
    }

    return fallback
}
