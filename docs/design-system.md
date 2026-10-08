# Design system

## Principles

- Answers carry receipts: every claim is one click from the code.
- Light interface with a dark code panel for contrast.

## Typography

| Role | Typeface |
|---|---|
| Display | Archivo, extended width, weight 800 |
| Text | Instrument Sans |
| Code | JetBrains Mono |

Fonts are loaded with `next/font` and exposed as CSS variables in `app/layout.tsx`.

## Color tokens

Defined as CSS variables in `app/globals.css` and mapped into Tailwind's theme.

| Token | Value | Use |
|---|---|---|
| `bg` | `#eef3f1` | Page background |
| `ink` | `#0e1a1a` | Primary text |
| `ink-soft` | `#55706c` | Secondary text |
| `teal` | `#0b6b62` | Primary action and citations |
| `teal-bright` | `#2dd4bf` | Highlight in the code viewer |
| `code panel` | `#11171c` | Code viewer and blocks |

## Motion

- Answers slide up; citations pop in one by one.
- A striped ribbon shows indexing progress.
- The viewer scrolls smoothly to cited lines.

All animation respects `prefers-reduced-motion`.

## Components

| Component | Purpose |
|---|---|
| Answer | Renders text, code and clickable citations |
| CodeViewer | Cited file with highlighted lines |
| KeyBox | Provider and key |

## Rules

- Color carries meaning; it is never the only signal.
- Interactive elements have visible focus and accessible names.
- New tokens are added to `globals.css` and this document together.
