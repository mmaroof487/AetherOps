// Shared theme and color configuration
export const CL = {  // LIGHT palette
  bg:      '#F2F2F2',
  surface: '#FFFFFF',
  hover:   'rgba(33,64,94,.06)',
  navy:    '#21405E',
  navyDk:  '#1A3551',
  gold:    '#D9A648',
  goldDk:  '#C08A30',
  neutral: '#4A4A4A',
  text:    '#21405E',
  muted:   'rgba(74,74,74,.75)',
  border:  'rgba(33,64,94,.12)',
  borderMd:'rgba(33,64,94,.25)',
  green:   '#2D8B5A',
  red:     '#C0392B',
}

export const CD = {  // DARK palette
  bg:      '#0D1B2A',
  surface: '#152232',
  hover:   'rgba(107,179,210,.08)',
  navy:    '#7BB8E0',
  navyDk:  '#5A9EC8',
  gold:    '#F0C060',
  goldDk:  '#D4A040',
  neutral: '#A0B0C0',
  text:    '#C8DCF0',
  muted:   'rgba(160,195,225,.65)',
  border:  'rgba(80,140,200,.18)',
  borderMd:'rgba(80,140,200,.32)',
  green:   '#4CAF82',
  red:     '#E05A4A',
}

// Mutable — swapped on dark mode toggle; all components re-render and pick up new values
let C = { ...CL }
export { C }
export const setTheme = (theme) => { Object.assign(C, theme) }
