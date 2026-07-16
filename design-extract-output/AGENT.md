# You are building UI in the wisprflow.com design system.

Source: https://wisprflow.com/
Extracted by designlang on 2026-07-06.

## Brand at a glance

- title         Wispr Flow | Effortless Voice Dictation
- page intent   landing
- material      flat
- design grade  A

## Colour

- primary     #f0d7ff
- secondary   #ffa946
- accent      #034f46
- neutrals    #1a1a1a · #000000 · #8a8a80 · #ffffff · #333333

## Typography

- families   Figtree · Eb garamond
- weights    400 · 600 · 700 · 500
- base size  16px

## Spacing

- scale      2px · 32px · 48px · 59px · 64px · 70px · 80px · 93px · 104px · 112px · 128px · 192px

## Radii

- scale      4px · 10px · 14px · 40px · 64px · 80px

## Motion

- durations  100ms · 200ms · 300ms

## Voice

- tone       friendly
- pronoun    you-only
- headings   Sentence case
- CTA verbs  download · try · ask · explore · faster · watch

## Component anatomy

- button     variants: [object Object] · [object Object]  ·  slots: true · true · false
- card       variants: [object Object]  ·  slots: false · false · true · false
- link       variants: [object Object]  ·  slots: —

## Accessibility

- WCAG score 100% · failing pairs: 0

## Build rules

1. Use the colours above. **Never invent a new hex.** If you need a
   shade between two existing colours, derive it via HSL adjustment
   from the closest extracted colour and call out the derivation.
2. Use the extracted typography families. If you need a missing weight,
   pick the nearest available weight from the list and note it.
3. Snap spacing values to the scale above. No off-scale paddings or
   margins.
4. Snap border radii to the scale above.
5. Match the voice: same tone, same pronoun stance, same heading
   style. Reuse the listed CTA verbs.
6. Aim for WCAG AA contrast minimum. When the brand colours fail,
   prefer the foreground colour on the background colour rather than
   mid-tone neutrals.
7. Reuse component anatomy when it exists — do not invent novel
   structures for things the site already has.

## Available context files

designlang wrote these alongside this prompt. Reach for them when
you need ground truth:

- `<host>-design-tokens.json` — DTCG primitive · semantic · composite tokens
- `<host>-tailwind.config.js`  — Tailwind v3 config
- `<host>-tailwind-v4.css`     — Tailwind v4 `@theme` block
- `<host>-tokens.d.ts`         — TypeScript literal-union types
- `<host>-variables.css`       — bare CSS custom properties
- `<host>-reset.css`           — brand-aware base styles
- `<host>-gradients.css`       — `.grad-N` utility classes
- `<host>-anatomy.tsx`         — typed React component scaffolds
- `<host>-shadcn-theme.css`    — shadcn/ui theme
- `<host>-theme.js`            — React / Vue / Svelte theme object
- `<host>-mcp.json`            — MCP server payload (load via stdio)
- `<host>.brand.pdf`           — print-ready 13-chapter brand book

When you reference the system in code, prefer importing from these
files over hard-coding values.

## Output expectations

When asked to "build a pricing page" or "make a card" or any UI:

- Produce a single self-contained component file in the appropriate
  framework (React / Vue / Svelte — match what the user is using).
- Use Tailwind utility classes wired to the v4 `@theme` if Tailwind
  is available; otherwise use the CSS custom properties from
  `variables.css`.
- Write the headline copy using the brand voice; do not invent
  generic Lorem.
- Annotate any choice where you had to bend the system, with a
  one-line `// note:` comment explaining what and why.