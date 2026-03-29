import type { Config } from 'tailwindcss'

const config: Config = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    primary: '#FFA700',
                    secondary: '#000000',
                    accent: '#FFFFFF',
                },
                week: {
                    test: {
                        light: '#fecaca',
                        DEFAULT: '#ef4444',
                        dark: '#dc2626',
                    },
                    deload: {
                        light: '#6ee7b7',
                        DEFAULT: '#10b981',
                        dark: '#059669',
                    },
                },
            },
            spacing: {
                '18': '4.5rem',
                '88': '22rem',
            },
            minHeight: {
                touch: '44px', // Touch-friendly minimum for mobile
            },
            minWidth: {
                touch: '44px',
            },
        },
    },
    plugins: [],
}

export default config
