Type: task
Status: resolved
Blocked by: 01, 02

## Answer

`ProductCardTitle.tsx`: product name now `font-display` (was plain body
font). `ProductCardPrice.tsx`/notes stay body font — matches the mockup,
where only the product name is set in Jost. `Hero.tsx`: category tile labels
and the hero slide-nav's "featured product" eyebrow now `font-display`
(display size / uppercase-tracked label respectively). `ProductCardVariants.tsx`
left as-is — small body-text pills, no headline role in the mockup.

## Question

Restyle `src/sections/Content/Hero.tsx` (category tiles, slide nav, info
bullets — `font-display` on headline-weight text) and the product card family
(`ProductCard.tsx`, `ProductCardTitle.tsx`, `ProductCardPrice.tsx`,
`ProductCardVariants.tsx`) to match the mockup's product-tile visual language
(radii/glass panel already token-driven from ticket 01; add `font-display` to
title/price where the mockup uses Jost).
