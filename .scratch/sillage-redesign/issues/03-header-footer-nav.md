Type: task
Status: resolved
Blocked by: 01, 02

## Answer

Applied `font-display` uppercase-tracked labels to `HeaderNav.tsx` (nav
pills, mega-menu "Shopping" eyebrow, shipping note, "See all"), `Menu.tsx`
(mobile accordion item titles), `Bag.tsx` (pill label — count badge kept
`normal-case` since it's a number, not a label), and `Footer.tsx` column
headers. `Footer.tsx` background swapped `bg-gray-50`→`bg-blush` with a new
`border-t border-line`, divider `border-gray-200`→`border-line`. Noted:
Alert.tsx's `dangerouslySetInnerHTML` on CMS-authored alert HTML is
pre-existing (editor-trusted content, not user input) — left as-is, flagged
for ticket 08's grep so it isn't mistaken for a new-code regression.
`SignIn.tsx`/`Header.tsx` needed no changes (already delegate to `Button`,
already token-driven). Bag→Cart-page link deferred to ticket 06 (where
`/cart` is actually created).

## Question

Restyle chrome-level layout: `src/sections/Header/Header.tsx`,
`src/components/header/HeaderNav.tsx`, `Menu.tsx`, `SignIn.tsx`, `Bag.tsx`,
`Alert.tsx`, and `src/sections/Footer/Footer.tsx`. Apply `font-display` to nav
links/wordmark-adjacent labels, swap hardcoded `bg-gray-50`/`bg-white`/
`border-gray-200` in Footer for the new token-driven equivalents. Don't touch
CMS-authored copy (nav items, links, policies) — only structure/classNames.
