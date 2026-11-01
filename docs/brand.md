# DALTA Esports brand guide

The de-facto brand, codified from `app/globals.css` and the DALTA ESPORTS logo. Until an official guide exists, this page is the source of truth: new UI follows it; changes to it are design decisions, not drive-bys.

The current look (since the "Updated UI/UX design" redesign): a white page, Montserrat with uppercase titles, buttons and labels, rounded white cards, dark photo heroes at the top of each page, and the logo's gold and maroon as accents.

## Colors

Tokens live in `app/globals.css` `@theme`. Always use the token (`bg-gold`, `text-maroon`), never the hex in a class or an inline `style`.

| Token | Hex | Use |
|---|---|---|
| `gold` | `#FFCC37` | Primary accent: solid buttons, badges and text **on dark** (heroes) |
| `golddark` | `#E5B72E` | Hover on gold buttons |
| `goldlight` | `#FFE066` | Hover on gold text inside dark heroes |
| `golddeep` | `#C89300` | Gold text that must stay readable on white (header "ESPORTS") |
| `maroon` (= `brown`) | `#5B271E` | Accent text, links, icons and focus rings **on white** |
| `maroondark` / `maroonlight` | `#431B14` / `#7A3529` | Darker/lighter maroon |
| `ink` | `#0E0C0B` | Near-black panels behind game logos and photos |
| `negative` | `#e66767` | Negative sentiment (same as the chart color, color-blind checked) |
| `sitebg`, `sitecard` | `#ffffff` | Page and card surfaces |

- Tailwind's `amber-600` … `amber-950` are remapped to maroon shades in `@theme`, so `text-amber-700` renders maroon.
- Gold text on white is too faint (contrast 1.6:1): on white use `maroon` (or `golddeep` for a gold look).
- Text: `text-stone-950` (main), `text-stone-600`/`text-stone-500` (muted). No light grays (`gray-200…400`) on white.
- Meaning colors stay Tailwind's own: red (errors, live), emerald (success), yellow (pending), blue (Verified badge). Light tints for boxes, e.g. `bg-red-50 text-red-700 border-red-200`.
- Chart colors are hex in `utils/reports.ts` (Chart.js can't read Tailwind classes).

## Utilities (in `app/globals.css`)

- `bg-logo-stage` / `bg-logo-stage-strong`: the dark radial spotlight behind game logos and team photos.
- `text-glow-gold`: the soft gold glow on the home page title.
- Animations: `animate-hero-entrance`, `animate-hero-title`, `animate-hero-tagline`, `animate-stagger-1…3`, `animate-marquee`.

## Typography

- Montserrat everywhere (`font-montserrat` / `font-sans`; `font-pixel` is an alias kept for older code).
- Uppercase only for titles, buttons and labels: `globals.css` uppercases `h1`–`h6`, `button`, `label`, `th` and `summary`. Nav links, button-styled links, badges/status chips and small eyebrow labels (`text-xs` + `tracking-wider`/`tracking-widest`) add the `uppercase` class themselves.
- Everything else keeps normal case: paragraphs, page subtitles, error/success messages, empty states, inline text links, inputs and placeholders, and anything people typed (names, IGNs, team names, comments, announcements). Don't put `uppercase` on containers (`main`, `section`, `form`, wrapping `div`s): it would cascade to all of that text. Use `tracking-wider`/`tracking-widest` only on uppercase text.
- Headings `font-black`; page titles in heroes `text-3xl sm:text-4xl lg:text-5xl text-white`.

## Shape & layout

- Cards: `bg-white border border-stone-200/90 rounded-2xl shadow-xs`, padding `p-5 sm:p-6` (forms `p-6 sm:p-8`, larger panels `rounded-3xl`).
- Page hero: `relative rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden` with `<PageHeroBackground>` (admin-editable banner) and white title text.
- Buttons: gold solid (`bg-gold text-stone-950 rounded-xl font-black uppercase tracking-widest hover:bg-golddark`) or outline (`border border-maroon text-maroon rounded-xl`).
- Inputs: `rounded-xl bg-white border border-stone-300 focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20`.
- Logged-in and public pages share `SiteNavLayout` (collapsible side nav); it renders the page's `<main id="main-content">`, so pages inside it start with a `<div>`, not another `<main>`.
- Live indicators: a dot (`rounded-full bg-current animate-pulse`) + text, never an emoji.
- Icons: `lucide-react`, imported individually, `h-4 w-4`/`h-5 w-5`.

## Logo

`public/DALTA ESPORTS LOGO TRNPRNT.png` (transparent), unless an admin uploads one on `/admin/website` (served via `logoUrl()`). In the header it sits next to the stacked wordmark: "DALTA" in `text-maroon`, "ESPORTS" in `text-golddeep`. Game logos: `getGameLogo()` in `utils/game-logos.ts`, shown on `bg-ink`/`bg-logo-stage`.

## Voice

Plain, direct, friendly. Empty states say what happened and what to do next; errors are one sentence, no jargon. Gamified energy is welcome in hero/section copy ("Game With Purpose") but not in forms, errors or legal text.
