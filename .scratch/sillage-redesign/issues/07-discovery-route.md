Type: task
Status: resolved
Blocked by: 01, 02

## Answer

Added `src/routes/discovery.tsx`. The "assistant" is `scoreReply()` — a pure
keyword-overlap function against a local `CATALOG` array, no
`window.claude.complete`, no `fetch`, no API key; a `setTimeout` only paces
the reply so it doesn't look instant, nothing external is called. The UI
also labels itself "Scripted demo — not a live AI" and a "Mock" badge so it
can't be mistaken for a real integration by a reviewer. Set-builder (3 vial
slots) is local `useState`, no cart mutation, "Add set to bag" explicitly
disabled from doing anything beyond local state (footer note: "Demo only —
not wired to checkout"). No product photography exists for this fictional
catalog, so vials render as lettered swatches instead of fabricated image
URLs. All chat text renders through JSX children — no
`dangerouslySetInnerHTML` anywhere. Linked from `Menu.tsx`'s quick-links list
(added Discovery + Sua sacola/cart) so both new routes are reachable, not
orphaned.

## Question

Add a new `/discovery` route (`src/routes/discovery.tsx`) matching
`templates/discovery/Discovery.dc.html`'s AI-assistant-plus-set-builder
layout. The chat assistant is a **scripted local mock**: canned/keyword-scored
replies against a small in-file catalog (same pattern as the mockup's
`fallbackReply`), no `window.claude.complete`, no external fetch, no API key —
must not read as a real integration to a reviewer. Set-builder (3 vial slots,
add/remove) is local component state, no cart mutation. All rendered chat
text goes through React text nodes (no `dangerouslySetInnerHTML`).
