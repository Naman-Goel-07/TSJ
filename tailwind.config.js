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
      slot: 'inset 0 1px 0 0 rgba(255,255,255,0.045)',
      lip: 'inset 0 -1px 0 0 rgba(255,255,255,0.035)',
      lifted: '0 0 0 1px #23232E, 0 24px 48px -16px rgba(0,0,0,0.85)',
      ring: '0 0 0 2px #050507, 0 0 0 4px #FF2E55',
      // The primary control is a ring of light around empty space.
      glow: '0 0 22px rgba(255,46,85,0.20), inset 0 0 22px rgba(255,46,85,0.10)',
      'glow-lg': '0 0 36px rgba(255,46,85,0.36), inset 0 0 26px rgba(255,46,85,0.16)',
      'glow-danger': '0 0 24px rgba(255,92,56,0.28)',
    },
    screens: { sm: '480px', md: '768px', lg: '1024px', xl: '1280px' },
    extend: {
      colors: {
        recess:   '#050507',  // the void — the page itself
        enamel:   '#0B0B12',  // a surface, only where something must be held
        lit:      '#12121B',  // raised, or hovered
        seam:     '#23232E',  // hairline
        lip:      '#34343F',  // lit hairline

        chalk:    '#F2F2F5',  // text
        muted:    '#7C7C8A',  // secondary text
        dim:      '#4A4A57',  // tertiary, disabled, scroll hints
        graphite: '#050507',  // text on a solid fill

        lamp:     '#FF2E55',  // signal — the one accent, reserved for action
        ember:    '#7E1128',  // signal, dimmed to a resting state
        cyan:     '#35D6FF',  // aberration, information, "sent back"
        posted:   '#3BE8A6',  // verified
        amber:    '#FFC24D',  // in the queue
        flag:     '#FF5C38',  // destructive
        flare:    '#FF8A6B',  // error text
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
      },
      animation: {
        slotIn: 'slotIn 260ms ease-out',
        signal: 'signalPulse 2.4s ease-in-out infinite',
        scan: 'scanRoll 9s linear infinite',
      },
    },
  },
  plugins: [],
}
