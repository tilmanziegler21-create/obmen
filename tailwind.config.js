/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: '#0A0B0F',
        bg2: '#111318',
        bg3: '#181B22',
        bg4: '#1E212B',
        border: 'rgba(255,255,255,0.06)',
        border2: 'rgba(255,255,255,0.12)',
        border3: 'rgba(255,255,255,0.2)',
        text: '#F0EEE8',
        muted: '#4A4F5E',
        dim: '#2E3240',
        green: '#00D084',
        green2: 'rgba(0,208,132,0.1)',
        green3: 'rgba(0,208,132,0.22)',
        usdt: '#26A17B',
        usdt2: 'rgba(38,161,123,0.12)',
        amber: '#F5A623',
        amber2: 'rgba(245,166,35,0.12)',
        blue: '#4F8EF7',
        blue2: 'rgba(79,142,247,0.12)',
        error: '#F87171'
      },
      borderRadius: {
        'r': '14px',
        'r2': '18px',
        'r3': '22px',
      },
      fontFamily: {
        sans: ['"Syne"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'pulse-fast': 'pulse 1.8s infinite',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in': 'slideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
      keyframes: {
        slideUp: {
          'from': { transform: 'translateY(100%)' },
          'to': { transform: 'translateY(0)' },
        },
        slideIn: {
          'from': { opacity: 0, transform: 'translateY(12px)' },
          'to': { opacity: 1, transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
};