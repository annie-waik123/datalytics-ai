/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './app/**/*.{js,jsx,ts,tsx,mdx}',
    './components/**/*.{js,jsx,ts,tsx,mdx}',
    './src/**/*.{js,jsx,ts,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#22c55e',
        secondary: '#f97316',
        surface: '#060b14',
        'ds-green': '#22c55e',
        'ds-orange': '#f97316',
      },
      fontFamily: {
        display: ['Space Grotesk', 'Poppins', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
