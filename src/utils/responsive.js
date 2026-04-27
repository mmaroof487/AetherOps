// Responsive design utilities
export const BREAKPOINTS = {
  mobile: 375,
  mobileLarge: 480,
  tablet: 768,
  desktop: 1024,
  desktopLarge: 1440,
  ultra: 1920
}

export const MEDIA_QUERIES = {
  mobile: `(max-width: ${BREAKPOINTS.mobileLarge}px)`,
  tablet: `(min-width: ${BREAKPOINTS.tablet}px) and (max-width: ${BREAKPOINTS.desktop - 1}px)`,
  desktop: `(min-width: ${BREAKPOINTS.desktop}px)`,
  touch: `(hover: none) and (pointer: coarse)`,
  darkMode: `(prefers-color-scheme: dark)`,
  reduceMotion: `(prefers-reduced-motion: reduce)`
}

export const useMediaQuery = (query) => {
  const [matches, setMatches] = React.useState(false)

  React.useEffect(() => {
    const media = window.matchMedia(query)
    if (media.matches !== matches) {
      setMatches(media.matches)
    }

    const listener = () => setMatches(media.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [matches, query])

  return matches
}

// Mobile-first responsive styles generator
export const responsiveStyle = (mobileStyle, tabletStyle = {}, desktopStyle = {}) => {
  return {
    ...mobileStyle,
    '@media (min-width: 768px)': tabletStyle,
    '@media (min-width: 1024px)': desktopStyle
  }
}

// Responsive typography scale
export const typographyScale = {
  h1: {
    mobile: '1.5rem',
    tablet: '2rem',
    desktop: '2.5rem'
  },
  h2: {
    mobile: '1.25rem',
    tablet: '1.75rem',
    desktop: '2rem'
  },
  h3: {
    mobile: '1.1rem',
    tablet: '1.4rem',
    desktop: '1.6rem'
  },
  body: {
    mobile: '0.95rem',
    tablet: '1rem',
    desktop: '1rem'
  },
  small: {
    mobile: '0.8rem',
    tablet: '0.85rem',
    desktop: '0.9rem'
  }
}

// Responsive spacing scale
export const spacingScale = {
  xs: {
    mobile: '4px',
    tablet: '6px',
    desktop: '8px'
  },
  sm: {
    mobile: '8px',
    tablet: '12px',
    desktop: '16px'
  },
  md: {
    mobile: '16px',
    tablet: '20px',
    desktop: '24px'
  },
  lg: {
    mobile: '24px',
    tablet: '32px',
    desktop: '40px'
  },
  xl: {
    mobile: '32px',
    tablet: '40px',
    desktop: '48px'
  }
}

// Container queries support fallback
export const containerResponsive = {
  maxWidth: '100%',
  '@media (min-width: 768px)': {
    maxWidth: '750px'
  },
  '@media (min-width: 1024px)': {
    maxWidth: '960px'
  },
  '@media (min-width: 1440px)': {
    maxWidth: '1200px'
  }
}

// Touch-friendly sizing for mobile
export const TOUCH_TARGET_SIZE = 44 // CSS pixels minimum
export const HOVER_SAFE_PADDING = 8 // pixels

export const touchFriendlyButton = (baseStyle = {}) => ({
  ...baseStyle,
  minWidth: TOUCH_TARGET_SIZE,
  minHeight: TOUCH_TARGET_SIZE,
  padding: `${Math.max(10, TOUCH_TARGET_SIZE / 2)}px ${Math.max(16, TOUCH_TARGET_SIZE)}px`,
  '@media (min-width: 1024px)': {
    minWidth: 'auto',
    minHeight: 'auto'
  }
})

// Responsive grid generator
export const responsiveGrid = (
  mobileColumns = 1,
  tabletColumns = 2,
  desktopColumns = 3,
  gap = '16px'
) => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${mobileColumns}, 1fr)`,
  gap,
  '@media (min-width: 768px)': {
    gridTemplateColumns: `repeat(${tabletColumns}, 1fr)`
  },
  '@media (min-width: 1024px)': {
    gridTemplateColumns: `repeat(${desktopColumns}, 1fr)`
  }
})

// Responsive font size helper
export const responsiveFontSize = (mobile, tablet, desktop) => ({
  fontSize: mobile,
  '@media (min-width: 768px)': { fontSize: tablet },
  '@media (min-width: 1024px)': { fontSize: desktop }
})

// Performance: Reduce animations for users who prefer reduced motion
export const prefers ReducedMotion = (defaultStyle, reducedMotionStyle = {}) => ({
  ...defaultStyle,
  '@media (prefers-reduced-motion: reduce)': reducedMotionStyle
})
