'use client'

import { Component, ReactNode, ErrorInfo } from 'react'
import i18n from '@/lib/i18n/client'

interface ErrorFallbackProps {
    error: Error
    resetError: () => void
}

interface ErrorBoundaryProps {
    children: ReactNode
    fallback?: (props: ErrorFallbackProps) => ReactNode
}

interface ErrorBoundaryState {
    hasError: boolean
    error: Error | null
}

/**
 * Default Error Fallback UI
 */
function DefaultErrorFallback({ error, resetError }: ErrorFallbackProps) {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full">
                <div className="text-center mb-6">
                    <div className="text-6xl mb-4">💥</div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        {i18n.t('components:errorBoundary.title')}
                    </h1>
                    <p className="text-gray-600">
                        {i18n.t('components:errorBoundary.message')}
                    </p>
                </div>

                {process.env.NODE_ENV === 'development' && error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                        <p className="text-sm font-semibold text-red-900 mb-2">
                            {i18n.t('components:errorBoundary.details')}:
                        </p>
                        <pre className="text-xs text-red-800 overflow-x-auto whitespace-pre-wrap">
                            {error.message}
                            {error.stack && `\n\n${error.stack}`}
                        </pre>
                    </div>
                )}

                <div className="flex space-x-4">
                    <button
                        onClick={resetError}
                        className="flex-1 bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                    >
                        {i18n.t('common:common.retry')}
                    </button>
                    <button
                        onClick={() => (window.location.href = '/')}
                        className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
                    >
                        {i18n.t('common:common.backHome')}
                    </button>
                </div>
            </div>
        </div>
    )
}

/**
 * ErrorBoundary Component
 * Catches JavaScript errors anywhere in child component tree
 * Logs errors and displays fallback UI
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo)

        // TODO: Log to error reporting service (Sentry, LogRocket, etc.)
        // Example: logErrorToService(error, errorInfo)
    }

    resetError = () => {
        this.setState({ hasError: false, error: null })
    }

    render() {
        if (this.state.hasError) {
            const { fallback } = this.props
            const { error } = this.state

            if (fallback) {
                return fallback({ error: error!, resetError: this.resetError })
            }

            return <DefaultErrorFallback error={error!} resetError={this.resetError} />
        }

        return this.props.children
    }
}
