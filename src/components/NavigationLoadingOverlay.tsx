'use client'

import LoadingSpinner from './LoadingSpinner'

interface NavigationLoadingOverlayProps {
    label?: string
}

/**
 * Semitransparent fullscreen overlay with a centered primary-color spinner.
 * Used for page-navigation transitions.
 */
export default function NavigationLoadingOverlay({ label }: NavigationLoadingOverlayProps) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm"
            aria-live="polite"
            aria-busy="true"
        >
            <LoadingSpinner size="lg" color="primary" label={label} />
        </div>
    )
}
