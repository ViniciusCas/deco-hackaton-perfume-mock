# Provision new deploy identity on deco.host

Type: task
Status: resolved
Blocked by: 01

## Question

The current KV namespace ids in `wrangler.jsonc` (`DECO_KV`, `SITES_KV`) are physical Cloudflare resources tied to deco's shared account/template deployment, not just names. Renaming the site slug (tickets 01/02) doesn't create new ones. Using the deco CLI (and/or Cloudflare dashboard), provision a fresh site registration and KV namespaces under the new slug, and update `wrangler.jsonc`'s `kv_namespaces` ids accordingly. This likely needs human-driven auth (deco login / Cloudflare account access) — flag if it can't be done headlessly.

## Answer

Worked through this live with the user (HITL — needed their own Cloudflare auth), hitting and resolving four real blockers along the way:

1. **`wrangler.jsonc`'s `account_id` was still deco's shared template account** (`c95fc4cec7fc52453228d9db170c372c`) — the user's own OAuth token had no access to it, causing an opaque "Authentication error [code: 10000]" on the very first KV create attempt. Fixed by swapping in the user's real account id (`4dfd0ce81cc807cef0c69fe3f8477b2f`, confirmed via `wrangler whoami`).
2. **`wrangler kv namespace create` auto-append behavior duplicated the `DECO_KV` binding** instead of replacing it, producing an unrelated-looking "assigned to multiple KV Namespace bindings" config error that blocked *every* subsequent wrangler command (even `kv namespace list`) until fixed by hand.
3. Provisioned fresh KV namespaces on the user's own account: `DECO_KV` → `2a4498a3d15c4821bdbca18e56655269`, `SITES_KV` → `b49bb9a9c6b941868d7810752407e9d1`. Wired both into `wrangler.jsonc`, replacing the stale deco-owned ids (`a205a78e...`, `ad0b74fc...`).
4. **`dist/server/wrangler.json` is a build-time snapshot** the Vite/Cloudflare adapter bakes and `wrangler deploy` actually reads — not the root `wrangler.jsonc` directly. A stale `dist/` from before this session's renames caused a `--dry-run` to show old ids/site-name even after the source file was fixed; resolved with `npm run build`.
5. **`tail_consumers: [{ service: "deco-otel-tail" }]` blocked the real deploy** — that's deco's own tail worker, living in deco's account, and even attempting to use tail workers requires the paid Workers plan. User chose to drop it entirely (see map Decision) rather than pay for a plan to reach infrastructure they don't have access to anyway. Removed from `wrangler.jsonc` with a comment explaining why.
6. First deploy attempt after fixing all of the above also needed a one-time interactive `workers.dev` subdomain registration — the user ran `wrangler deploy` themselves in an interactive terminal to answer that prompt (something a non-interactive shell can't do) and picked `sillage-hackaton`.
7. Immediately after that first successful deploy, both my sandbox and the user's own Firefox got `SSL_ERROR_NO_CYPHER_OVERLAP` / TLS handshake failures hitting the new hostname — a real (not sandbox-specific) SSL-cert-provisioning propagation delay that resolved on its own within about a minute of retrying.

**Result**: **https://sillage.sillage-hackaton.workers.dev** is live, verified 200 on repeated checks, `<title>Sillage — Fine Fragrance</title>`, and a grep of the rendered HTML for `deco\.cx|decoims\.com|demo-storefront` returns zero matches. Fully independent of deco's shared account — own Cloudflare account, own KV namespaces, own worker identity.
