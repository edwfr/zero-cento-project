'use client'

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface YoutubeEmbedProps {
    videoUrl: string
    title?: string
    className?: string
    autoplay?: boolean
}

/**
 * YoutubeEmbed Component
 * Responsive YouTube video embed with lazy loading
 * Converts various YouTube URL formats to embed format
 */
export default function YoutubeEmbed({
    videoUrl,
    title,
    className = '',
    autoplay = false,
}: YoutubeEmbedProps) {
    const { t } = useTranslation('components')
    const [isLoaded, setIsLoaded] = useState(false)
    const resolvedTitle = title ?? t('youtube.defaultTitle')

    // Extract YouTube video ID from various URL formats
    const getYouTubeVideoId = (url: string): string | null => {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
            /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
        ]

        for (const pattern of patterns) {
            const match = url.match(pattern)
            if (match && match[1]) {
                return match[1]
            }
        }
        return null
    }

    const videoId = getYouTubeVideoId(videoUrl)
    const shouldAutoplay = autoplay || isLoaded
    const embedUrl = useMemo(() => {
        if (!videoId) {
            return ''
        }

        const params = new URLSearchParams({
            rel: '0',
            playsinline: '1',
            modestbranding: '1',
            controls: '1',
            enablejsapi: '1',
            origin: typeof window !== 'undefined' ? window.location.origin : '',
        })

        if (shouldAutoplay) {
            params.set('autoplay', '1')
        }

        return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
    }, [shouldAutoplay, videoId])
    const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : ''

    if (!videoId) {
        return (
            <div className="flex items-center justify-center rounded-lg bg-gray-100 p-6 text-gray-500">
                {t('youtube.invalidUrl')}
            </div>
        )
    }

    return (
        <div
            className={`relative overflow-hidden rounded-lg bg-black ${className}`}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="relative pb-[56.25%]">
                {/* Thumbnail with Play Button (shown before video loads) */}
                {!isLoaded && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            setIsLoaded(true)
                        }}
                        aria-label={`Riproduci ${resolvedTitle}`}
                        className="absolute inset-0 flex items-center justify-center bg-black transition-opacity hover:opacity-90"
                    >
                        <img
                            src={thumbnailUrl}
                            alt={resolvedTitle}
                            className="absolute inset-0 h-full w-full object-cover"
                        />
                        <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-red-600 shadow-lg transition-transform hover:scale-110">
                            <svg
                                className="ml-1 h-8 w-8 text-white"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        </div>
                    </button>
                )}

                {/* YouTube iframe (loaded on click) */}
                {isLoaded && (
                    <iframe
                        className="absolute inset-0 h-full w-full"
                        src={embedUrl}
                        title={resolvedTitle}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        sandbox="allow-scripts allow-same-origin allow-presentation"
                        allowFullScreen
                    ></iframe>
                )}
            </div>

            {/* Video Title Overlay */}
            {resolvedTitle && !isLoaded && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                    <p className="text-sm font-semibold text-white">{resolvedTitle}</p>
                </div>
            )}
        </div>
    )
}
