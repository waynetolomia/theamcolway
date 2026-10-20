# Export provenance

- Application: **THE AMCOL WAY**.
- Export date: **2026-10-20**.
- Source game version: **11**.
- Source commit: **`3d7019d22655fb3b681f29e2eb0a977d040330c1`**.
- Source status at export: clean tracked source.
- Copied static files: **296**, originally **39,423,308 bytes** total.
- Original PDF: **17,748,540 bytes**, SHA-256 recorded in `ATTRIBUTIONS.md` and source book metadata.

## Preserved

Every tracked file under the source `public/` tree was copied, including the complete browser game, local Three.js library and license, all supplied book materials and all shared game/rule modules. `source-assets.json` records the SHA-256 of each original static file.

`lib/academy-store.mjs` is copied unchanged. The two SQL migrations are copied unchanged from the original `drizzle/` directory into `migrations/`. The copied academy, book, RPG, dashboard and integrated terminal-DOM checks retain the current source behavior checks.

## Export-specific changes

1. Replaced the original Sites/Vinext/API hosting wrapper with a minimal Cloudflare Worker using the same game content, account store and course/RPG rules.
2. Replaced the old hosting-specific identity header with cryptographic Cloudflare Access JWT verification, exact issuer/audience checks and stable verified user subjects.
3. Changed one frontend sign-in URL in `public/game/academy-ui.js` from the old hosting entry point to `/auth/login`.
4. Added production configuration validation, loopback-only local development identity, Workers asset routing, pinned dependencies/lockfile, GitHub workflows, and deployment documentation.
5. Added offline export/auth/API tests using real signatures and SQLite. No student data or credentials were copied.

The default game rules were not shortened or changed for this package. The export starts with a fresh D1 database and Access identities; it is not a dump or migration of existing student accounts.

## Integrity check

Run `npm test`. The first check compares every asset with `source-assets.json`; for the one permitted sign-in URL edit, it reverses that exact replacement before comparing the original hash. Source paths or content changes need an intentional manifest/update decision rather than silently claiming an unchanged export.

## Excluded

Original repository history, hosting-service private configuration/bindings, connector code, credentials, account/database contents, logs, caches and installed `node_modules` are not part of the downloadable source. Instructor catalog files, when added by the export process, live outside `public/` and do not alter the shipped game.
