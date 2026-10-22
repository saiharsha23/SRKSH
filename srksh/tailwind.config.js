/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ivory: '#FBF6EC',
        cream: '#F4EBD9',
        sand: '#E9DCC3',
        bark: { DEFAULT: '#3B2A20', soft: '#6B5444', faint: '#9A8472' },
        saffron: { DEFAULT: '#D98E2B', deep: '#B9741A', soft: '#F3D9A8' },
        terracotta: { DEFAULT: '#B5593C', deep: '#964429', soft: '#EBC9BB' },
        gold: '#C2A15A',
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: { soft: '0 10px 30px -12px rgba(59,42,32,0.25)' },
      keyframes: { rise: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'none' } } },
      animation: { rise: 'rise .6s ease-out both' },
    },
  },
  plugins: [],
}
