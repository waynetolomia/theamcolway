# Deployment and operations

## Deployment target

The export runs one Cloudflare Worker with a static-asset binding named `ASSETS` and a D1 binding named `DB`. It uses no Next.js/Vinext runtime and no original hosting-service connectors. GitHub stores the code and runs the supplied workflows. The fully working game requires this Worker and D1; publishing only the HTML on GitHub Pages omits authenticated saves, authoritative rewards and the weekly sleep limit.

The Worker’s default entry point is `src/worker.mjs`. `/` redirects to `/game/index.html`; the shared `/api/academy` handles account loads and mutations. `assets.run_worker_first=true` authenticates both API calls and every asset before serving files from `public/`. HTML path rewriting is disabled to preserve the existing relative frontend imports. The largest supplied asset is the 17,748,540-byte PDF, below Cloudflare’s documented 25 MiB individual static-asset limit. [Routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/) · [Limits](https://developers.cloudflare.com/workers/platform/limits/)

## Direct CLI deployment

The GitHub workflow is the recommended route. These commands perform the equivalent deployment from your own terminal if preferred. Install dependencies with `npm ci`, authenticate with `npx wrangler login`, and create D1 with `npx wrangler d1 create the-amcol-way-db` first.

Set your actual database ID in the terminal environment:

```sh
export D1_DATABASE_ID='YOUR-D1-DATABASE-UUID'
npm run configure -- --bootstrap
npm run db:remote
npm run deploy
```

This is a deliberately closed bootstrap deployment. Configure Cloudflare Access for the complete production hostname, then set:

```sh
export ACCESS_TEAM_DOMAIN='your-college.cloudflareaccess.com'
export ACCESS_AUD='YOUR-EXACT-APPLICATION-AUDIENCE-TAG'
npm run configure
npm run db:remote
npm run deploy
```

PowerShell users can set a variable with `$env:D1_DATABASE_ID = 'YOUR-D1-DATABASE-UUID'` and similarly for the Access variables. These are configuration identifiers. Store deployment API tokens only in your credential manager or GitHub Actions secrets.

The configure script creates ignored `wrangler.production.json` from the checked-in `wrangler.jsonc`. It rejects placeholder database IDs, missing/invalid Access settings and enabled production `DEV_MODE`. Always run `npm run configure` after changing identifiers. The production `db:remote` and `deploy` scripts use this generated file explicitly.

The GitHub deployment workflow requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Locally, `wrangler login` supplies your own authenticated session. No credentials are included in this export. Cloudflare’s [CI authentication guide](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/) explains account IDs, API tokens and Workers scopes.

## Authentication model

Use one self-hosted Access application for the whole production hostname and an Allow policy for your cadets/staff. Access performs the interactive login and sends a signed `Cf-Access-Jwt-Assertion` to the Worker. The `jose` dependency validates the RS256 signature against the team’s HTTPS signing-key set and checks the **exact** issuer, **exact** application audience, expiration, issue-time claim and nonempty subject. The JWKS resolver caches signing keys and supports rotation. [Cloudflare JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/) · [jose](https://github.com/panva/jose)

Database account IDs are `access:<team-domain>:<verified-subject>`. Email headers, browser-provided user IDs, request-body identity fields and the old hosting header cannot select another cadet’s record. Changing an email is different from changing the identity provider’s user subject. Moving to a new Access team or new user subjects requires an explicit administrator-led data migration; this download starts with an empty D1 database.

Missing production Access configuration returns 503 and serves no game assets. Invalid/missing JWTs return 401 and cannot create accounts. `/auth/login` is a fixed redirect to `/game/index.html`; it accepts no external return URL and exposes no account content. On the protected hostname this top-level navigation starts or refreshes Access sign-in. A valid token must still be supplied when the redirected game request reaches the Worker.

`DEV_MODE=true` is accepted only together with `ENVIRONMENT=development`, an explicit `DEV_USER_ID`, and a loopback URL. It is a convenience for your computer, not a way to operate a public deployment. The generated production configuration never includes it. Keep `.dev.vars` out of Git; `.dev.vars.example` is the template.

The export does not enable preview URLs. If you add another public hostname, protect it with the same intended application/policy and verify its audience configuration before sharing that address. A custom domain is optional because Access supports `workers.dev`. [Cloudflare Access configuration](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)

## Database and weekly progress

The exact source migrations create:

| Table | Data |
| --- | --- |
| `academy_accounts` | One JSON progress document per verified user, a compare-and-swap revision and update timestamp |
| `academy_submissions` | Book answers and reviews per user, journey and activity; composite primary key |

`lib/academy-store.mjs` uses a D1 session starting at the primary and compare-and-swap updates. Book submissions and progress changes share a guarded batch. A failed update does not commit a second reward or sleep. Sleep request receipts make retries idempotent. A new journey is stored inside the same user account and preserves that account’s real-week allowance.

All timestamps used for progression come from the Worker’s clock. The Bangkok week key is calculated on requests, so it needs no scheduled job or cron trigger. Its boundary is Monday at 00:00 Asia/Bangkok (Sunday at 17:00 UTC). Each successful dorm sleep spends one of the five weekly resets; physical real-time waiting alone never increments a game day. The optional body record, traits, XP reward ledger and care state use the same account document.

The migrations are additive and do not drop tables. `wrangler d1 migrations apply DB --remote --config wrangler.production.json` applies unapplied migrations. In CI the CLI runs non-interactively. Consult [D1 migration commands](https://developers.cloudflare.com/d1/wrangler-commands/) and [D1 backups](https://developers.cloudflare.com/d1/reference/time-travel/) before operational database changes beyond this initial schema.

## Verification commands

```sh
npm ci
npm test
npm run build
```

The export checks preserve all original tracked assets except the intended sign-in URL. JWT/API tests generate real RSA signatures, supply a mocked JWKS without network requests, run the exact SQL migrations in in-memory SQLite, and verify account separation, invalid tokens, local-development restrictions, same-origin JSON writes, actual byte limits and static routing. Existing rules and terminal DOM suites check the course, uniforms, NPCs, daily and weekly progression, RPG rewards and the map-based fallback.

`npm run build` is an offline Wrangler dry run. It bundles the Worker and reports deployment size and bindings without publishing or changing D1. Terminal DOM tests assess behavior; they do not claim a rendered mobile/WebGL visual inspection. The source game retains its fallback learning mode when WebGL is unavailable.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| **Academy setup** / `access_not_configured` | Finish Access configuration and redeploy with the exact team domain and application audience; a bootstrap deployment intentionally stays closed |
| No Access sign-in screen, then a 401 page | The game hostname may be missing its Access application/policy, or only a path is protected; protect the complete production hostname |
| Sign-in succeeds but game returns 401 | The JWT issuer/audience must match the configured Access application; update GitHub variables, run configuration/deployment again, then return through `/auth/login` |
| `storage_unavailable` | Confirm the `DB` binding, database ID and both remote migrations; server responses deliberately omit SQL internals |
| Local server returns setup/identity error | Copy `.dev.vars.example` to `.dev.vars`, keep `DEV_MODE=true` and `ENVIRONMENT=development`, and visit the loopback address |
| “Table already exists” during manual setup | Use the supplied migrations and migration history consistently; avoid separately creating the same tables by hand |
| Wrong origin / a save does not submit | Open the game directly on its deployed hostname so the frontend and `/api/academy` share one origin |
| A cadet has no saves after moving hosting | This download contains no student records; the new deployment creates new Access-based accounts |
| Five weekly sleeps are used | Wait for the next Bangkok Monday boundary; a new journey or another device does not replenish the account’s used allowance |
| GitHub deployment fails for permissions | Check the two Cloudflare secrets, account scope, Workers deployment permission and D1 edit permission for migrations |

Only files under `public/` are served by the asset binding. Instructor documents and deployment files stay outside that directory. The game’s source answer banks remain in frontend JavaScript, matching the existing educational gameplay.
