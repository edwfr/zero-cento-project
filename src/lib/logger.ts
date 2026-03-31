import pino from 'pino'

/**
 * Structured JSON Logger using Pino
 * Used for server-side logging
 *
 * NOTE: pino `transport` option spawns a worker thread (thread-stream) which
 * is incompatible with Next.js webpack bundling — the worker exits before the
 * route handler logs, causing "the worker has exited" errors. Use plain pino
 * without a transport so all output goes synchronously to stdout/stderr.
 */
export const logger = pino({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    formatters: {
        level: (label) => {
            return { level: label }
        },
    },
})
