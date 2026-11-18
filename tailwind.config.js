export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito', 'ui-rounded', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#25334A',
        mint: '#DDF5E9',
        sunshine: '#FFE7A3',
        coral: '#FF8B77',
        lavender: '#E9E2FF',
      },
      boxShadow: {
        soft: '0 12px 30px rgba(37, 51, 74, 0.08)',
      },
    },
  },
  plugins: [],
}
