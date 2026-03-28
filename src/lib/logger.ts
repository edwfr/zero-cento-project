import pino from 'pino'

/**
 * Structured JSON Logger using Pino
 * Used for server-side logging
 */
export const logger = pino({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport:
        process.env.NODE_ENV === 'development'
            ? {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'HH:MM:ss Z',
                    ignore: 'pid,hostname',
                },
            }
            : undefined,
    formatters: {
        level: (label) => {
            return { level: label }
        },
    },
})
