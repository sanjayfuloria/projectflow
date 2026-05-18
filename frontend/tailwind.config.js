/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'sans-serif'],
        display: ['Syne', 'sans-serif'],
      },
      colors: {
        bg:       '#0d0f14',
        surface:  '#161921',
        surface2: '#1e2230',
        surface3: '#252a3a',
        border:   '#2a2f42',
        accent:   '#6c63ff',
        accent2:  '#ff6584',
        accent3:  '#43d9ad',
        accent4:  '#ffc94d',
        text:     '#e8eaf0',
        text2:    '#8b90a7',
        text3:    '#555d7a',
      },
    },
  },
  plugins: [],
}
