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
        // PROCIMEC Corporate Palette
        primary: {
          50: '#EFF4FA',
          100: '#D6E4F0',
          200: '#ADC9E1',
          300: '#84AED2',
          400: '#5B93C3',
          500: '#3278B4',
          600: '#2860A3',
          700: '#1B3A5C', // Main primary
          800: '#142D47',
          900: '#0D1F32',
          DEFAULT: '#1B3A5C',
        },
        accent: {
          50: '#FEF9EE',
          100: '#FEF0D0',
          200: '#FDE0A1',
          300: '#FCD072',
          400: '#FBC043',
          500: '#F5A623', // Main accent
          600: '#D4891A',
          700: '#A66B11',
          800: '#784D08',
          900: '#4A2F00',
          DEFAULT: '#F5A623',
        },
        surface: '#F8FAFC',
        'text-primary': '#1A202C',
        'text-secondary': '#4A5568',
        'text-muted': '#718096',
        border: '#E2E8F0',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6',
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
        soft: '0 2px 15px -3px rgba(0,0,0,0.07), 0 10px 20px -2px rgba(0,0,0,0.04)',
        glow: '0 0 20px rgba(27, 58, 92, 0.15)',
        'glow-accent': '0 0 20px rgba(245, 166, 35, 0.25)',
        card: '0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.08)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
      backgroundImage: {
        'procimec-gradient': 'linear-gradient(135deg, #1B3A5C 0%, #2860A3 50%, #1B3A5C 100%)',
        'accent-gradient': 'linear-gradient(135deg, #F5A623 0%, #FBC043 100%)',
        'hero-pattern': 'radial-gradient(ellipse at top, #2860A3 0%, #1B3A5C 60%)',
      },
    },
  },
  plugins: [],
};

export default config;
