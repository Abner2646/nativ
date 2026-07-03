import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        midnight: '#0F1720',
        sage:     '#6F8F7B',
        sand:     '#E7E2D6',
        offwhite: '#FAFAF8',
        gold:     '#C9A96E',
      },
      fontFamily: {
        satoshi: ['Satoshi', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
