import LoadingSpinner from '@/components/LoadingSpinner'

export default function Loading() {
    return (
        <div className="flex items-center justify-center py-16">
            <div className="rounded-2xl border border-brand-primary/20 bg-brand-primary/5 px-8 py-10 shadow-sm">
                <LoadingSpinner size="lg" label="Caricamento setup programma..." />
            </div>
        </div>
    )
}