import type { TFunction } from 'i18next'

type ApiErrorLike = {
    key?: unknown
    details?: unknown
}

type ApiDetailLike = {
    message?: unknown
}

function getErrorObject(data: unknown): ApiErrorLike | undefined {
    if (
        data !== null &&
        typeof data === 'object' &&
        'error' in data &&
        data.error !== null &&
        typeof data.error === 'object'
    ) {
        return data.error as ApiErrorLike
    }

    return undefined
}

function translateIfExists(t: TFunction, key: string): string | undefined {
    const translated = t(key, { defaultValue: key })
    return translated !== key ? translated : undefined
}

function extractDetailMessage(error: ApiErrorLike): string | undefined {
    if (!Array.isArray(error.details)) {
        return undefined
    }

    const firstDetail = error.details[0] as ApiDetailLike | undefined
    return typeof firstDetail?.message === 'string' ? firstDetail.message : undefined
}

function resolveDetailMessage(detailMessage: string, t: TFunction): string {
    const fromErrorsNamespace = translateIfExists(t, `errors:${detailMessage}`)
    if (fromErrorsNamespace) {
        return fromErrorsNamespace
    }

    const [namespace] = detailMessage.split('.')
    if (namespace) {
        const fromDomainNamespace = translateIfExists(t, `${namespace}:${detailMessage}`)
        if (fromDomainNamespace) {
            return fromDomainNamespace
        }
    }

    const directTranslation = translateIfExists(t, detailMessage)
    if (directTranslation) {
        return directTranslation
    }

    return detailMessage
}

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
    const error = getErrorObject(data)
    if (!error) {
        return fallback
    }

    const detailMessage = extractDetailMessage(error)
    if (detailMessage) {
        return resolveDetailMessage(detailMessage, t)
    }

    const key = typeof error.key === 'string' ? error.key : undefined

    if (key) {
        // Use namespace:key syntax for more reliable translation
        return t(`errors:${key}`, { defaultValue: fallback })
    }

    return fallback
}
