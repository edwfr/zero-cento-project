export default function NotFound() {
    return (
        <div className="flex h-screen flex-col items-center justify-center">
            <h2 className="text-2xl font-bold mb-4">Pagina non trovata</h2>
            <p className="text-gray-600 mb-6">La pagina che stai cercando non esiste</p>
            <a
                href="/"
                className="px-6 py-2 bg-brand-primary text-white rounded-lg hover:bg-blue-600"
            >
                Torna alla Home
            </a>
        </div>
    )
}
