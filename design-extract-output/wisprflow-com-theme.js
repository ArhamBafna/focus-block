// React Theme — extracted from https://wisprflow.com/
// Compatible with: Chakra UI, Stitches, Vanilla Extract, or any CSS-in-JS

/**
 * TypeScript type definition for this theme:
 *
 * interface Theme {
 *   colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
    neutral50: string;
    neutral100: string;
    neutral200: string;
    neutral300: string;
    neutral400: string;
 *   };
 *   fonts: {
    body: string;
 *   };
 *   fontSizes: {
    '15': string;
    '16': string;
    '20': string;
    '22': string;
    '24': string;
    '28': string;
    '32': string;
    '48': string;
    '64': string;
    '120': string;
    '20.16': string;
    '14.4': string;
 *   };
 *   space: {
    '2': string;
    '32': string;
    '48': string;
    '59': string;
    '64': string;
    '70': string;
    '80': string;
    '93': string;
    '104': string;
    '112': string;
    '128': string;
    '192': string;
    '216': string;
    '224': string;
    '256': string;
    '386': string;
 *   };
 *   radii: {
    sm: string;
    md: string;
    lg: string;
    full: string;
 *   };
 *   shadows: {

 *   };
 *   states: {
 *     hover: { opacity: number };
 *     focus: { opacity: number };
 *     active: { opacity: number };
 *     disabled: { opacity: number };
 *   };
 * }
 */

export const theme = {
  "colors": {
    "primary": "#f0d7ff",
    "secondary": "#ffa946",
    "accent": "#034f46",
    "background": "#ffffeb",
    "foreground": "#000000",
    "neutral50": "#1a1a1a",
    "neutral100": "#000000",
    "neutral200": "#8a8a80",
    "neutral300": "#ffffff",
    "neutral400": "#333333"
  },
  "fonts": {
    "body": "'Eb garamond', sans-serif"
  },
  "fontSizes": {
    "15": "15px",
    "16": "16px",
    "20": "20px",
    "22": "22px",
    "24": "24px",
    "28": "28px",
    "32": "32px",
    "48": "48px",
    "64": "64px",
    "120": "120px",
    "20.16": "20.16px",
    "14.4": "14.4px"
  },
  "space": {
    "2": "2px",
    "32": "32px",
    "48": "48px",
    "59": "59px",
    "64": "64px",
    "70": "70px",
    "80": "80px",
    "93": "93px",
    "104": "104px",
    "112": "112px",
    "128": "128px",
    "192": "192px",
    "216": "216px",
    "224": "224px",
    "256": "256px",
    "386": "386px"
  },
  "radii": {
    "sm": "4px",
    "md": "10px",
    "lg": "14px",
    "full": "1000px"
  },
  "shadows": {},
  "states": {
    "hover": {
      "opacity": 0.08
    },
    "focus": {
      "opacity": 0.12
    },
    "active": {
      "opacity": 0.16
    },
    "disabled": {
      "opacity": 0.38
    }
  }
};

// MUI v5 theme
export const muiTheme = {
  "palette": {
    "primary": {
      "main": "#f0d7ff",
      "light": "hsl(278, 100%, 95%)",
      "dark": "hsl(278, 100%, 77%)"
    },
    "secondary": {
      "main": "#ffa946",
      "light": "hsl(32, 100%, 79%)",
      "dark": "hsl(32, 100%, 49%)"
    },
    "background": {
      "default": "#ffffeb",
      "paper": "#034f46"
    },
    "text": {
      "primary": "#000000",
      "secondary": "#1a1a1a"
    }
  },
  "typography": {
    "fontFamily": "'Figtree', sans-serif",
    "h1": {
      "fontSize": "32px",
      "fontWeight": "400",
      "lineHeight": "41.6px"
    },
    "h2": {
      "fontSize": "24px",
      "fontWeight": "400",
      "lineHeight": "31.2px"
    }
  },
  "shape": {
    "borderRadius": 10
  },
  "shadows": []
};

export default theme;
