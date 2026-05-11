/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        void: '#020203',
        accent: {
          indigo: '#6366f1',
          violet: '#8b5cf6',
          cyan: '#22d3ee',
          glass: 'rgba(99, 128, 255, 0.15)',
        },
        'glass-border': 'rgba(99, 128, 255, 0.15)',

        dark: {
          950: '#050508',
          900: '#0a0a0f',
          800: '#12121a',
          700: '#1a1a26',
        }
      },
      fontFamily: {
        display: ['"Syne"', 'sans-serif'],
        body: ['"Outfit"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      }
    }
  },
  plugins: []
}

