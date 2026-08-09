# Map: Sillage redesign implementation

## Destination

Land the Claude Design "Sillage" redesign (project `demo-storefront`,
`966d84e8-e9ac-4d0e-90b5-0d0eff3847c9`, `core-ui-kit/` + `templates/*`) in this
repo: swapped design tokens (blush/rose/gold/violet palette, Jost + Instrument
Sans typography) driving the existing Tailwind `@theme` architecture, restyled
chrome (Header, Footer, Hero, ProductCard, core UI kit), reworked Login/Account
pages using the app's own component system instead of raw daisyUI classes, and
two new routes — `/cart` and `/discovery` — matching the mockups. Real product
photography, cart-line business rules beyond what already exists, and a real
LLM backend for Discovery are out of reach here, so those are mocked. Done
means: typecheck and format pass, every route renders in the dev server
without console errors, and the visual language matches the mockups closely
enough to review.

## Notes

- Solo effort, single working session, no concurrent drivers — tickets below
  are **Task** type and carry execution (per the skill's Notes override):
  resolving a ticket means writing and landing the change, not just deciding
  it. Given that, tickets are worked sequentially in this same session rather
  than one-per-session.
- Domain: TanStack Start + React 19 + Cloudflare Workers storefront, content
  partly CMS-driven via `.deco/blocks/*.json` (Header/Footer/Hero copy comes
  from editors, not hardcoded — see `AGENTS.md`). Only *chrome* (styling,
  layout, component structure) is redesigned; CMS-authored copy/nav content is
  left alone.
- Token architecture: `src/styles/app.css`'s `@theme` block feeds Tailwind
  utilities (`text-ink`, `bg-glass`, `rounded-sm`, `text-display`, `frost`,
  `tap-scale`, `reveal`, …) used throughout `src/components` and `src/sections`
  — updating token *values* cascades through most components for free; only
  typography-hierarchy spots (headings, CTAs, nav, labels) need an explicit
  `font-display` class added.
- Source design reference already pulled into this session: `styles.css`,
  `templates/home/Home.dc.html`, `templates/home-desktop/HomeDesktop.dc.html`,
  `templates/cart/Cart.dc.html`, `templates/account/Account.dc.html`,
  `templates/login/Login.dc.html`, `templates/discovery/Discovery.dc.html` —
  don't re-fetch via DesignSync, the content is already in this transcript.
- Security: new `/cart` and `/discovery` routes must not use
  `dangerouslySetInnerHTML` on any user- or mock-supplied text, must not
  fabricate a real network call to an LLM (no leaked API key / no unbounded
  external call from client code) — Discovery's "AI assistant" is a scripted
  local mock, not a live integration.

## Decisions so far

- [01 — tokens & typography](issues/01-tokens-typography.md) — swapped
  `app.css` `@theme` palette to Sillage (ink/blush/rose/gold/violet), added
  `--font-display` (Jost) + body `--font-sans` (Instrument Sans), updated
  Google Fonts link in `__root.tsx`.
- [02 — core UI kit](issues/02-core-ui-kit.md) — Button/Section/Tag/Drawer.Aside
  now use `font-display` uppercase-tracked labels; fixed a contrast bug in
  Tag's dark tone (white text over the new light rose glass).
- [03 — Header/Footer/Nav](issues/03-header-footer-nav.md) — Jost
  uppercase-tracked labels across nav/menu/bag/footer; Footer background
  moved off hardcoded gray onto tokens; flagged Alert.tsx's pre-existing
  `dangerouslySetInnerHTML` (CMS-trusted, not a new-code issue) for ticket 08.
- [04 — Hero & ProductCard](issues/04-hero-productcard.md) — `font-display`
  on product card titles, hero category tiles, and the featured-product
  eyebrow label; price/notes stay body font (matches mockup).
- [05 — Login & Account](issues/05-login-account.md) — rebuilt off daisyUI
  onto `Button`/tokens; login gets a gradient decorative panel (no fake
  photography); account keeps its real Profile+AddressBook content only, no
  fabricated Orders/Scent-profile tabs.
- [06 — /cart route](issues/06-cart-route.md) — new page wired to the real
  cart hooks; samples/gift-note/promo are labelled local-state mocks;
  restyled `Minicart.tsx` too and linked it to `/cart`.
- [07 — /discovery route](issues/07-discovery-route.md) — chat assistant is a
  pure local keyword-scoring function against an in-file catalog, no network
  calls; UI self-labels as a scripted demo; linked from `Menu.tsx`.
- [08 — security & QA](issues/08-security-qa.md) — typecheck/build/format all
  clean, no `dangerouslySetInnerHTML`/`eval` in new code, both new routes
  reachable. Route to the destination is now clear — map complete.

## Not yet specified

- PDP (`ProductDescription.tsx`), `ShippingSimulator.tsx`, and `Avatar.tsx`
  still use hardcoded `bg-gray-50`/`border-gray-200` instead of the new
  tokens — never in this map's destination (PDP/shipping weren't part of the
  approved scope), left as a follow-up rather than scope-creeped into ticket
  08.

- Whether Discovery/Cart ever get a real backend (cart mutations wired to
  Shopify, Discovery wired to a real LLM route) — out of scope for this map,
  would be its own future effort.

## Out of scope

- Real LLM backend for Discovery (mocked instead) — needs an API key/config
  decision and a server route, not part of this pass.
- Real product photography / new CMS content authoring — existing images and
  copy stay; only chrome is restyled.
- Wiring the mocked Cart page's "free samples" / "gift note" concepts into
  real commerce data model — no such concept exists in the current cart
  platform layer; mocked as local UI state only.
