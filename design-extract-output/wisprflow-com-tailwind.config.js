/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
    colors: {
        primary: {
            '50': 'hsl(278, 100%, 97%)',
            '100': 'hsl(278, 100%, 94%)',
            '200': 'hsl(278, 100%, 86%)',
            '300': 'hsl(278, 100%, 76%)',
            '400': 'hsl(278, 100%, 64%)',
            '500': 'hsl(278, 100%, 50%)',
            '600': 'hsl(278, 100%, 40%)',
            '700': 'hsl(278, 100%, 32%)',
            '800': 'hsl(278, 100%, 24%)',
            '900': 'hsl(278, 100%, 16%)',
            '950': 'hsl(278, 100%, 10%)',
            DEFAULT: '#f0d7ff'
        },
        secondary: {
            '50': 'hsl(32, 100%, 97%)',
            '100': 'hsl(32, 100%, 94%)',
            '200': 'hsl(32, 100%, 86%)',
            '300': 'hsl(32, 100%, 76%)',
            '400': 'hsl(32, 100%, 64%)',
            '500': 'hsl(32, 100%, 50%)',
            '600': 'hsl(32, 100%, 40%)',
            '700': 'hsl(32, 100%, 32%)',
            '800': 'hsl(32, 100%, 24%)',
            '900': 'hsl(32, 100%, 16%)',
            '950': 'hsl(32, 100%, 10%)',
            DEFAULT: '#ffa946'
        },
        accent: {
            '50': 'hsl(173, 93%, 97%)',
            '100': 'hsl(173, 93%, 94%)',
            '200': 'hsl(173, 93%, 86%)',
            '300': 'hsl(173, 93%, 76%)',
            '400': 'hsl(173, 93%, 64%)',
            '500': 'hsl(173, 93%, 50%)',
            '600': 'hsl(173, 93%, 40%)',
            '700': 'hsl(173, 93%, 32%)',
            '800': 'hsl(173, 93%, 24%)',
            '900': 'hsl(173, 93%, 16%)',
            '950': 'hsl(173, 93%, 10%)',
            DEFAULT: '#034f46'
        },
        'neutral-50': '#1a1a1a',
        'neutral-100': '#000000',
        'neutral-200': '#8a8a80',
        'neutral-300': '#ffffff',
        'neutral-400': '#333333',
        background: '#ffffeb',
        foreground: '#000000'
    },
    fontFamily: {
        body: [
            'Figtree',
            'sans-serif'
        ],
        heading: [
            'Eb garamond',
            'sans-serif'
        ]
    },
    fontSize: {
        '12': [
            '12px',
            {
                lineHeight: '12px'
            }
        ],
        '14': [
            '14px',
            {
                lineHeight: '21px'
            }
        ],
        '15': [
            '15px',
            {
                lineHeight: '19.5px'
            }
        ],
        '16': [
            '16px',
            {
                lineHeight: 'normal'
            }
        ],
        '20': [
            '20px',
            {
                lineHeight: '30px'
            }
        ],
        '22': [
            '22px',
            {
                lineHeight: '28.6px'
            }
        ],
        '24': [
            '24px',
            {
                lineHeight: '31.2px'
            }
        ],
        '28': [
            '28px',
            {
                lineHeight: '36.4px'
            }
        ],
        '32': [
            '32px',
            {
                lineHeight: '41.6px',
                letterSpacing: '-0.96px'
            }
        ],
        '48': [
            '48px',
            {
                lineHeight: '45.6px',
                letterSpacing: '-1.44px'
            }
        ],
        '64': [
            '64px',
            {
                lineHeight: '60.8px',
                letterSpacing: '-1.92px'
            }
        ],
        '120': [
            '120px',
            {
                lineHeight: '102px',
                letterSpacing: '-6px'
            }
        ],
        '20.16': [
            '20.16px',
            {
                lineHeight: '26.208px'
            }
        ],
        '14.4': [
            '14.4px',
            {
                lineHeight: '18.72px'
            }
        ]
    },
    spacing: {
        '1': '2px',
        '16': '32px',
        '24': '48px',
        '32': '64px',
        '35': '70px',
        '40': '80px',
        '52': '104px',
        '56': '112px',
        '64': '128px',
        '96': '192px',
        '108': '216px',
        '112': '224px',
        '128': '256px',
        '193': '386px',
        '59px': '59px',
        '93px': '93px'
    },
    borderRadius: {
        sm: '4px',
        md: '10px',
        lg: '14px',
        full: '1000px'
    },
    screens: {
        lg: '1085px'
    },
    transitionDuration: {
        '100': '0.1s',
        '200': '0.2s',
        '300': '0.3s'
    },
    container: {
        center: true,
        padding: '0px'
    },
    maxWidth: {
        container: '992px'
    }
},
  },
};
