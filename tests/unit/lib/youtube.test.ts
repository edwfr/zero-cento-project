import { describe, it, expect } from 'vitest'
import { getYoutubeVideoId, getYoutubeThumbnailUrl } from '@/lib/youtube'

describe('getYoutubeVideoId', () => {
    it.each([
        ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
        ['https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s', 'dQw4w9WgXcQ'],
        ['https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
        ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
        ['https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
        ['https://youtu.be/dQw4w9WgXcQ?si=abc123', 'dQw4w9WgXcQ'],
        ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
        ['https://youtube.com/shorts/DEGP0tHU0D0?feature=share', 'DEGP0tHU0D0'],
        ['https://www.youtube.com/shorts/DEGP0tHU0D0', 'DEGP0tHU0D0'],
        ['https://www.youtube.com/live/Ab-_Cd12EfG?si=x', 'Ab-_Cd12EfG'],
    ])('extracts the id from %s', (url, expected) => {
        expect(getYoutubeVideoId(url)).toBe(expected)
    })

    it.each([
        '',
        'https://www.youtube.com/',
        'https://www.youtube.com/watch?list=PL123',
        'https://youtube.com/shorts/short',
        'https://vimeo.com/123456789',
    ])('returns null for %s', (url) => {
        expect(getYoutubeVideoId(url)).toBeNull()
    })
})

describe('getYoutubeThumbnailUrl', () => {
    it('builds the mqdefault thumbnail by default', () => {
        expect(getYoutubeThumbnailUrl('https://youtube.com/shorts/DEGP0tHU0D0?feature=share')).toBe(
            'https://img.youtube.com/vi/DEGP0tHU0D0/mqdefault.jpg'
        )
    })

    it('uses the requested quality', () => {
        expect(getYoutubeThumbnailUrl('https://youtu.be/dQw4w9WgXcQ', 'hqdefault')).toBe(
            'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
        )
    })

    it('returns null for a missing or unrecognized url', () => {
        expect(getYoutubeThumbnailUrl(null)).toBeNull()
        expect(getYoutubeThumbnailUrl('https://vimeo.com/123456789')).toBeNull()
    })
})
