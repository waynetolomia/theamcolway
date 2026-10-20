# Export validation

Validation date: **2026-10-20**. Source game: **version 11**, commit **`3d7019d22655fb3b681f29e2eb0a977d040330c1`**.

## Results

| Check | Result |
| --- | --- |
| Original static asset integrity | 296 files match their recorded source hashes after reversing the one intended sign-in URL replacement |
| Package lockfile reinstall | Passed with npm’s offline cache: 51 installed packages; exact direct versions `jose` 6.2.12, `wrangler` 4.92.0 and `linkedom` 0.18.12 |
| Worker authentication, API and SQL migrations | 11 checks passed using real signed RSA JWTs, mocked JWKS and in-memory SQLite |
| Authoritative academy progression/persistence/client | 46 checks passed |
| Book completeness and coverage | 381 activities, 1,624 questions, 248 source pages and original PDF hash checked |
| RPG rules, reward mapping, migrations and database writes | 19 checks passed |
| RPG dashboard behavior | 12 checks passed |
| Character dashboard behavior | 23 checks passed |
| Integrated academy UI, world interface stub | 33 checks passed; 96 simulated API requests |
| Integrated academy UI, learning fallback | 33 checks passed; 95 simulated API requests |
| Wrangler compilation | Dry run passed; Worker bundle 2,058.93 KiB, compressed 263.12 KiB; DB and ASSETS bindings present |

The 177 behavior checks above are supplemented by the complete book/asset checks. The export’s public assets total **39,423,268 bytes**; the small difference from the source asset total is the shorter sign-in URL. The largest asset remains the original **17,748,540-byte** PDF.

## Commands run

```sh
npm ci --offline --ignore-scripts --no-audit --no-fund --cache .npm-cache
npm test
WRANGLER_LOG_PATH=.build/wrangler.log WRANGLER_SEND_METRICS=false npm run build
```

The log path above keeps development logs in the local build directory. It does not change the built game. The lockfile was generated from public npm registry packages; the checked-in GitHub workflows use `npm ci`.

## Scope

The signed-token tests verify missing and forged identity headers; wrong signatures, issuer and audience; expired, unsigned and expiration-less JWTs; per-subject account separation; remote rejection of local-development identity; missing production setup; protected assets; fixed root/sign-in redirects; JSON/origin/method checks; and actual byte limits including Unicode submissions.

The SQL tests run the exact supplied migrations and account-store statements on real in-memory SQLite. Existing regression checks cover progression and idempotent rewards, both maritime uniforms, workshop/lifeboat gates, staff and first-day missions, the five-sleep weekly cap, Loma’s saved final and daily cap, RPG state, mobile controls and the non-WebGL learning route.

All execution was local and offline apart from retrieving public package dependencies and documentation. No live application was deployed, no GitHub repository was changed, and no student database was opened or copied. Terminal DOM checks establish behavior and content; they are not a rendered browser, phone or WebGL visual inspection. Cloudflare credentials, D1 creation, Access policy setup and the actual production deployment remain the owner’s setup steps described in `README.md`.
