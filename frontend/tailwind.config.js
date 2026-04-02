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
        primary: '#FF6B35',
        surface: '#0d1117',
      },
      fontFamily: {
        display: ['Space Grotesk', 'Poppins', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
