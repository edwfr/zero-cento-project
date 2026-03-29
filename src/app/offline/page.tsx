export default function OfflinePage() {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="max-w-md w-full text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-[#FFA700]/10 rounded-2xl mb-6">
                    <svg
                        className="w-10 h-10 text-[#FFA700]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M12 12h.01M8.464 15.536a5 5 0 010-7.072M5.636 18.364a9 9 0 010-12.728"
                        />
                    </svg>
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-2">Sei offline</h1>
                <p className="text-gray-500 text-sm mb-6">
                    La connessione internet non è disponibile. Alcune funzionalità potrebbero non
                    essere accessibili.
                </p>

                <button
                    onClick={() => window.location.reload()}
                    className="bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold px-8 py-3 rounded-xl transition-colors"
                >
                    Riprova
                </button>

                <p className="text-gray-400 text-xs mt-6">
                    ZeroCento Training Platform
                </p>
            </div>
        </div>
    )
}
