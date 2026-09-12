/** @type {import('tailwindcss').Config} */

/**
 *
 * Nine pages reference bg-recess, text-chalk, border-seam, bg-lamp and the rest.
 * Renaming them means editing every file before a single pixel can be judged, so
 * the names stay and the values change. `recess` still means "the furthest back
 * surface" — it just happens to be void now instead of dark green. When the
 * reskin is settled the vocabulary can be renamed in one pass, or left alone.
 *
 * Two values shift meaning and are worth reading twice:
 *   lamp  was signal yellow on a chalkboard. It is now signal rose, and it is
 *         reserved: one lamp-coloured control per screen, and it is the thing
 *         the person came to do.
 *   lip   was the bright chalk edge under a slot. In void there is no chalk, so
 *         it is now the lit hairline that separates a raised plate from its
 *         surroundings.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    borderRadius: {
      none: '0',
      slot: '4px',
      panel: '6px',
      pill: '9999px',
    },
    boxShadow: {
      none: 'none',
      // A plate catches a little light on its top edge and loses it at the base.
      slot: 'inset 0 1px 0 0 rgba(242,214,197,0.06)',
      lip: 'inset 0 -1px 0 0 rgba(242,214,197,0.04)',
      lifted: '0 0 0 1px #4A142A, 0 24px 48px -16px rgba(0,0,0,0.85)',
      ring: '0 0 0 2px #100812, 0 0 0 4px #F2D6C5',
      // The primary control is a ring of light around empty space.
      glow: '0 0 30px -8px #B83F5A, inset 0 0 22px -14px #fff',
      'glow-lg': '0 0 44px -6px #B83F5A, inset 0 0 24px -12px #fff',
      'glow-danger': '0 0 26px -10px rgba(154,113,128,0.5)',
    },
    screens: { sm: '480px', md: '768px', lg: '1024px', xl: '1280px' },
    extend: {
      colors: {
        recess:   '#100812',  // the void — the page itself
        enamel:   '#1C0B1C',  // a surface, only where something must be held
        lit:      '#160a17',  // raised, or hovered
        seam:     '#4A142A',  // hairline
        lip:      '#6B2037',  // lit hairline

        chalk:    '#F7E8DC',  // text
        muted:    '#9A7180',  // secondary text
        dim:      '#71545f',  // tertiary, disabled, scroll hints
        graphite: '#100812',  // text on a solid fill

        lamp:     '#B83F5A',  // signal — the one accent, reserved for action
        ember:    '#6B2037',  // signal, dimmed to a resting state
        cyan:     '#F2D6C5',  // aberration, information, "sent back"
        posted:   '#D8798B',  // verified
        amber:    '#F2D6C5',  // in the queue
        flag:     '#9A7180',  // destructive
        flare:    '#F2D6C5',  // error text
      },
      fontFamily: {
        display: ['Archivo', 'system-ui', 'sans-serif'],
        body: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
        // Instrumentation voice: labels, buttons, status readings, timestamps.
        mono: ['"Martian Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        label: ['11px', { lineHeight: '1', letterSpacing: '0.22em' }],
        xs:    ['13px', { lineHeight: '1.45' }],
        base:  ['16px', { lineHeight: '1.55' }],
        lg:    ['20px', { lineHeight: '1.35' }],
        xl:    ['25px', { lineHeight: '1.25' }],
        '2xl': ['31px', { lineHeight: '1.15' }],
        '3xl': ['39px', { lineHeight: '1.10' }],
        board: ['clamp(64px, 13vw, 116px)', { lineHeight: '0.90', letterSpacing: '-0.01em' }],
        hero:  ['clamp(64px, 17.5vw, 168px)', { lineHeight: '0.86', letterSpacing: '0.01em' }],
      },
      spacing: { gutter: '16px', panel: '22px', row: '64px', stack: '32px' },
      maxWidth: { board: '720px', form: '640px', booth: '1120px' },
      borderWidth: { hair: '1px', inset: '1px' },
      letterSpacing: { sign: '0.08em', label: '0.22em' },
      zIndex: { header: '40', scrim: '50', drawer: '55', toast: '60', dialog: '70' },
      transitionDuration: { echo: '600ms' },
      keyframes: {
        slotIn: {
          '0%':   { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        signalPulse: {
          '0%, 100%': { opacity: '0.35' },
          '50%':      { opacity: '1' },
        },
        scanRoll: {
          from: { backgroundPositionY: '0' },
          to:   { backgroundPositionY: '-60px' },
        },
        orbit: {
          '0%':   { transform: 'rotate(0deg)   translateX(var(--orbit-rx)) rotate(0deg)' },
          '100%': { transform: 'rotate(360deg) translateX(var(--orbit-rx)) rotate(-360deg)' },
        },
        fadeScaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.92) translateY(18px)' },
          '100%': { opacity: '1', transform: 'scale(1)    translateY(0)' },
        },
      },
      animation: {
        slotIn: 'slotIn 260ms ease-out',
        signal: 'signalPulse 2.4s ease-in-out infinite',
        scan: 'scanRoll 9s linear infinite',
        orbit: 'orbit 8s linear infinite',
        'card-in': 'fadeScaleIn 600ms ease-out both',
      },
    },
  },
  plugins: [],
}
