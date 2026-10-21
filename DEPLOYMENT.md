# Deployment and operations

## Deployment target

The export runs one Cloudflare Worker with static assets (`ASSETS`), D1 (`DB`), and SQLite-backed Durable Object rooms (`PRESENCE_ROOMS`). It uses no Next.js/Vinext runtime and no original hosting-service connectors. GitHub stores the code and runs the supplied workflows. The fully working game requires this Worker and D1; publishing only the HTML on GitHub Pages omits authenticated saves, authoritative rewards, a server-enforced weekly sleep limit and Online mode.

The Worker’s default entry point is `src/worker.mjs`. `/` redirects to `/game/index.html`; the shared `/api/academy` handles account loads and mutations. `assets.run_worker_first=true` authenticates both API calls and every asset before serving files from `public/`. HTML path rewriting is disabled to preserve the existing relative frontend imports. The largest supplied asset is the 17,748,540-byte PDF, below Cloudflare’s documented 25 MiB individual static-asset limit. [Routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/) · [Limits](https://developers.cloudflare.com/workers/platform/limits/)

The checked-in compatibility date is `2026-05-22`, matching the newest date accepted by the Workers runtime installed from this lockfile. The uploaded `2026-10-20` date prevented `npm run dev` from starting with that pinned runtime. No package versions were changed. When upgrading Wrangler later, update and test the compatibility date with it.

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
export STAFF_EMAILS='teacher@example.edu,director@example.edu'
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
| `class_worlds` | Six-character class code, verified staff creator, creation timestamp and optional closure timestamp |
| `presence_reports` | Report ID, verified reporter and reported account IDs, room and report timestamp; never broadcast to players |

`lib/academy-store.mjs` uses a D1 session starting at the primary and compare-and-swap updates. Book submissions and progress changes share a guarded batch. A failed update does not commit a second reward or sleep. Sleep request receipts make retries idempotent. A new journey is stored inside the same user account and preserves that account’s real-week allowance.

All timestamps used for progression come from the Worker’s clock. The Bangkok week key is calculated on requests, so it needs no scheduled job or cron trigger. Its boundary is Monday at 00:00 Asia/Bangkok (Sunday at 17:00 UTC). Each successful dorm sleep spends one of the five weekly resets; physical real-time waiting alone never increments a game day. The optional body record, traits, XP reward ledger and care state use the same account document.

The migrations are additive and do not drop tables. `wrangler d1 migrations apply DB --remote --config wrangler.production.json` applies unapplied migrations. In CI the CLI runs non-interactively. Consult [D1 migration commands](https://developers.cloudflare.com/d1/wrangler-commands/) and [D1 backups](https://developers.cloudflare.com/d1/reference/time-travel/) before operational database changes beyond this initial schema.

## Verification commands

```sh
npm ci
npm test
npm run build
```

The export checks verify unchanged source assets by hash and retain targeted checks for the beta and Online extensions. JWT/API tests generate real RSA signatures, supply a mocked JWKS without network requests, run the exact SQL migrations in in-memory SQLite, and verify account separation, invalid tokens, local-development restrictions, same-origin JSON writes, actual byte limits and static routing. Existing rules and terminal DOM suites check the course, uniforms, NPCs, daily and weekly progression, RPG rewards and the map-based fallback.

`npm run build` is an offline Wrangler dry run. It bundles the Worker and reports deployment size and bindings without publishing or changing D1. Terminal DOM tests assess behavior; they do not claim a rendered mobile/WebGL visual inspection. The source game retains its fallback learning mode when WebGL is unavailable.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| **Academy setup** / `access_not_configured` | Finish Access configuration and redeploy with the exact team domain and application audience; a bootstrap deployment intentionally stays closed |
| No Access sign-in screen, then a 401 page | The game hostname may be missing its Access application/policy, or only a path is protected; protect the complete production hostname |
| Sign-in succeeds but game returns 401 | The JWT issuer/audience must match the configured Access application; update GitHub variables, run configuration/deployment again, then return through `/auth/login` |
| `storage_unavailable` | Confirm the `DB` binding, database ID and all pending remote migrations; server responses deliberately omit SQL internals |
| Local server returns setup/identity error | Copy `.dev.vars.example` to `.dev.vars`, keep `DEV_MODE=true` and `ENVIRONMENT=development`, and visit the loopback address |
| “Table already exists” during manual setup | Use the supplied migrations and migration history consistently; avoid separately creating the same tables by hand |
| Wrong origin / a save does not submit | Open the game directly on its deployed hostname so the frontend and `/api/academy` share one origin |
| A cadet has no saves after moving hosting | This download contains no student records; the new deployment creates new Access-based accounts |
| Five weekly sleeps are used | Wait for the next Bangkok Monday boundary; a new journey or another device does not replenish the account’s used allowance |
| GitHub deployment fails for permissions | Check the two Cloudflare secrets, account scope, Workers deployment permission and D1 edit permission for migrations |

Only files under `public/` are served by the asset binding. Instructor documents and deployment files stay outside that directory. The game’s source answer banks remain in frontend JavaScript, matching the existing educational gameplay.

## Online presence deployment

`wrangler.jsonc` registers `PresenceRoom` with the `PRESENCE_ROOMS` binding and a `presence-v1` Durable Object migration using `new_sqlite_classes`. Keep that migration tag after deployment. Future changes to Durable Object classes require a new migration tag; do not rename or remove the deployed class casually.

```json
"durable_objects": {
  "bindings": [{ "name": "PRESENCE_ROOMS", "class_name": "PresenceRoom" }]
},
"migrations": [
  { "tag": "presence-v1", "new_sqlite_classes": ["PresenceRoom"] }
]
```

The production configure script retains both fields. The rooms use `ctx.acceptWebSocket`, `webSocketMessage`, `webSocketClose` and socket attachments for hibernation recovery. A changed room schedules one short snapshot batch; a clean room has no repeating timer or alarm.

Two additive D1 migrations accompany the update:

1. `0002_class_worlds.sql` creates `class_worlds` and its staff/open-code index.
2. `0003_presence_reports.sql` creates `presence_reports` and its review indexes.

Keep the original two migrations and existing D1 database. Apply all pending migrations with the existing `db:local` or `db:remote` command. No academy account or submission schema changes are required. Presence only reads the saved profile and semester from `academy_accounts`; learning mutations still go through `/api/academy`.

Set `STAFF_EMAILS` in **GitHub → Settings → Secrets and variables → Actions → Variables**. `deploy.yml` passes it to `scripts/configure.mjs`, which validates and writes it into production variables. Use the email claim verified by Cloudflare Access. Header assertions, client profile names and role fields cannot grant staff access. With an empty allowlist, production users cannot create or close class worlds.

### Endpoints and room behavior

- `GET /api/presence?zone=campus|dorm|atlantic&code=ABC-DEF`: authenticated WebSocket upgrade. `code` is optional; every upgrade requires an exact same-origin `Origin` and a verified Access identity.
- `GET /api/presence/session`: authenticated capability/staff flag. Supplying `code` also checks that the code is open without leaving the current room.
- `GET /api/class-worlds`: staff member's open codes.
- `POST /api/class-worlds`: staff-only JSON `{ "action": "create" }` or `{ "action": "close", "code": "ABC-DEF" }`.

Rooms are named `public:<zone>:<instance>` or `class:<code>:<zone>:<instance>`. Admission checks the 100-connection cap inside the room after asynchronous database reads. Lower instances are tried first. Selection is bounded to 32 instances per world/zone (3,200 connections); exhaustion keeps the cadet in the solo fallback while reconnecting. Existing cadets are not automatically moved between instances when a lower one becomes available.

Closing a class first closes its D1 code, then disconnects the corresponding rooms in all three zones with WebSocket close code `4003`. The client shows **Class closed**, clears remote avatars and stops automatic retries while keeping the private code selected. Solo gameplay remains available. Neither connection recovery nor a zone change automatically sends the cadet into the public world. In Settings, the cadet can choose **Leave class** for public rooms, enter another open code, or explicitly select **Play online** to retry the selected code; a closed code still refuses admission. If room cleanup fails, repeat the idempotent close operation; the closed D1 code already refuses new joins.

The browser persists `playMode` and `presenceHidden` in `seapath.settings.v1`. Class selection and session mute keys are held only in page memory and clear on reload or page closure. Mutes apply to anonymous connection keys, not permanent account identities. Hidden cadets continue receiving nearby avatars, but their own emote and quick-chat controls are disabled until they turn off **Appear offline**.

Ordinary connection failures show **Reconnecting…** and retry with 1, 2, 4, 8, 16 and then 30 second delays. Browser offline events clear remote avatars immediately; new sockets wait until connectivity returns. Presence transport does not cancel an open activity or control academy saves and sleep requests. If the whole network is unavailable, `/api/academy` retains its existing save-error/retry behavior; the presence fallback does not commit unsaved progress or switch to browser-save beta.

Every connection gets a random 12-character public key. Account IDs, JWTs, email addresses, body records, scores and private academic data are excluded from broadcasts. Visible first names and appearance are projected from saved server data. `refresh` re-reads this profile rather than accepting appearance through the socket.

Client commands are limited to 512 UTF-8 bytes and strict message schemas. Server snapshots are separately limited to less than 4,096 bytes. Latest movement state is batched at no more than eight snapshots per second per recipient, with at most 40 peers within 40 world units. Unchanged snapshots are suppressed. Incoming movement is limited to ten messages per second per connection; quick chat and emotes share one action per two seconds. Invalid phrase IDs and extra free-text fields are rejected.

### Usage and hibernation

Cloudflare currently applies a **20:1 billing ratio to incoming WebSocket messages** for Durable Object request usage. HTTP connections and other operations have their own request accounting. Idle objects that are eligible for hibernation incur no duration charges; active rooms, requests, and any database/storage operations remain metered. This is not a promise that an active 100-cadet class costs nothing. SQLite-backed Durable Objects are available on the Workers Free plan, subject to its usage limits.

See the official [Durable Object pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [WebSocket hibernation guide](https://developers.cloudflare.com/durable-objects/best-practices/websockets/) and [lifecycle documentation](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/) (checked 21 October 2026). Continuous timers prevent hibernation, which is why this implementation stops scheduling once the latest changes have been flushed.

## Two development cadets on one local server

Use one local Wrangler server so both cadets connect to the same in-memory Durable Objects. Separate independent Wrangler processes do not share live sockets simply because they use the same database name.

1. Run `npm ci` and copy `.dev.vars.example` to `.dev.vars`.
2. Set these local-only values:

   ```dotenv
   ENVIRONMENT=development
   DEV_MODE=true
   DEV_USER_ID=local-cadet
   DEV_ALLOW_USER_SWITCH=true
   ```

3. Run `npm run db:local`, then `npm run dev`.
4. Open a normal browser at `http://127.0.0.1:8787/game/index.html?storage=server&dev_user=cadet-a`.
5. Open a second browser profile or private window at `http://127.0.0.1:8787/game/index.html?storage=server&dev_user=cadet-b`.
6. Create/save a different cadet in each browser and choose **Play online**. Walk nearby, send an emote or quick chat, switch zones, and test **Appear offline** and **Solo** in Settings.
7. The local identity is staff in this explicitly guarded development environment. Create a class code, join it in both browsers, then close it to test class isolation and disconnection.

The client forwards `dev_user` only to known same-origin APIs on exact loopback hosts. The server accepts it only when all four local development conditions above are met. Production ignores the override, and production configuration rejects enabled development flags. Keep `.dev.vars` out of Git.

To test presence fallback independently of academic saves, temporarily block or close the `/api/presence` WebSocket in browser developer tools. With the entire device offline, the existing server-save retry behavior still applies; the game does not claim an unsaved grade or silently move progress into browser storage.

## Learning Hub embedding

Some browsers restrict the Access sign-in cookie when the game is embedded in a cross-site Learning Hub `<iframe>`. Open the signed-in game in its own tab, or serve the hub and game from the same site with the appropriate Access protection. The browser-save beta remains available in an iframe but supports Solo only. See [Cloudflare Access cookie behavior](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/) and [browser third-party cookie guidance](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Third-party_cookies).
