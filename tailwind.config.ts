import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1280px' },
    },
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        surface: 'hsl(var(--surface))',
        'surface-2': 'hsl(var(--surface-2))',
        border: 'hsl(var(--border))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          glow: 'hsl(var(--primary-glow))',
        },
        accent: 'hsl(var(--accent))',
        destructive: 'hsl(var(--destructive))',
        text: {
          DEFAULT: 'hsl(var(--text))',
          muted: 'hsl(var(--text-muted))',
          dim: 'hsl(var(--text-dim))',
        },
      },
      fontFamily: {
        sans: ['"Pretendard Variable"', 'Pretendard', 'system-ui', 'sans-serif'],
        display: ['var(--font-syne)', '"Pretendard Variable"', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 2.4s ease-in-out infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        // 트랙 ⑤-2a — keyframes 는 globals.css 에 정의 (CSS 변수 호환)
        'orb-pulse':  'orb-pulse 1.5s ease-in-out infinite',
        'orb-bob':    'orb-bob 0.6s ease-in-out infinite',
        'card-enter': 'card-enter 0.4s ease-out',
        // 트랙 ⑤-5a — Aha 모먼트 (isKeyPoint 1회 발광)
        'keypoint-pulse': 'keypoint-pulse 0.8s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
