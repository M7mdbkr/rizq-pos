/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        rizq: {
          charcoal: '#1A1A1A',
          black: '#0F0F0F',
          gold: '#D4AF37',
          'gold-soft': '#E5C158',
          // foreground text — theme-aware so every opacity variant adapts
          light: 'rgb(var(--rz-fg) / <alpha-value>)',
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
        },
      },
      fontFamily: {
        kufi: ['"Reem Kufi"', '"Droid Arabic Kufi"', 'sans-serif'],
        body: ['Tajawal', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      boxShadow: {
        gold: '0 0 0 1px rgba(212,175,55,0.4), 0 8px 24px rgba(212,175,55,0.12)',
      },
    },
  },
  plugins: [],
}
