# DALTA Esports brand guide

The de-facto brand, codified from `app/globals.css` and `public/daltaesportslogo.jpg`. Until an official guide exists, this page is the source of truth — new UI follows it; changes to it are design decisions, not drive-bys.

## Colors

Tokens live in `app/globals.css` `@theme`. Always use the token (`bg-sitebg`, `text-gold`), never the hex.

| Token | Hex | Use |
|---|---|---|
| `gold` | `#fccb35` | Primary accent: headings, CTAs, links on hover, logo border |
| `golddark` | `#e0b22a` | Hover state on gold buttons |
| `brown` | `#5c241c` | Strong borders, shadow color |
| `brownlight` | `#a0522d` | Secondary borders |
| `sitebg` | `#120d0b` | Page background |
| `sitecard` | `#1f1714` | Card/panel surfaces |

Status colors in use (to be tokenized when the palette is extended): verified blue `#3987e5`/`#8fbcf2`, live/danger red (`red-500`/`red-400` utilities), positive/negative sentiment greens and `#e66767`. Body text: `text-gray-200`–`text-gray-300`; muted: `text-gray-400`.

## Typography

- `font-pixel` (Press Start 2P, loaded in `app/layout.tsx`): the DALTA wordmark and page/section headings on the public site. Never below `text-xs` — it's illegible at small sizes.
- Body/UI text: Arial/Helvetica/sans-serif (the `body` default). A dedicated display/body pair is a planned improvement; until then, headings `font-bold`, muted text one shade down.

## Shape & motion

- Cards/panels: `border-2 border-brownlight bg-sitecard shadow-[4px_4px_0_var(--color-brown)]` (hard offset shadow — the signature look; `6px` for heroes/forms).
- Buttons: gold solid (`bg-gold text-black`/`text-sitebg`) or gold outline (`border-2 border-gold text-gold`); `hover:translate-y-px` on primary CTAs.
- Live indicators: a colored dot (`rounded-full bg-red-500`/`bg-current` + `animate-pulse`) + text, never an emoji.
- Icons: `lucide-react`, imported individually, sized `h-4 w-4`/`h-5 w-5`, `inline-flex items-center gap-*` when paired with text.

## Logo

`public/daltaesportslogo.jpg` (served via `logoUrl()` from site content). Shown at 44–48px in a `border-2 border-gold bg-white` box in header and footer, next to the stacked "DALTA ESPORTS" pixel wordmark or the footer tagline. Don't recolor, crop or place it on non-white backgrounds without the bordered box.

## Voice

Plain, direct, friendly. Empty states say what happened and what to do next; errors are one sentence, no jargon. Gamified energy is welcome in hero/section copy ("Game With Purpose") but not in forms, errors or legal text.
