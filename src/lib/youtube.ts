// Matches watch, embed, shorts, live and youtu.be URLs; video IDs are always 11 chars
const YOUTUBE_VIDEO_ID_PATTERN =
    /(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/

export function getYoutubeVideoId(url: string): string | null {
    return url.match(YOUTUBE_VIDEO_ID_PATTERN)?.[1] ?? null
}

export function getYoutubeThumbnailUrl(
    url: string | null,
    quality: 'mqdefault' | 'hqdefault' = 'mqdefault'
): string | null {
    const videoId = url ? getYoutubeVideoId(url) : null
    return videoId ? `https://img.youtube.com/vi/${videoId}/${quality}.jpg` : null
}
