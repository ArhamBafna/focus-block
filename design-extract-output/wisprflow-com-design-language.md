# Design Language: Wispr Flow | Effortless Voice Dictation

> Extracted from `https://wisprflow.com/` on July 6, 2026
> 5000 elements analyzed

This document describes the complete design language of the website. It is structured for AI/LLM consumption — use it to faithfully recreate the visual design in any framework.

## Color Palette

### Primary Colors

| Role | Hex | RGB | HSL | Usage Count |
|------|-----|-----|-----|-------------|
| Primary | `#f0d7ff` | rgb(240, 215, 255) | hsl(278, 100%, 92%) | 36 |
| Secondary | `#ffa946` | rgb(255, 169, 70) | hsl(32, 100%, 64%) | 2 |
| Accent | `#034f46` | rgb(3, 79, 70) | hsl(173, 93%, 16%) | 3 |

### Neutral Colors

| Hex | HSL | Usage Count |
|-----|-----|-------------|
| `#1a1a1a` | hsl(0, 0%, 10%) | 8793 |
| `#000000` | hsl(0, 0%, 0%) | 144 |
| `#8a8a80` | hsl(60, 4%, 52%) | 8 |
| `#ffffff` | hsl(0, 0%, 100%) | 8 |
| `#333333` | hsl(0, 0%, 20%) | 4 |

### Background Colors

Used on large-area elements: `#ffffeb`, `#034f46`, `#1a1a1a`

### Text Colors

Text color palette: `#000000`, `#1a1a1a`, `#ffffeb`, `#333333`, `#222222`, `#8a8a80`, `#ffffff`, `#f0d7ff`

### Full Color Inventory

| Hex | Contexts | Count |
|-----|----------|-------|
| `#1a1a1a` | text, border, background | 8793 |
| `#ffffeb` | background, text, border | 1039 |
| `#000000` | text, border | 144 |
| `#f0d7ff` | background, text, border | 36 |
| `#8a8a80` | text, border | 8 |
| `#ffffff` | text, border | 8 |
| `#e4e4d0` | border, background | 7 |
| `#333333` | text, border | 4 |
| `#034f46` | background | 3 |
| `#ffa946` | background | 2 |

## Typography

### Font Families

- **Figtree** — used for body (4890 elements)
- **Eb garamond** — used for all (38 elements)

### Type Scale

| Size (px) | Size (rem) | Weight | Line Height | Letter Spacing | Used On |
|-----------|------------|--------|-------------|----------------|---------|
| 120px | 7.5rem | 400 | 102px | -6px | h1, span, h2, div |
| 64px | 4rem | 400 | 60.8px | -1.92px | h2 |
| 48px | 3rem | 400 | 45.6px | -1.44px | h3, em |
| 32px | 2rem | 400 | 41.6px | -0.96px | h3, br |
| 28px | 1.75rem | 400 | 36.4px | normal | g, path |
| 24px | 1.5rem | 400 | 31.2px | normal | div, style, svg, path |
| 22px | 1.375rem | 400 | 28.6px | normal | div, svg, path, text |
| 20.16px | 1.26rem | 400 | 26.208px | normal | div, svg, path, text |
| 20px | 1.25rem | 600 | 30px | normal | div, p, a, g |
| 16px | 1rem | 400 | normal | normal | html, head, style, meta |
| 15px | 0.9375rem | 400 | 19.5px | normal | g, path |
| 14.4px | 0.9rem | 400 | 18.72px | normal | div |
| 14px | 0.875rem | 400 | 21px | normal | div, br |
| 12px | 0.75rem | 600 | 12px | normal | div |

### Heading Scale

```css
h1 { font-size: 120px; font-weight: 400; line-height: 102px; }
h2 { font-size: 64px; font-weight: 400; line-height: 60.8px; }
h3 { font-size: 48px; font-weight: 400; line-height: 45.6px; }
h3 { font-size: 32px; font-weight: 400; line-height: 41.6px; }
```

### Body Text

```css
body { font-size: 16px; font-weight: 400; line-height: normal; }
```

### Font Weights in Use

`400` (3733x), `600` (1188x), `700` (51x), `500` (28x)

## Spacing

**Base unit:** 2px

| Token | Value | Rem |
|-------|-------|-----|
| spacing-2 | 2px | 0.125rem |
| spacing-32 | 32px | 2rem |
| spacing-48 | 48px | 3rem |
| spacing-59 | 59px | 3.6875rem |
| spacing-64 | 64px | 4rem |
| spacing-70 | 70px | 4.375rem |
| spacing-80 | 80px | 5rem |
| spacing-93 | 93px | 5.8125rem |
| spacing-104 | 104px | 6.5rem |
| spacing-112 | 112px | 7rem |
| spacing-128 | 128px | 8rem |
| spacing-192 | 192px | 12rem |
| spacing-216 | 216px | 13.5rem |
| spacing-224 | 224px | 14rem |
| spacing-256 | 256px | 16rem |
| spacing-386 | 386px | 24.125rem |

## Border Radii

| Label | Value | Count |
|-------|-------|-------|
| sm | 4px | 2 |
| md | 10px | 2 |
| lg | 14px | 43 |
| full | 40px | 4 |
| full | 64px | 1 |
| full | 80px | 2 |
| full | 100px | 1 |
| full | 992px | 4 |
| full | 1000px | 18 |

## CSS Custom Properties

### Colors

```css
--background-color--background-primary: var(--base-color--lumen);
--text-color--text-primary: var(--base-color--vast);
--_text-collection---font--primary-font: "Eb garamond",Arial,sans-serif;
--text-color--text-alternate: var(--base-color-neutral--white);
--text-color--text-secondary: var(--base-color--lumen);
--background-color--background-success: var(--base-color-system--success-green);
--text-color--text-success: var(--base-color-system--success-green-dark);
--border-color--border-primary: #1a1a1a4d;
--background-color--background-alternate: var(--base-color--white);
--background-color--background-secondary: var(--base-color--dawn);
--border-color--border-secondary: var(--base-color--vast);
--base-color-system--error-red-dark: var(--base-color--pulse);
--base-color--pulse: #7f1c34;
--link-color--link-primary: var(--base-color--dawn);
--base-color-neutral--neutral-darkest: #111;
--background-color--background-tertiary: var(--base-color--vast);
--background-color--background-error: var(--base-color-system--error-red);
--text-color--text-error: var(--base-color-system--error-red-dark);
--base-color--lumen: #ffffeb;
--base-color--fathom: #034f46;
--base-color--glow: #ffa946;
--background-color--background-warning: var(--base-color-system--warning-yellow);
--text-color--text-warning: var(--base-color-system--warning-yellow-dark);
--base-color--lumen-dark: #e4e4d0;
--text-color--text-tertiary: var(--base-color--dawn);
--base-color--dawn: #f0d7ff;
--base-color--vast: #1a1a1a;
--base-color--white: #fff;
--base-color-system--success-green: #cef5ca;
--base-color-neutral--black: #000;
--base-color-neutral--white: #fff;
--base-color-neutral--neutral-lightest: #eee;
--base-color-neutral--neutral-lighter: #ccc;
--base-color-neutral--neutral-light: #aaa;
--base-color-neutral--neutral: #666;
--base-color-neutral--neutral-dark: #444;
--base-color-neutral--neutral-darker: #222;
--base-color-system--success-green-dark: #114e0b;
--base-color-system--warning-yellow: #fcf8d8;
--base-color-system--warning-yellow-dark: #5e5515;
--base-color-system--error-red: #f8e4e4;
--base-color-system--focus-state: #2d62ff;
--border-color--border-alternate: var(--base-color-neutral--neutral-darker);
--link-color--link-secondary: var(--base-color--vast);
--link-color--link-alternate: var(--base-color-neutral--white);
```

### Spacing

```css
--_spacing---section-radius--small: 2.5rem;
--_spacing---section-paddings--large: 8rem;
--_spacing---section-paddings--medium: 6rem;
--_spacing---spacers--medium: 1.5rem;
--_spacing---spacers--large: 3rem;
--_spacing---section-radius--large: 5rem;
--_spacing---section-paddings--x-large: 10rem;
--_spacing---spacers--xx-huge: 10rem;
--_spacing---section-radius--tiny: 2rem;
--_spacing---section-radius--medium: 4rem;
--_spacing---section-radius--x-tiny: 1rem;
--_spacing---section-radius--regular: 3rem;
--_spacing---padding--xx-huge: 14rem;
```

### Typography

```css
--_text-collection---font--body-font: Figtree,Arial,sans-serif;
--_text-collection---heading--h1: 7.5rem;
--_text-collection---heading--h2: 4rem;
--_text-collection---heading--h3: 3rem;
--_text-collection---heading--h4: 2rem;
--_text-collection---heading--h5: 1.25rem;
--_text-collection---heading--h6: 1rem;
--_text-collection---body--medium: 1.125rem;
--_text-collection---heading--h1-small: 6rem;
--_text-collection---body--regular: 1rem;
--_text-collection---body--small: .875rem;
--_text-collection---body--large: 1.25rem;
--_text-collection---body--xlarge: 1.5rem;
--_text-collection---body--xsmall: .8125rem;
--_text-collection---heading--h2-big: 4.6875rem;
--_text-collection---body--large-medium: 1.375rem;
```

### Other

```css
--alpha--light--50: #ffffeb80;
--alpha--dark--70: #1a1a1ab3;
--alpha--dark--50: #1a1a1a80;
--alpha--light--15: #ffffeb26;
--alpha--light--70: #ffffebb3;
--alpha--light--30: #ffffeb4d;
--alpha--dark--30: #1a1a1a4d;
--alpha--light--90: #ffffebe6;
--alpha--dark--90: #1a1a1a;
--alpha--dark--15: #1a1a1a26;
--alpha--dark--10: #1a1a1a1a;
--alpha--light--10: #ffffeb1a;
--alpha--light--5-2: #ffffeb0d;
--alpha--dark--5-2: #1a1a1a0d;
--alpha--dark--2: #1a1a1a05;
--alpha--light--2: #ffffeb05;
--alpha--dark--5-3: #1a1a1a0d;
--alpha--light--5-3: #ffffeb0d;
--fs-list-renderindex: 0;
```

### Dependencies

```css
--background-color--background-primary: --base-color--lumen;
--text-color--text-primary: --base-color--vast;
--text-color--text-alternate: --base-color-neutral--white;
--text-color--text-secondary: --base-color--lumen;
--background-color--background-success: --base-color-system--success-green;
--text-color--text-success: --base-color-system--success-green-dark;
--background-color--background-alternate: --base-color--white;
--background-color--background-secondary: --base-color--dawn;
--border-color--border-secondary: --base-color--vast;
--base-color-system--error-red-dark: --base-color--pulse;
--link-color--link-primary: --base-color--dawn;
--background-color--background-tertiary: --base-color--vast;
--background-color--background-error: --base-color-system--error-red;
--text-color--text-error: --base-color-system--error-red-dark;
--background-color--background-warning: --base-color-system--warning-yellow;
--text-color--text-warning: --base-color-system--warning-yellow-dark;
--text-color--text-tertiary: --base-color--dawn;
--border-color--border-alternate: --base-color-neutral--neutral-darker;
--link-color--link-secondary: --base-color--vast;
--link-color--link-alternate: --base-color-neutral--white;
```

### Semantic

```css
success: [object Object];
warning: [object Object];
error: [object Object];
info: [object Object];
```

## Breakpoints

| Name | Value | Type |
|------|-------|------|
| sm | 479px | max-width |
| md | 767px | max-width |
| md | 768px | max-width |
| lg | 991px | max-width |
| lg | 992px | min-width |
| lg | 1024px | max-width |
| lg | 1085px | min-width |
| 1150px | 1150px | max-width |
| 1199px | 1199px | max-width |
| xl | 1281px | max-width |

## Transitions & Animations

**Durations:** `0.3s`, `0.2s`, `0.1s`

### Common Transitions

```css
transition: all;
transition: color 0.3s;
transition: opacity 0.3s;
transition: height 0.2s;
transition: background-color 0.2s;
transition: opacity 0.2s;
transition: border-color 0.3s, color 0.3s;
transition: transform 0.2s, color 0.3s;
transition: 0.2s;
transition: opacity 0.1s;
```

### Keyframe Animations

**spin**
```css
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
```

**logoTicker1**
```css
@keyframes logoTicker1 {
  0% { transform: translateX(0%); }
  100% { transform: translateX(-100%); }
}
```

## Component Patterns

Detected UI component patterns and their most common styles:

### Buttons (29 instances)

```css
.button {
  background-color: rgb(240, 215, 255);
  color: rgb(26, 26, 26);
  font-size: 16px;
  font-weight: 600;
  padding-top: 16px;
  padding-right: 24px;
  border-radius: 12px;
}
```

### Links (73 instances)

```css
.link {
  color: rgb(26, 26, 26);
  font-size: 16px;
  font-weight: 600;
}
```

### Navigation (32 instances)

```css
.navigatio {
  background-color: rgba(228, 228, 208, 0);
  color: rgb(26, 26, 26);
  padding-top: 0px;
  padding-bottom: 0px;
  padding-left: 0px;
  padding-right: 0px;
  position: static;
}
```

### Modals (10 instances)

```css
.modal {
  background-color: rgba(255, 253, 249, 0);
  border-radius: 0px;
  padding-top: 0px;
  padding-right: 0px;
}
```

### Dropdowns (201 instances)

```css
.dropdown {
  background-color: rgb(255, 255, 235);
  border-radius: 0px;
  border-color: rgb(26, 26, 26);
  padding-top: 0px;
}
```

### Badges (6 instances)

```css
.badge {
  color: rgb(26, 26, 26);
  font-size: 16px;
  font-weight: 700;
  padding-top: 0px;
  padding-right: 0px;
  border-radius: 0px;
}
```

### Tabs (21 instances)

```css
.tab {
  background-color: rgba(221, 221, 221, 0);
  color: rgb(255, 255, 235);
  font-size: 16px;
  font-weight: 400;
  padding-top: 0px;
  padding-right: 0px;
  border-color: rgb(255, 255, 235);
  border-radius: 0px;
}
```

### Switches (8 instances)

```css
.switche {
  background-color: rgba(228, 228, 208, 0);
  border-radius: 16px 16px 0px 0px;
  border-color: rgba(26, 26, 26, 0);
}
```

## Component Clusters

Reusable component instances grouped by DOM structure and style similarity:

### Button — 1 instance, 1 variant

**Variant 1** (1 instance)

```css
  background: rgb(255, 255, 235);
  color: rgb(26, 26, 26);
  padding: 0px 8px 0px 19.2px;
  border-radius: 9.6px;
  border: 2px solid rgb(228, 228, 208);
  font-size: 16px;
  font-weight: 400;
```

### Button — 7 instances, 1 variant

**Variant 1** (7 instances)

```css
  background: rgb(240, 215, 255);
  color: rgb(26, 26, 26);
  padding: 14px 14px 14px 14px;
  border-radius: 12px;
  border: 2px solid rgb(26, 26, 26);
  font-size: 16px;
  font-weight: 600;
```

### Button — 7 instances, 1 variant

**Variant 1** (7 instances)

```css
  background: rgba(0, 0, 0, 0);
  color: rgb(26, 26, 26);
  padding: 0px 0px 0px 0px;
  border-radius: 0px;
  border: 0px none rgb(26, 26, 26);
  font-size: 16px;
  font-weight: 600;
```

### Button — 3 instances, 2 variants

**Variant 1** (2 instances)

```css
  background: rgba(0, 0, 0, 0);
  color: rgb(26, 26, 26);
  padding: 0px 0px 0px 0px;
  border-radius: 0px;
  border: 0px none rgb(26, 26, 26);
  font-size: 16px;
  font-weight: 400;
```

**Variant 2** (1 instance)

```css
  background: rgba(0, 0, 0, 0);
  color: rgb(255, 255, 235);
  padding: 0px 0px 0px 0px;
  border-radius: 0px;
  border: 0px none rgb(255, 255, 235);
  font-size: 16px;
  font-weight: 400;
```

### Button — 1 instance, 1 variant

**Variant 1** (1 instance)

```css
  background: rgb(255, 255, 235);
  color: rgb(26, 26, 26);
  padding: 16px 24px 16px 24px;
  border-radius: 12px;
  border: 2px solid rgb(26, 26, 26);
  font-size: 16px;
  font-weight: 600;
```

### Button — 2 instances, 1 variant

**Variant 1** (2 instances)

```css
  background: rgba(0, 0, 0, 0);
  color: rgb(26, 26, 26);
  padding: 0px 0px 0px 0px;
  border-radius: 0px;
  border: 0px none rgb(26, 26, 26);
  font-size: 16px;
  font-weight: 400;
```

### Button — 6 instances, 1 variant

**Variant 1** (6 instances)

```css
  background: rgb(255, 255, 235);
  color: rgb(26, 26, 26);
  padding: 16px 24px 16px 24px;
  border-radius: 12px;
  border: 2px solid rgb(26, 26, 26);
  font-size: 16px;
  font-weight: 600;
```

### Card — 2 instances, 1 variant

**Variant 1** (2 instances)

```css
  background: rgb(26, 26, 26);
  color: rgb(255, 255, 235);
  padding: 70px 55px 0px 55px;
  border-radius: 40px;
  border: 0px none rgb(255, 255, 235);
  font-size: 16px;
  font-weight: 400;
```

### Card — 2 instances, 2 variants

**Variant 1** (1 instance)

```css
  background: rgb(26, 26, 26);
  color: rgb(255, 255, 235);
  padding: 48px 48px 48px 48px;
  border-radius: 40px;
  border: 0px none rgb(255, 255, 235);
  font-size: 16px;
  font-weight: 400;
```

**Variant 2** (1 instance)

```css
  background: rgba(0, 0, 0, 0);
  color: rgb(255, 255, 235);
  padding: 0px 0px 0px 0px;
  border-radius: 0px;
  border: 0px none rgb(255, 255, 235);
  font-size: 16px;
  font-weight: 400;
```

### Button — 1 instance, 1 variant

**Variant 1** (1 instance)

```css
  background: rgb(255, 255, 235);
  color: rgb(26, 26, 26);
  padding: 16px 24px 16px 24px;
  border-radius: 12px;
  border: 2px solid rgb(26, 26, 26);
  font-size: 16px;
  font-weight: 600;
```

### Link — 4 instances, 1 variant

**Variant 1** (4 instances)

```css
  background: rgb(3, 79, 70);
  color: rgb(255, 255, 235);
  padding: 32px 32px 32px 32px;
  border-radius: 32px;
  border: 0px none rgb(255, 255, 235);
  font-size: 16px;
  font-weight: 400;
```

### Button — 1 instance, 1 variant

**Variant 1** (1 instance)

```css
  background: rgba(0, 0, 0, 0);
  color: rgb(255, 255, 235);
  padding: 0px 0px 0px 0px;
  border-radius: 0px;
  border: 0px none rgb(255, 255, 235);
  font-size: 16px;
  font-weight: 400;
```

### Button — 1 instance, 1 variant

**Variant 1** (1 instance)

```css
  background: rgba(0, 0, 0, 0);
  color: rgb(26, 26, 26);
  padding: 0px 0px 0px 0px;
  border-radius: 0px;
  border: 0px none rgb(26, 26, 26);
  font-size: 16px;
  font-weight: 400;
```

## Layout System

**4 grid containers** and **194 flex containers** detected.

### Container Widths

| Max Width | Padding |
|-----------|---------|
| 992px | 0px |
| 1240px | 0px |
| 100% | 0px |
| 608px | 0px |
| 448px | 0px |

### Grid Column Patterns

| Columns | Usage Count |
|---------|-------------|
| 2-column | 3x |
| 3-column | 1x |

### Grid Templates

```css
grid-template-columns: 643.188px 428.797px;
gap: 128px;
grid-template-columns: 553.203px 553.203px;
gap: 93.6px;
grid-template-columns: 300px 900px;
grid-template-columns: 106.594px 614.859px 271.359px;
gap: 16px;
```

### Flex Patterns

| Direction/Wrap | Count |
|----------------|-------|
| column/nowrap | 24x |
| row/nowrap | 155x |
| row/wrap | 15x |

**Gap values:** `104px`, `128px`, `12px`, `16px`, `22px`, `24px`, `36px`, `4.8px`, `4px`, `64px`, `6px normal`, `8px`, `8px 16px`, `93.6px`

## Accessibility (WCAG 2.1)

**Overall Score: 100%** — 0 passing, 0 failing color pairs

## Design System Score

**Overall: 90/100 (Grade: A)**

| Category | Score |
|----------|-------|
| Color Discipline | 100/100 |
| Typography Consistency | 90/100 |
| Spacing System | 100/100 |
| Shadow Consistency | 85/100 |
| Border Radius Consistency | 80/100 |
| Accessibility | 100/100 |
| CSS Tokenization | 100/100 |

**Strengths:** Tight, disciplined color palette, Consistent typography system, Well-defined spacing scale, Clean elevation system, Strong accessibility compliance, Good CSS variable tokenization

**Issues:**
- 214 !important rules — prefer specificity over overrides
- 93% of CSS is unused — consider purging
- 15886 duplicate CSS declarations

## Z-Index Map

**11 unique z-index values** across 4 layers.

| Layer | Range | Elements |
|-------|-------|----------|
| modal | 9999,9999 | div.b.a.n.n.e.r. .v.2. .h.i.d.e, div.n.a.v._.c.o.m.p.o.n.e.n.t. .w.-.n.a.v |
| dropdown | 111,999 | img.i.c.o.n.-.1.x.1.-.s.m.a.l.l, div.n.a.v._.f.i.x.e.d |
| sticky | 10,11 | div.h.e.r.o._.a.n.i.m.a.t.i.o.n.-.l.o.t.t.i.e.-.b.g, div.h.e.r.o._.a.n.i.m.a.t.i.o.n.-.l.o.t.t.i.e, a.h.e.r.o._.a.n.i.m.a.t.i.o.n.-.l.o.t.t.i.e.-.l.i.n.k. .w.-.i.n.l.i.n.e.-.b.l.o.c.k |
| base | -1,5 | img.f.a.s.t.e.r._.f.l.o.w.-.i.m.a.g.e, div.h.e.r.o._.a.n.i.m.a.t.i.o.n.-.w.r.a.p.p.e.r.-.v.2, img.m.o.b.i.l.e.-.r.i.v.e.-.t.h.u.m.b.n.a.i.l |

## SVG Icons

**8 unique SVG icons** detected. Dominant style: **filled**.

| Size Class | Count |
|------------|-------|
| sm | 1 |
| md | 5 |
| xl | 2 |

**Icon colors:** `#ffffff`, `rgb(255,255,235)`, `rgb(0, 0, 0)`, `#FFA946`, `currentColor`, `white`

## Font Files

| Family | Source | Weights | Styles |
|--------|--------|---------|--------|
| webflow-icons | self-hosted | 400 | normal |
| Figtree | self-hosted | 400, 500, 600, 700 | normal |
| Eb garamond | self-hosted | 400 | normal, italic |
| Monaspace Neon | self-hosted | 300 | normal |
| Inter | self-hosted | 300, 400, 500, 800 | normal |
| IBM Plex Mono | self-hosted | 200 | normal |
| Twemoji Country Flags | self-hosted | 400, normal | normal |

## Image Style Patterns

| Pattern | Count | Key Styles |
|---------|-------|------------|
| thumbnail | 151 | objectFit: fill, borderRadius: 0px, shape: square |
| avatar | 34 | objectFit: cover, borderRadius: 100%, shape: circular |
| general | 3 | objectFit: fill, borderRadius: 0px, shape: square |
| gallery | 2 | objectFit: contain, borderRadius: 0px, shape: square |
| hero | 2 | objectFit: cover, borderRadius: 0px, shape: square |

**Aspect ratios:** 1:1 (122x), 3:4 (5x), 4:3 (5x), 5.33:1 (4x), 2.55:1 (4x), 16:9 (4x), 4.31:1 (4x), 5.16:1 (4x)

## Motion Language

**Feel:** mixed · **Scroll-linked:** yes

### Duration Tokens

| name | value | ms |
|---|---|---|
| `xs` | `100ms` | 100 |
| `sm` | `200ms` | 200 |
| `md` | `300ms` | 300 |

### Keyframes In Use

| name | kind | properties | uses |
|---|---|---|---|
| `logoTicker1` | slide-x | transform | 4 |

## Component Anatomy

### button — 30 instances

**Slots:** label, icon
**Variants:** secondary

| variant | count | sample label |
|---|---|---|
| default | 25 | Product
Individuals
Business
Resources
C |
| secondary | 5 | Watch in action |

### card — 4 instances

**Slots:** media

### link — 4 instances


## Brand Voice

**Tone:** friendly · **Pronoun:** you-only · **Headings:** Sentence case (tight)

### Top CTA Verbs

- **download** (11)
- **try** (5)
- **ask** (4)
- **explore** (2)
- **faster** (2)
- **watch** (1)
- **from** (1)
- **x** (1)

### Button Copy Patterns

- "download for windows" (9×)
- "try flow" (3×)
- "try flow
download for windows" (2×)
- "explore all features" (2×)
- "product
individuals
business
resources
company
download for windows" (1×)
- "watch in action" (1×)
- "from typing to talking
"voice is the future of human-computer interaction."
reid hoffman

cofounder of linkedin, partner at greylock" (1×)
- "90% faster everywhere
"flow fits into every corner of how i work."
steven bartlett
host of diary of a ceo" (1×)
- "20% faster gtm execution
"flow gave our team a shared speed advantage."
teams at clay
200+ employees · b2b software" (1×)
- "4x faster responses
"flow lets me reply in seconds, not minutes."
gaurav vohra
startup advisor & growth leader" (1×)

### Sample Headings

> Don’t type, just speak
> Write faster in all your apps, on any device
> Used by professionals everywhere to speed up their thoughts

> 4x faster
 than typing
> 45 wpm
> Don’t type, just speak
> Write faster in all your apps, on any device
> Used by professionals everywhere to speed up their thoughts

> 4x faster
 than typing
> 45 wpm

## Page Intent

**Type:** `landing` (confidence 0.57)
**Description:** Flow makes writing quick and clear with seamless voice dictation. It is the fastest, smartest way to type with your voice.

Alternates: docs (0.45), blog-post (0.35)

## Section Roles

Reading order (top→bottom): nav → nav → nav → nav → testimonial → hero → nav → nav → hero → logo-wall → content → testimonials → hero → faq → content → testimonial → pricing → footer

| # | Role | Heading | Confidence |
|---|------|---------|------------|
| 0 | nav | — | 0.9 |
| 1 | nav | — | 0.9 |
| 2 | nav | — | 0.9 |
| 3 | nav | — | 0.9 |
| 4 | nav | — | 0.9 |
| 5 | nav | — | 0.9 |
| 6 | testimonial | Don’t type, just speak | 0.8 |
| 7 | hero | Don’t type, just speak | 0.85 |
| 8 | hero | Write faster in all your apps, on any device | 0.4 |
| 9 | logo-wall | Used by professionals everywhere to speed up their thoughts
 | 0.85 |
| 10 | content | 4x faster
 than typing | 0.3 |
| 11 | testimonials | Made for the way you work | 0.4 |
| 12 | hero | AI
 Auto Edits | 0.4 |
| 13 | faq | Personal dictionary | 0.85 |
| 14 | content | On-the-go or at your desk | 0.3 |
| 15 | testimonial | Love letters
to Flow | 0.8 |
| 16 | pricing | Start flowing | 0.4 |
| 17 | footer | Company | 0.95 |

## Material Language

**Label:** `flat` (confidence 0)

| Metric | Value |
|--------|-------|
| Avg saturation | 0.208 |
| Shadow profile | none |
| Avg shadow blur | 0px |
| Max radius | 1000px |
| backdrop-filter in use | no |
| Gradients | 0 |

## Imagery Style

**Label:** `flat-illustration` (confidence 0.143)
**Counts:** total 192, svg 110, icon 51, screenshot-like 0, photo-like 3
**Dominant aspect:** square-ish
**Radius profile on images:** rounded

## Component Screenshots

9 retina crops written to `screenshots/`. Index: `*-screenshots.json`.

| Cluster | Variant | Size (px) | File |
|---------|---------|-----------|------|
| button--default | 0 | 1056 × 73 | `screenshots/button-default-0.png` |
| button--default | 1 | 228 × 48 | `screenshots/button-default-1.png` |
| button--default | 2 | 480 × 52 | `screenshots/button-default-2.png` |
| button--secondary | 0 | 167 × 52 | `screenshots/button-secondary-0.png` |
| button--secondary | 1 | 139 × 52 | `screenshots/button-secondary-1.png` |
| button--secondary | 2 | 139 × 52 | `screenshots/button-secondary-2.png` |
| card--default | 0 | 480 × 503 | `screenshots/card-default-0.png` |
| card--default | 1 | 480 × 572 | `screenshots/card-default-1.png` |
| card--default | 2 | 480 × 544 | `screenshots/card-default-2.png` |

Full-page: `screenshots/full-page.png`

## Quick Start

To recreate this design in a new project:

1. **Install fonts:** Add `Figtree` from Google Fonts or your font provider
2. **Import CSS variables:** Copy `variables.css` into your project
3. **Tailwind users:** Use the generated `tailwind.config.js` to extend your theme
4. **Design tokens:** Import `design-tokens.json` for tooling integration
