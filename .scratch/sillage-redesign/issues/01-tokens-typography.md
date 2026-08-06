Type: task
Status: resolved
Blocked by: (none)

## Answer

Replaced the `@theme` palette in `src/styles/app.css` with the Sillage tokens
(ink `#020122`, blush/rose/gold/violet brand set, new `--color-surface`/
`--color-line`/`--color-line-strong`, `--color-accent` aliasing violet),
added `--font-display: "Jost"` alongside body `--font-sans: "Instrument
Sans"` (replacing Switzer), added `--tracking-label`/`--tracking-display`,
and set `body { background: blush; font-family: var(--font-sans) }` plus a
base-layer `h1-h4 { font-family: var(--font-display) }` rule in `@layer
base`. Swapped the Fontshare/Switzer `<link>` in `src/routes/__root.tsx` for
Google Fonts Jost + Instrument Sans. Radii/motion/gray-scale/daisyUI theme
left untouched — daisyUI classes are being retired in ticket 05, not
re-themed here.

## Question

Update `src/styles/app.css`'s `@theme` block to the Sillage palette and
typography: replace the ink/gray/glass tokens with the mockup's
blush/rose/gold/violet-on-ink system, add `--font-display` (Jost) alongside a
new body `--font-sans` (Instrument Sans, replacing Switzer), and add a page
background token. Update the Google Fonts `<link>` in `src/routes/__root.tsx`
accordingly. Keep the existing radii/motion/utility architecture (`frost`,
`tap-scale`, `reveal`) untouched — only token values change.
