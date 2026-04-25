import { createStitches } from '@stitches/react';

export const {
  styled,
  css,
  globalCss,
  keyframes,
  getCssText,
  theme,
  createTheme,
  config,
} = createStitches({
  theme: {
    colors: {
      bg: '#F2F2F2',
      surface: '#FFFFFF',
      hover: 'rgba(33,64,94,.06)',
      navy: '#21405E',
      navyDk: '#1A3551',
      gold: '#D9A648',
      goldDk: '#C08A30',
      neutral: '#4A4A4A',
      text: '#21405E',
      muted: 'rgba(74,74,74,.75)',
      border: 'rgba(33,64,94,.12)',
      borderMd: 'rgba(33,64,94,.25)',
      green: '#2D8B5A',
      red: '#C0392B',
    },
    transitions: {
      fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
      lazy: '350ms cubic-bezier(0.4, 0, 0.2, 1)',
      bounce: '500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
    shadows: {
      sm: '0 2px 8px rgba(33,64,94,0.06)',
      md: '0 8px 24px rgba(33,64,94,0.12)',
      glow: '0 0 20px $colors$gold',
    }
  },
  utils: {
    paddingX: (value) => ({ paddingLeft: value, paddingRight: value }),
    paddingY: (value) => ({ paddingTop: value, paddingBottom: value }),
    marginX: (value) => ({ marginLeft: value, marginRight: value }),
    marginY: (value) => ({ marginTop: value, marginBottom: value }),
  },
});

export const darkTheme = createTheme('dark-theme', {
  colors: {
    bg: '#0D1B2A',
    surface: '#152232',
    hover: 'rgba(107,179,210,.08)',
    navy: '#7BB8E0',
    navyDk: '#5A9EC8',
    gold: '#F0C060',
    goldDk: '#D4A040',
    neutral: '#A0B0C0',
    text: '#C8DCF0',
    muted: 'rgba(160,195,225,.65)',
    border: 'rgba(80,140,200,.18)',
    borderMd: 'rgba(80,140,200,.32)',
    green: '#4CAF82',
    red: '#E05A4A',
  },
  shadows: {
    sm: '0 2px 8px rgba(0,0,0,0.3)',
    md: '0 8px 24px rgba(0,0,0,0.5)',
    glow: '0 0 20px $colors$gold',
  }
});

export const fadeUp = keyframes({
  '0%': { opacity: 0, transform: 'translateY(15px)' },
  '100%': { opacity: 1, transform: 'translateY(0)' },
});

export const scaleIn = keyframes({
  '0%': { opacity: 0, transform: 'scale(0.95)' },
  '100%': { opacity: 1, transform: 'scale(1)' },
});

export const pulseGlow = keyframes({
  '0%': { boxShadow: '0 0 0 0 rgba(217, 166, 72, 0.4)' },
  '70%': { boxShadow: '0 0 0 10px rgba(217, 166, 72, 0)' },
  '100%': { boxShadow: '0 0 0 0 rgba(217, 166, 72, 0)' },
});

export const flowDot = keyframes({
  '0%': { offsetDistance: '0%' },
  '100%': { offsetDistance: '100%' },
});

export const globalStyles = globalCss({
  '*': { boxSizing: 'border-box' },
  'body': {
    margin: 0,
    padding: 0,
    fontFamily: '"DM Sans", system-ui, sans-serif',
    backgroundColor: '$bg',
    color: '$text',
    transition: 'background-color $lazy, color $lazy',
    overflowX: 'hidden',
  },
  'button': {
    fontFamily: 'inherit',
    border: 'none',
    margin: 0,
    padding: 0,
    width: 'auto',
    overflow: 'visible',
    background: 'transparent',
    color: 'inherit',
    lineHeight: 'normal',
    WebkitFontSmoothing: 'inherit',
    MozOsxFontSmoothing: 'inherit',
    WebkitAppearance: 'none',
  },
});
