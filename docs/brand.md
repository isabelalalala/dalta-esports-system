# DALTA Esports brand guide

The de-facto brand, codified from `app/globals.css` and the DALTA ESPORTS logo. Until an official guide exists, this page is the source of truth: new UI follows it; changes to it are design decisions, not drive-bys.

The current look (since the "Updated UI/UX design" redesign): a white page (or the dark theme, see Dark mode), Montserrat with uppercase titles, buttons and labels, rounded white cards, dark photo heroes at the top of each page, and the logo's gold and maroon as accents.

## Colors

Tokens live in `app/globals.css` `@theme`. Always use the token (`bg-gold`, `text-maroon`), never the hex in a class or an inline `style`.

| Token | Hex | Use |
|---|---|---|
| `gold` | `#FFCC37` | Primary accent: solid buttons, badges and text **on dark** (heroes) |
| `golddark` | `#E5B72E` | Hover on gold buttons |
| `goldlight` | `#FFE066` | Hover on gold text inside dark heroes |
| `golddeep` | `#8F6900` | Gold text that must stay readable on white (header "ESPORTS"; 5:1 contrast) |
| `maroon` (= `brown`) | `#5B271E` | Accent text, links, icons and focus rings **on white** |
| `maroondark` / `maroonlight` | `#431B14` / `#7A3529` | Darker/lighter maroon |
| `ink` | `#0E0C0B` | Near-black panels behind game logos and photos |
| `negative` | `#e66767` | Negative sentiment (same as the chart color, color-blind checked) |
| `sitebg`, `sitecard` | `#ffffff` | Page and card surfaces |

- Tailwind's `amber-600` … `amber-950` are remapped to maroon shades in `@theme`, so `text-amber-700` renders maroon.
- Gold text on white is too faint (contrast 1.6:1): on white use `maroon` (or `golddeep` for a gold look).
- Text: `text-stone-950` (main), `text-stone-600`/`text-stone-500` (muted). No light grays (`stone-300/400`, `gray-200…400`) on white: they fail contrast. `text-stone-300/400` is fine only on dark heroes and logo panels.
- Meaning colors stay Tailwind's own: red (errors, live), emerald (success), yellow (pending), blue (Verified badge). Light tints for boxes, e.g. `bg-red-50 text-red-700 border-red-200`.
- Chart colors are hex in `utils/reports.ts` (Chart.js can't read Tailwind classes).

## Dark mode

Since Phase 3 the app has a dark theme. It follows the device setting by default; the sun/moon button in the header (`components/ThemeToggle.tsx`) cycles device → light → dark and saves the choice on the device. `<html data-theme>` is set before the first paint (`utils/theme.ts`, script in `app/layout.tsx`).

- **Nothing changes in the pages.** The dark block in `globals.css` redefines the color variables that Tailwind compiles every class to: the stone scale is inverted, white surfaces (`bg-white`) become `--surface`, maroon becomes a light rose (`#e9a595`), `golddeep` becomes gold, and the meaning colors' light tints become dark tints with light text.
- **Solid colored surfaces keep their light look**: photo heroes (anything containing `PageHeroBackground`), `bg-gold` buttons, `bg-ink`/logo stages, video, and red/green/maroon/dark-stone surfaces. Inside them every variable is restored, so `bg-gold text-stone-950` stays dark-on-gold.
- `text-white` is never remapped (white text on red, maroon or photos stays white).
- Printing always uses the light theme.
- Gradients: never `from-white` / `via-white` / `to-white` (white isn't remapped, so dark mode gets a bright band under light text). Use `via-surface`, and `from-motto/70` for the warm banner tint (pale amber in light, dark maroon in dark).
- Focus states: `focus:bg-surface`, not `focus:bg-white` (only the plain `bg-white` class is remapped). Native `<option>` lists get the dark surface from `globals.css`.
- New UI: keep using the same tokens. A new solid background color needs to be added to the "keep their light-mode colors" list in `globals.css`. Don't use hex colors (they don't switch).

## Navigation

One navigation for everyone, by role (`utils/navigation.ts`, rendered by `components/site/SiteNavLayout.tsx`): sidebar on large screens (collapsible), bottom tab bar on phones for logged-in users (4 items + More), a Menu bar for logged-out visitors. Inner pages get breadcrumbs and a back button; a page names its breadcrumb with `useBreadcrumbName()`. Icon buttons and nav items have hints (`components/Tooltip.tsx`, hover / focus / long press); section titles can add `components/SectionHint.tsx`. Between 1024 and 1279px the sidebar is an icon rail (expanding floats it over the page); page layouts react to the content width (container breakpoints `@3xl`/`@5xl`/`@7xl`), and big titles use the fluid sizes `text-hero`, `text-page-hero`, `text-display`. Animations respect `prefers-reduced-motion` (pulsing LIVE dots, page fade-in and theme fade are off then).

## Utilities (in `app/globals.css`)

- `bg-logo-stage` / `bg-logo-stage-strong`: the dark radial spotlight behind game logos and team photos.
- `text-glow-gold`: the soft gold glow on the home page title.
- Animations: `animate-hero-entrance`, `animate-hero-title`, `animate-hero-tagline`, `animate-stagger-1…3`, `animate-marquee`. The full motion system is in "Motion" below.

## Motion

One motion system for the whole site, public and logged in. **Don't add new effects; use these.**
Every value comes from the motion tokens at the top of `app/globals.css` (`@theme static`):

| Token | Value | Used for |
|---|---|---|
| `--ease-out-brand` | `cubic-bezier(0.16, 1, 0.3, 1)` | Every entrance, lift, slide and fade (decelerates) |
| `--ease-pop` | `cubic-bezier(0.2, 0.9, 0.3, 1.3)` | Small "pop" moments only: score flip, trophy, correct pick, gauge needle |
| `--ease-sweep` | `cubic-bezier(0.45, 0, 0.2, 1)` | The one-time hero light sweep |
| `--duration-fast` / `--duration-base` / `--duration-slow` | 150 ms / 250 ms / 600 ms | Hover and press / card lift and border / entrances (`Reveal`) |
| `--duration-sweep` | 1.8 s | `hero-sweep` |
| `--stagger-step` | 80 ms | Delay between cards in a row (`Reveal delay={1..3}`) |
| `--duration-ambient-a` / `-b` / `--duration-zigzag` | 34 s / 40 s / 30 s | `AmbientBackground` glows and the zigzag drift |
| `--ambient-glow-opacity` | 0.13 | Strength of the ambient glows (they tint the pattern, never hide it) |
| `--zigzag-tile-w` / `-h` / `--zigzag-opacity` | 56 px / 32 px / 0.07 | The one zigzag tile, the same everywhere |
| `--glow-gold` | gold at 45 % | `text-glow-gold` and the slanted gold accent lines |

### The effects and where they're allowed

| Effect | What it does | Where |
|---|---|---|
| `Reveal` (`components/Reveal.tsx`) | Fades and slides a section or card in once when it scrolls into view; `delay` 0–3 steps of `--stagger-step` | Every section and card grid. The **only** scroll fade-in |
| `card-interactive` (utility) | Lift 4 px, gold border and soft gold glow on hover / keyboard focus | **Every clickable card**: team, registration, tournament, announcement, event, campaign, stream, Hall of Fame, dashboard shortcuts. Not on cards that aren't links |
| `TiltCard` + `border-trace` | Leans toward the mouse (mouse only) + a gold light runs around the border | **Game cards only**: `/divisions` cards and the homepage game tiles (the same card) |
| `PageHeroBackground` | Photo with `hero-kenburns` (slow zoom), `AmbientBackground` and one `hero-sweep` | Every page hero. The announcement detail hero uses its cover with the same three layers. Working pages that open on a video or scoreboard (`/live/[id]`, `/matches/[id]`, `/t/[id]/match/[matchId]`), the auth pages and the legal pages have no photo hero by design |
| `AmbientBackground` | Two drifting glows over the `.zigzag-pattern` layer; pauses off-screen and in hidden tabs | Page heroes, the footer, the homepage dark band |
| `AmbientBackground lively` | Adds a third faint gold glow and up to 16 slowly rising sparks (gold on dark, maroon on the light footer; 6 of them on phones and touch screens) | The big living backgrounds: the homepage "Choose your game" band **and** the footer, always together |
| Gold edge shine (`.band-edge-sweep`) | A light runs along the band's two slanted gold accent lines every 7 s | The homepage band only (the only place with the slanted gold lines) |
| `.zigzag-pattern` | The triangle pattern, one tile, oversized layer so every edge stays covered while it drifts | Only inside `AmbientBackground`; never faded on one side |
| `hero-sweep` | One light band across, once | Inside `PageHeroBackground` (and the announcement hero) |
| `CountUp` | Number counts up once when seen | Every stat number (`SiteStats`, About, homepage) |
| `FlipScore` | A changed score digit flips down | Every live score (`MatchVersus`, brackets, ticker) |
| `AnimatedProgress` | A bar fills once when seen | Slot bars, pick'em split |
| `RoleBadge` pulse | Soft ring around the role icon | `RoleBadge` only |
| LIVE pulse (`components/LivePulse.tsx`) | Solid dot with a pulsing ring (`tone` red or white) | **Every** live indicator: header pill, banner, `LiveTag`, match cards, ticker, stream pages, schedule, live list, game tiles |
| `ConfettiBurst` / `Celebrate` | One short burst | A won final (`ChampionBanner`), registration approved, Hall of Fame (once per visit), correct pick |
| `page-enter` / `page-exit` | Page fade between routes (`<ViewTransition>` in `SiteNavLayout`) | Automatic |
| Partner marquee | Logos scroll at 35 px/s, pause on hover/focus | `PartnershipSection` only |
| `MatchTicker` | Results ticker loop, pauses on hover/focus/off-screen | Homepage only |

Status and progress that aren't effects: `AutoUpdateBadge` (green pulse = "updates automatically", not live),
`PageLoading` / `SectionLoading` / skeletons for loading, `Toaster` for results, `ConfirmDialog` / `useConfirm`
for confirmations, `StatusBadge` / `RoleBadge` / `GameBadge` / `VerifiedBadge` for badges. Buttons are
`btn btn-primary|btn-secondary|btn-danger`, plus `btn-on-dark` (see-through white) for a secondary button on a
dark photo or band (`btn-secondary` is for light surfaces); gold buttons get the hover shine automatically.

### Rules
- Only `transform` and `opacity` animate (the hero sweep and button shine move a gradient on a small area); no
  animation may change layout.
- `prefers-reduced-motion`: every loop and entrance is off (content simply shows), confetti and sweeps are hidden.
- Loops pause when off-screen or in a hidden tab (`data-paused` from `AmbientBackground`, the ticker, the marquee).
- `will-change` only on elements that animate continuously (the ambient layer, the Ken Burns photo).
- New UI picks an effect from this table. If something seems to need a new one, change this section first.

## Typography

- Montserrat everywhere (`font-montserrat` / `font-sans`; `font-pixel` is an alias kept for older code).
- Uppercase only for titles, buttons and labels: `globals.css` uppercases `h1`–`h6`, `button`, `label`, `th` and `summary`. Nav links, button-styled links, badges/status chips and small eyebrow labels (`text-xs` + `tracking-wider`/`tracking-widest`) add the `uppercase` class themselves.
- Everything else keeps normal case: paragraphs, page subtitles, error/success messages, empty states, inline text links, inputs and placeholders, and anything people typed (names, IGNs, team names, comments, announcements). Don't put `uppercase` on containers (`main`, `section`, `form`, wrapping `div`s): it would cascade to all of that text. Use `tracking-wider`/`tracking-widest` only on uppercase text.
- Headings `font-black`; page titles in heroes `text-3xl sm:text-4xl lg:text-5xl text-white`.

## Shape & layout

- Cards: `bg-white border border-stone-200/90 rounded-2xl shadow-xs`, padding `p-5 sm:p-6` (forms `p-6 sm:p-8`, larger panels `rounded-3xl`).
- Page hero: `relative rounded-3xl border border-stone-800/80 bg-stone-950 overflow-hidden` with `<PageHeroBackground>` (admin-editable banner) and white title text.
- Buttons: gold solid (`bg-gold text-stone-950 rounded-xl font-black uppercase tracking-widest hover:bg-golddark`) or outline (`border border-maroon text-maroon rounded-xl`).
- Small action buttons that can sit on a dark hero OR a white card (Share, Copy link, Add to calendar): `smallActionClass` / `smallActionPrimaryClass` in `utils/button-styles.ts`. They take the surrounding text color, so never give them a fixed dark or light text color.
- Inputs: `rounded-xl bg-white border border-stone-300 focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20`.
- Logged-in and public pages share `SiteNavLayout` (collapsible side nav); it renders the page's `<main id="main-content">`, so pages inside it start with a `<div>`, not another `<main>`.
- Live indicators: a dot (`rounded-full bg-current animate-pulse`) + text, never an emoji.
- Icons: `lucide-react`, imported individually, `h-4 w-4`/`h-5 w-5`.

## Logo

`public/DALTA ESPORTS LOGO TRNPRNT.png` (transparent), unless an admin uploads one on `/admin/website` (served via `logoUrl()`). In the header it sits next to the stacked wordmark: "DALTA" in `text-maroon`, "ESPORTS" in `text-golddeep`. Game logos: `components/GameLogo.tsx` (logo, or the game's initials when there is none), shown on `bg-ink`/`bg-logo-stage`.

Profile pictures: `components/Avatar.tsx` (picture, or initials on a gold circle).

## Voice

Plain, direct, friendly. Empty states say what happened and what to do next; errors are one sentence, no jargon. Gamified energy is welcome in hero/section copy ("Game With Purpose") but not in forms, errors or legal text.
