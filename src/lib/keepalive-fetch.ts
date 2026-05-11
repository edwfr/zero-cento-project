const DEFAULT_TIMEOUT_MS = 10_000

export function keepaliveFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const merged: RequestInit = {
        ...init,
        keepalive: init.keepalive ?? true,
        signal: init.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    }

    return fetch(input, merged)
}
