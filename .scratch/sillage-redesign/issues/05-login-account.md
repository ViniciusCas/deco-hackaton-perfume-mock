Type: task
Status: resolved
Blocked by: 01, 02

## Answer

Rewrote all three files off daisyUI (`btn`/`input-bordered`/`card`/`tabs`)
onto the app's own `Button` + token/utility classes. `login.tsx`: split-screen
layout matching the mockup structurally, but the decorative panel is a CSS
gradient (violet→ink) instead of fabricated campaign photography — no real
asset exists, and a broken/placeholder image URL would be worse than an
honest gradient; underline tab switcher replaces daisyUI tabs. `account.tsx`:
avatar-initials circle + profile card, `Button` for sign-out/sign-in CTAs. No
Orders/Scent-profile/Addresses/Settings sidebar tabs were added — the mockup's
Account page assumes an order-history data model this app doesn't have, and
fabricating fake orders would misrepresent the app's actual capabilities;
kept the existing Profile + AddressBook content, only reskinned. All mutation
logic (`useSignIn`/`useSignUp`/`useRecoverPassword`/`useAddresses`/etc.)
untouched — markup and classNames only.

## Question

Rework `src/routes/login.tsx`, `src/routes/account.tsx`, and
`src/components/account/AddressBook.tsx` off raw daisyUI classes (`btn`,
`input-bordered`, `card`, `tabs`) onto the app's own design system (`Button`,
`Icon`, `frost`/`rounded-sm`/`tap-scale`, new tokens/fonts), matching the
mockup's Login split-screen and Account sidebar-nav layout structurally, while
keeping all existing functional copy, form fields, and mutation logic
(`useSignIn`/`useSignUp`/`useRecoverPassword`/`useAddresses`/etc.) unchanged.
No fabricated "Sillage" brand copy — this app's existing site name stays.
