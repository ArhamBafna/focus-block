# FocusBlock Design System

Mapped from WisprFlow extract (`design-extract-output/`). App UI uses product register, not marketing landing patterns.

## Colors (locked)

| Token | Hex | Use |
|-------|-----|-----|
| background | `#ffffeb` | Page surface |
| foreground | `#000000` | Primary text |
| ink | `#1a1a1a` | Body text |
| muted | `#8a8a80` | Secondary text |
| primary | `#f0d7ff` | Soft highlight surfaces |
| secondary | `#ffa946` | Warm accent (sparingly) |
| accent | `#034f46` | CTAs, active states, links, success |
| warning | `#ffa946` | Time and attention emphasis |
| error | `#7f1c34` | Destructive actions and errors |
| error surface | `#f8e4e4` | Soft destructive/error background |

Use green as primary interactive color. Use pink for selected navigation, orange for focused time cues, and oxblood red only for destructive/error states. Keep primary text black and secondary text teal-tinted rather than neutral gray.

## Typography

- Sans: Figtree (`@fontsource/figtree`)
- Base: 16px, line-height relaxed
- Display: clamp max 4rem, tracking -0.03em floor
- Body max-width: 65ch

## Spacing scale

2, 32, 48, 59, 64, 70, 80, 93, 104, 112 px

## Radii

- Cards/inputs: 10-14px (`md`/`lg`)
- Buttons: full pill
- No 32px+ card rounding

## Motion

- `motion/react` for UI transitions
- Duration: 100-300ms, ease-out
- Honor `prefers-reduced-motion`

## Anti-slop (product UI)

- No eyebrow on every section
- No section numbering (01/02/03)
- No hero-metric template
- No glassmorphism default
- Full focus/error/empty states on forms

## Source files

- `apps/desktop/src/styles/theme.css` - Tailwind v4 @theme
- `apps/desktop/src/styles/variables.css` - CSS custom properties
