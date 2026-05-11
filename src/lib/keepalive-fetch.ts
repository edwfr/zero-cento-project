interface KeepaliveFetchInit extends RequestInit {
    timeoutMs?: number
}

export function keepaliveFetch(input: RequestInfo | URL, init: KeepaliveFetchInit = {}): Promise<Response> {
    const { timeoutMs, ...requestInit } = init

    const merged: RequestInit = {
        ...requestInit,
        keepalive: requestInit.keepalive ?? true,
    }

    if (!requestInit.signal && typeof timeoutMs === 'number' && timeoutMs > 0) {
        merged.signal = AbortSignal.timeout(timeoutMs)
    }

    return fetch(input, merged)
}
