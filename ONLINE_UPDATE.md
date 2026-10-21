# Solo and Online update

## Included implementation

THE AMCOL WAY version 11 now supports optional Online presence alongside the existing Solo journey. The download contains the full project, its original curriculum and instructor materials, the new source code, migrations, tests, and updated deployment instructions. It has not been deployed to a live service.

Solo is the default and opens no presence socket. Cadets can choose Online when beginning or continuing a journey, or switch immediately in Settings. Online rooms follow campus, dorm and Atlantic zone changes. Public and class-code rooms are separate. Saved server profiles supply first-name labels, major, year and avatar appearance. Random connection keys identify peers on the wire.

Teachers can create and close class codes. Cadets can appear offline, use four emotes and twelve fixed phrases, mute other cadets for the page session, or submit a report. There is no free-text chat. A dropped presence connection leaves the current activity running and reconnects with backoff. Browser-save beta remains Solo only.

All academic progress continues through the existing `/api/academy`. Course rules, answer data, rewards, energy, sleep allowance, Monday reset behavior and saved progress formats were preserved.

## Files changed

| Area | Changed existing files |
| --- | --- |
| Worker and identity | `src/worker.mjs`, `src/auth.mjs` |
| Game integration | `public/game/app.js`, `public/game/world.js`, `public/game/index.html`, `public/game/local-academy.js` |
| Deployment and local development | `wrangler.jsonc`, `scripts/configure.mjs`, `.github/workflows/deploy.yml`, `.dev.vars.example` |
| Test entry point and export guards | `package.json`, `tests/export-checks.mjs` |
| Documentation | `README.md`, `DEPLOYMENT.md` |

| Area | Added files |
| --- | --- |
| Presence server and database access | `src/presence-room.mjs`, `lib/presence-store.mjs` |
| Additive D1 migrations | `migrations/0002_class_worlds.sql`, `migrations/0003_presence_reports.sql` |
| Browser transport, controls and protocol | `public/game/presence.js`, `public/game/presence-ui.js`, `public/game/presence.css`, `public/game/presence-protocol.js`, `public/game/api-url.js` |
| Tests | `tests/presence-room.test.mjs`, `tests/presence-worker.test.mjs`, `tests/presence-client.test.mjs`, `tests/presence-world.test.mjs`, `tests/presence-ui.test.mjs` |
| Release notes | `ONLINE_UPDATE.md` |

No dependency versions changed. No original project files were removed. All twelve original test commands remain, followed by the five new presence suites. The only changed original test file extends the migration expectation and adds stricter deployment assertions.

SHA-256 comparison with the uploaded archive confirmed that the curriculum, game balance and progression modules, answer content, both original D1 migrations, 22 minigame source files, 248 book-page images, 10 game assets, seven instructor files, `package-lock.json`, and `source-assets.json` are unchanged.

## Verification completed

| Check | Result |
| --- | --- |
| `npm test` | Passed, including every original suite |
| New Durable Object, privacy and capacity tests | 22 passed |
| New Worker authorization and class tests | 9 passed |
| New browser transport tests | 14 passed |
| New remote-avatar tests using real Three.js without WebGL | 9 passed |
| New actual-app DOM tests | 9 passed |
| `npm run build` | Passed; Wrangler dry run included `PRESENCE_ROOMS`, `DB` and `ASSETS` |
| Generated production configuration | Correct SQLite DO binding and migration; staff emails normalized; development overrides absent |
| Actual local Worker/D1/DO integration | Passed with two independent development cadets using real WebSocket connections |

The 100-player deterministic simulation observed a largest snapshot of **3,246 bytes**, no more than **eight snapshots per second per recipient**, and **zero remaining timers when idle**. These are observed test results, not a benchmark of production browser frame rates or active-room operating cost.

The actual local runtime check verified mutual presence and profile labels, movement and the final stopped state, emotes, fixed-phrase delivery, appear-offline behavior, rapid visibility toggles, saved outfit refresh, mute, persisted reports, zone separation, socket failure and automatic reconnect, browser online/offline events, class creation and isolation, class closure, explicit return to public, and departure when switching to Solo. Academic state was compared before and after presence interactions and remained unchanged apart from the deliberately saved test outfit.

An independent review also identified and verified fixes for three synchronization cases: a newer outfit save arriving during an earlier profile read; hide/unhide within one snapshot batch; and a socket failing while another cadet's snapshot was being assembled.

### Remaining validation limit

Rendered two-browser WebGL play and a physical-phone/mobile layout inspection were **not performed**. The environment had no browser executable, and the browser download endpoints did not provide a usable archive. The real local runtime and protocol checks passed, but they do not establish rendered smoothness or phone frame rates. Production Cloudflare Access sign-in and a live deployment were also not exercised.

## Try two local cadets

Use one local server so both browser profiles share the same Durable Objects.

1. In the extracted project folder, run `npm ci`.
2. Copy `.dev.vars.example` to `.dev.vars` and set:

   ```dotenv
   ENVIRONMENT=development
   DEV_MODE=true
   DEV_USER_ID=local-cadet
   DEV_ALLOW_USER_SWITCH=true
   ```

3. Run `npm run db:local`, then `npm run dev`.
4. Open a normal browser profile at `http://127.0.0.1:8787/game/index.html?storage=server&dev_user=cadet-a`.
5. Open a second browser profile or private window at `http://127.0.0.1:8787/game/index.html?storage=server&dev_user=cadet-b`.
6. Create and save each cadet, then choose **Play online**.

Walk close together and inspect movement, the name labels, a salute, and a quick-chat bubble. Check joystick access at a phone viewport and both normal and Low quality. Switch one cadet to Dorm or Solo and confirm that they disappear from the other campus view. Test Appear offline, mute, class membership and class closure from Settings. Close the presence socket to check the reconnect indicator while an activity stays open.

The development override is accepted only on loopback with the explicit development flags. It grants local test identities staff controls. It cannot select identities on a production hostname.

## Decisions to review

- **Message sizes:** the requested 512-byte cap applies to client commands. Server frames must stay below 4,096 bytes so a 40-peer snapshot can fit. Both limits have validators and tests.
- **Capacity and rendering:** each instance admits 100 connections. It sends the nearest 40 peers within 40 world units. The client draws at most 30 full avatars, or 15 on Low quality. Room selection tries the lowest available instance, bounded to 32 instances per world and zone. Existing occupants are not automatically reassigned to fill gaps.
- **Class closure:** a closed class leaves the game playable in Solo, preserves the selected code and stops automatic retries. It never automatically makes a cadet visible in a public room. Public return requires **Leave class**. A new code or explicit Online retry is also available.
- **Session scope:** mode and hidden preference persist in existing settings. Class selection and mute keys last only for the current page session; reconnects assign new anonymous keys. Class codes admit signed-in cadets who know the code and do not enforce an enrollment roster.
- **Outages:** presence failure is independent from academy requests. A full internet outage retains the existing server-save failure/retry behavior; the update does not silently grant or save offline academic progress.
- **Compatibility date:** changed from `2026-10-20` to `2026-05-22` because the runtime pinned by the original lockfile rejected the later date and could not start locally. Package versions are unchanged, and the corrected configuration passed the actual runtime check.

For production, follow `DEPLOYMENT.md`: configure D1 and Access, set the `STAFF_EMAILS` GitHub Actions variable, apply all pending migrations, and use the supplied deployment workflow. Keep the Durable Object migration tag after deployment. No local database, test cadets, dependency directory, private environment file, or generated production configuration is included in the archive.
