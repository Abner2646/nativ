export type ButtonStyle = 'rounded' | 'sharp' | 'pill'

export interface Theme {
  bg:          string
  surface:     string
  input:       string
  border:      string
  text:        string
  muted:       string
  faint:       string
  primary:     string
  secondary:   string
  primaryText: string
  btnRadius:   string
  font:        string
  fontFamily:  string
  isDark:      boolean
  errorBg:     string
  errorBorder: string
  errorText:   string
}

function luminance(hex: string): number {
  try {
    const h = hex.replace('#', '')
    const r = parseInt(h.slice(0, 2), 16) / 255
    const g = parseInt(h.slice(2, 4), 16) / 255
    const b = parseInt(h.slice(4, 6), 16) / 255
    return 0.299 * r + 0.587 * g + 0.114 * b
  } catch { return 0.5 }
}

function radiusForStyle(style?: string): string {
  if (style === 'sharp') return '0px'
  if (style === 'pill')  return '9999px'
  return '0.625rem'
}

const SERIF_FONTS = new Set([
  'Merriweather', 'Playfair Display', 'Lora', 'EB Garamond',
  'Cormorant Garamond', 'Libre Baskerville',
])

function fontStack(name: string): string {
  const clean = name.replace(/['"]/g, '').trim()
  const fallback = SERIF_FONTS.has(clean) ? 'serif' : 'sans-serif'
  return `'${clean}', ${fallback}`
}

export function buildTheme(settings: {
  background_color?: string | null
  primary_color?: string | null
  secondary_color?: string | null
  font_family?: string | null
  button_style?: string | null
}): Theme {
  const bg        = settings.background_color || '#111015'
  const primary   = settings.primary_color    || '#C9A96E'
  const secondary = settings.secondary_color  || '#6F8F7B'
  const fontName  = settings.font_family      || 'Inter'

  const isDark = luminance(bg) < 0.45
  const textRGB = isDark ? '242,239,233' : '15,23,32'
  const text    = isDark ? '#F2EFE9' : '#0F1720'

  return {
    bg,
    surface:     isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    input:       isDark ? 'rgba(0,0,0,0.40)'       : 'rgba(0,0,0,0.06)',
    border:      isDark ? 'rgba(255,255,255,0.08)'  : 'rgba(0,0,0,0.10)',
    text,
    muted:       `rgba(${textRGB},0.48)`,
    faint:       `rgba(${textRGB},0.25)`,
    primary,
    secondary,
    primaryText: luminance(primary) > 0.5 ? '#0F1720' : '#FAFAF8',
    btnRadius:   radiusForStyle(settings.button_style ?? undefined),
    font:        fontStack(fontName),
    fontFamily:  fontName,
    isDark,
    errorBg:     'rgba(220,80,70,0.08)',
    errorBorder: 'rgba(220,80,70,0.25)',
    errorText:   '#f07070',
  }
}
