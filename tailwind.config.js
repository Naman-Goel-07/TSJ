/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    borderRadius: {
      none: '0',
      slot: '2px',
      panel: '4px',
      pill: '9999px',
    },
    boxShadow: {
      none: 'none',
      slot: 'inset 0 2px 0 0 rgba(3,20,15,0.22)',
      lip: 'inset 0 -2px 0 0 #D9D4C4',
      lifted: '0 0 0 1px #0F4535, 6px 6px 0 0 #051F19',
      ring: '0 0 0 2px #072A21, 0 0 0 4px #F5C542',
    },
    screens: { sm: '480px', md: '768px', lg: '1024px', xl: '1280px' },
    extend: {
      colors: {
        recess:   '#072A21',
        enamel:   '#0B3B2E',
        seam:     '#0F4535',
        lit:      '#134E3C',
        chalk:    '#F2EFE4',
        lip:      '#D9D4C4',
        graphite: '#1C1C1A',
        amber:    '#E8A33D',
        posted:   '#7FCB9B',
        flag:     '#C8452E',
        flare:    '#EF8B76',
        lamp:     '#F5C542',
      },
      fontFamily: {
        display: ['Archivo', 'system-ui', 'sans-serif'],
        body: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs:    ['13px', { lineHeight: '1.45' }],
        base:  ['16px', { lineHeight: '1.55' }],
        lg:    ['20px', { lineHeight: '1.35' }],
        xl:    ['25px', { lineHeight: '1.25' }],
        '2xl': ['31px', { lineHeight: '1.15' }],
        '3xl': ['39px', { lineHeight: '1.10' }],
        board: ['76px', { lineHeight: '0.90', letterSpacing: '-0.02em' }],
      },
      spacing: { gutter: '16px', panel: '24px', row: '56px', stack: '32px' },
      maxWidth: { board: '720px', form: '640px', booth: '1120px' },
      borderWidth: { hair: '1px', inset: '2px' },
      letterSpacing: { sign: '0.08em' },
      zIndex: { header: '40', scrim: '50', drawer: '55', toast: '60', dialog: '70' },
      transitionDuration: { echo: '600ms' },
      keyframes: {
        slotIn: {
          '0%':   { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
      },
      animation: { slotIn: 'slotIn 260ms ease-out' },
    },
  },
  plugins: [],
}
