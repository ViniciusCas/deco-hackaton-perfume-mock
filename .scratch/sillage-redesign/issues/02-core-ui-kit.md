Type: task
Status: resolved
Blocked by: 01

## Answer

`Button.tsx`: labels now `font-display` + uppercase + `tracking-(--tracking-label)`
(matches mockup CTA style); outline variant border swapped from hardcoded
`border-gray-300` to `border-line-strong`. `Section.tsx` Header: title gets
`font-display text-display`, "See all" CTA becomes an uppercase Jost label in
`text-accent`. `Tag.tsx`: uppercase Jost label style; fixed dark-tone text
color from white to ink (new rose-tinted `glass-tag` is light, white text had
poor contrast — mockup itself uses ink text on tag chips). `Drawer.tsx`
Aside title: `font-display`. `IconButton.tsx`/`Modal.tsx` left as-is — no
text content, already token-driven via existing color/glass utilities.

## Question

Restyle the core UI kit to match the mockup's Jost-uppercase-tracked CTA/label
language: `Button.tsx` (apply `font-display` + uppercase tracking to labels),
`Tag.tsx`, `Section.tsx` (`Header` title), `IconButton.tsx`, `Drawer.tsx` /
`Modal.tsx` chrome. No new components — same props/API, new classNames only.
