/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        /* ── Page / surface ── */
        page:           '#faf8f6',   // warm off-white
        'sidebar-border': '#ede9e4', // subtle warm right-border

        /* ── Brand ── */
        primary:   '#D94F2B',   // burnt orange-red – CTAs, active nav, links
        secondary: '#F59E0B',   // amber – rank badges, LC scores, prize tags

        /* ── Text ── */
        'text-primary':   '#1c1917', // near-black warm
        'text-secondary': '#6b6660', // warm muted gray

        /* ── Borders ── */
        'border-dim': '#e8e2dc',    // warm dividers / card borders

        /* ── States ── */
        'accent-pill': '#FFF1ED',  // warm blush – active nav pill, "you" row
        danger:        '#ef4444',
      },
      fontFamily: {
        sans: ['"Inter"', '"DM Sans"', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 4px rgba(0,0,0,0.06)',
      },
      borderRadius: {
        xl:  '12px',
        '2xl': '16px',
      },
    },
  },
  plugins: [],
}
