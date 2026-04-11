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
                    'primary-hover': '#E69500',
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
                state: {
                    error: {
                        light: '#fecaca',
                        DEFAULT: '#ef4444',
                        dark: '#dc2626',
                    },
                    success: {
                        light: '#d1fae5',
                        DEFAULT: '#10b981',
                        dark: '#059669',
                    },
                    warning: {
                        light: '#fef3c7',
                        DEFAULT: '#f59e0b',
                        dark: '#d97706',
                    },
                    info: {
                        light: '#dbeafe',
                        DEFAULT: '#3b82f6',
                        dark: '#2563eb',
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
