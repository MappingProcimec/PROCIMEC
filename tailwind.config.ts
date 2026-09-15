import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'media',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // PROCIMEC Corporate Palette (Derived from Official Logo public/logo.png)
        primary: {
          50: '#F5F6F8',
          100: '#E6E8EC',
          200: '#CDD1D9',
          300: '#9DA4B3',
          400: '#656D7E',
          500: '#414856',
          600: '#2B2F38', // Mid charcoal
          700: '#1E2229', // Main primary (Charcoal lettering)
          800: '#15181D',
          900: '#0C0E11', // Deep instrumental console
          DEFAULT: '#1E2229',
        },
        accent: {
          50: '#FEF9EC',
          100: '#FEF1CE',
          200: '#FDE19B',
          300: '#FCCD61',
          400: '#FABA2B',
          500: '#EAA023', // Main accent (Radar pulse from Logo)
          600: '#CE8315',
          700: '#A4610F',
          800: '#844D12',
          900: '#4A2A07',
          DEFAULT: '#EAA023',
        },
        surface: '#F8FAFC',
        'text-primary': '#0F172A',
        'text-secondary': '#475569',
        'text-muted': '#94A3B8',
        border: '#E2E8F0',
        'border-subtle': '#F1F5F9',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#0284C7',
        // Subsurface Utility Marking Standards
        utility: {
          water: '#0284C7',
          gas: '#EAB308',
          power: '#DC2626',
          telecom: '#EA580C',
          sewer: '#10B981',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        soft: '0 2px 15px -3px rgba(30,34,41,0.06), 0 10px 20px -2px rgba(30,34,41,0.03)',
        glow: '0 0 20px rgba(30, 34, 41, 0.18)',
        'glow-accent': '0 0 20px rgba(234, 160, 35, 0.28)',
        card: '0 1px 3px rgba(30,34,41,0.05), 0 4px 12px rgba(30,34,41,0.06)',
      },
      transitionTimingFunction: {
        'out-quint': 'cubic-bezier(0.23, 1, 0.32, 1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s cubic-bezier(0.23, 1, 0.32, 1)',
        'slide-up': 'slideUp 0.25s cubic-bezier(0.23, 1, 0.32, 1)',
        'slide-in-right': 'slideInRight 0.25s cubic-bezier(0.23, 1, 0.32, 1)',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
      backgroundImage: {
        'procimec-gradient': 'linear-gradient(135deg, #1E2229 0%, #2B2F38 50%, #15181D 100%)',
        'accent-gradient': 'linear-gradient(135deg, #EAA023 0%, #FABA2B 100%)',
        'hero-pattern': 'radial-gradient(ellipse at top, #2B2F38 0%, #1E2229 70%)',
      },
    },
  },
  plugins: [],
};

export default config;
