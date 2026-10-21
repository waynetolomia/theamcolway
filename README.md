# THE AMCOL WAY

A mobile-friendly seafarer learning RPG: create a cadet, explore AMCOL and its separate dormitory, complete eight semesters, develop skills and traits, and prepare for sea training.

This is the **GitHub deployment export of game version 11**, source commit `3d7019d22655fb3b681f29e2eb0a977d040330c1`, with the **Solo and Online play update**. It includes the existing 3D game, the full supplied course book, mini-game content, server-owned progress rules, database migrations, tests, and deployment workflows.

**GitHub stores the repository and runs deployment Actions. Cloudflare Workers hosts the game, D1 stores each cadet’s progress, and Cloudflare Access provides individual sign-in.** A custom domain is optional: you can protect the Worker’s `workers.dev` address. GitHub Pages is a static host and does not run this game’s account API or database. [Hosting references](#official-hosting-references)

## What is included

| Area | Included behavior |
| --- | --- |
| Character and world | Male/female cadets; DECK/ENGINE majors; campus, two four-storey academic buildings, Atlantic simulator rooms, separate dormitory; mobile joystick, walking/running and rotating camera |
| Play modes | Solo by default; authenticated Online rooms with up to 100 connections, private class codes, appear offline, four emotes and fixed quick chat |
| Staff and first day | Fourteen NPC introductions, staff role dialogue, 27 staff missions, Tr. Dream’s end-of-Year-2 sea-training review |
| Book course | 381 required mini-games (about 2,080 auto-checked questions) across four years/eight semesters: vocabulary, reading comprehension, reading trivia, fill in the blanks, sentence scrambles, grammar, listening, safety, COLREG, maritime maths and science; 248 book-page images and original PDF |
| Safety and fitness | Eight rotating lifeboat safety mini-games; PT, running and football; workshop suit and immersion-suit entry requirements |
| Final assessment | A saved random set of 50 Loma Lounge mini-games drawn from 273 candidates: 20 major-specific and 30 shared; at most five new final completions per game day |
| Progression | Academic Office mission board, daily release of assignments, required dorm fitness before sleep, five successful sleeps per real week |
| RPG | Character XP, nine skills, starter traits, earned traits, care meters, optional fictional height/weight/BMI record; rewards recorded in the account ledger |
| Answer catalog | [Complete catalog](instructor/CONTENTS.md) and answer files in `instructor/`; these are outside the deployed asset directory |

The authoritative content and rules remain in `public/game/`. `source-assets.json` records the original tracked assets and SHA-256 hashes; subsequent beta and Online extensions are covered by the accompanying regression checks. Online presence has its own endpoint and never writes academic progress.

## Quick start on your computer

Install **Node.js 24 LTS** (minimum supported version: 22.13). Unzip the download, then open a terminal **inside `theamcolway`** so `package.json` is in the current directory.

```sh
npm ci
npm test
npm run build
cp .dev.vars.example .dev.vars
npm run db:local
npm run dev
```

Open `http://127.0.0.1:8787` when running your own local server. On Windows, copy `.dev.vars.example` to `.dev.vars` with File Explorer or PowerShell `Copy-Item .dev.vars.example .dev.vars`.

The local development account is the fixed `DEV_USER_ID` in `.dev.vars`. It is accepted only when `DEV_MODE=true`, `ENVIRONMENT=development`, and the request URL is `localhost`, `127.0.0.1` or `[::1]`. Production requests cannot use this mode. Local D1 data stays in your local `.wrangler/` directory and is excluded from Git.

`npm run build` runs **`wrangler deploy --dry-run`** to compile the Worker; it does not publish. Tests use terminal DOMs, generated signed JWTs and in-memory SQLite. They do not require a running web server or a Cloudflare account.

## Editing the mini-games

The 381 book games are generated, not hand-edited. Edit a question bank, then rebuild and test:

| What | Where |
| --- | --- |
| Reading comprehension answers (from the book’s own questions) | `scripts/minigames/reading/unit-01.mjs` … `unit-10.mjs`, `finals.mjs` |
| COLREG 1972, situations and night lights | `scripts/minigames/banks/colreg.mjs`, `colreg-scenarios.mjs` (Years 3–4), `lights.mjs` |
| Safety and step-order procedures | `scripts/minigames/banks/safety.mjs`, `sequences.mjs` |
| Grammar per unit | `scripts/minigames/banks/grammar.mjs`, `grammar-more.mjs` |
| Maths and science calculations, gauges | `scripts/minigames/banks/math.mjs`, `science.mjs` (difficulty by year, DECK/ENGINE contexts, number entry from Year 2) |
| Vocabulary, trivia, scrambles, listening | Taken automatically from the book text in `scripts/minigames/source/book-activities.json` |

```sh
npm run build:minigames   # rewrites ACTIVITIES in book-course.js, the answer key and instructor/QUESTION_BANK.json
npm run audit             # docs/CONTENT_AUDIT.md and docs/CURRICULUM.md
npm run pacing            # docs/PACING.md: study days, weeks, XP and rank per semester
npm test
```

Game ids, semesters and locations never change, so saved progress stays valid after a rebuild. Many games have equivalent alternative question sets (`variants`); each cadet plays one, chosen from their journey and major, and the set is saved with the first attempt. The full answer key for teachers is `instructor/MINIGAME_ANSWER_KEY.json`; `instructor/QUESTION_BANK.json` lists every playable question with its objective, subject, year, semester, major, difficulty, location, NPC, format, answer and tolerance, hint, explanation, skills, source and review status.

Game balance (study days, mission slots, energy, XP curve, ranks) lives in `public/game/game-config.js`. The rules, the HUD and the in-game Cadet Handbook all read it.

## Beta without Cloudflare (browser saves)

For beta testing, `public/` also runs on any static host, including GitHub Pages or a learning hub. When `/api/academy` is missing, the game applies the same course rules in the browser and saves each player's progress in that browser's localStorage. **Settings → Browser save backup** downloads or restores the save.

- **GitHub Pages:** set **Settings → Pages → Source** to **GitHub Actions**. Each push to `main` runs the tests and publishes the game with the **Publish beta to GitHub Pages** workflow at `https://YOUR-ACCOUNT.github.io/REPO/` (the root redirects to `game/index.html`).
- **Learning hub:** copy the `public/` folder to the hub, or embed the published game:
  ```html
  <iframe src="https://YOUR-ACCOUNT.github.io/REPO/game/index.html?storage=local"
          title="THE AMCOL WAY" style="width:100%;height:85vh;border:0"
          allow="fullscreen; autoplay"></iframe>
  ```
- **Forcing a mode:** `?storage=local` or `?storage=server` in the URL, or `<meta name="amcol-storage" content="local">` in `game/index.html`, skips detection.

Beta limits: progress stays on one browser and device, and clearing site data erases it. Inside a hub iframe, the browser keeps a separate save per hub website. Players can bypass the weekly sleep allowance by clearing storage, and instructors cannot see their results. Use the Cloudflare deployment below when those matter.

## Play modes

Choose **Play solo** or **Play online** when starting or continuing a cadet. The play mode and **Appear offline** preference are saved in the existing browser settings. Settings can switch modes immediately during play. The selected class code and mute choices last only for the current page session; reloading or closing the page clears them.

- **Solo** opens no presence connection. The current learning, saves, sleep allowance and rewards continue as before.
- **Online** shows other signed-in cadets in the same campus, dormitory or Atlantic room instance. Labels show only first name, major and year. Appearance is read from the saved academy profile. Up to 100 connections can share an instance; overflow joins the next available instance.
- **Class codes:** enter an open six-character code, displayed as `ABC-DEF`, to join that class's rooms. Leaving the code returns to the public world. Staff listed in `STAFF_EMAILS` can create and close codes in the **Class world** panel. If a teacher closes your class, the chip shows **Class closed**, play continues in Solo, and the code stays selected without automatic retries or a public-room join. Use Settings to leave the class, enter another open code, or explicitly retry with **Play online**. A code is an invitation for signed-in cadets who know it; it is not a student roster.
- **Appear offline:** keep seeing the room while hiding your own avatar. Emote and quick-chat controls are disabled while hidden; turn off **Appear offline** to send signals again.
- **Communication:** wave, salute, thumbs-up, cheer, and twelve fixed quick-chat choices. A bubble lasts four seconds. Select a cadet to mute their bubbles and emotes for the session or send a report. Reports are recorded in D1 for college administrators to review.
- **Connection fallback:** when the presence connection fails, remote avatars clear and the game continues with **Reconnecting…** displayed. Retries back off from 1 second to 30 seconds. Switching to Solo cancels retries. A presence-only outage does not interrupt an open activity or prevent academy saves or sleep requests. A complete internet outage still uses the existing academy save-error/retry behavior; Online fallback does not grant or save progress offline.

The nearest 40 visible peers within 40 world units are included in movement updates. At most 30 are drawn as full avatars, or 15 on Low quality. The status chip reports the nearby interest set, not total school enrolment.

**Browser-save beta is Solo only.** GitHub Pages and `?storage=local` hide Online and explain that it requires the college sign-in deployment.

For a local two-cadet check, see [Two development cadets on one local server](DEPLOYMENT.md#two-development-cadets-on-one-local-server). No production deployment is needed for that check.

## Deploy through GitHub

### 1. Create the repository

Create a GitHub repository, then commit **the contents of this folder**. Include `.github/`, `.gitignore`, `.dev.vars.example`, `package.json` and `package-lock.json`. Do not upload the ZIP as the only repository file, or put the whole project one folder below the repository root.

For a new empty repository, you can use these commands after replacing `YOUR-ACCOUNT` with your GitHub account or organization:

```sh
git init -b main
git add .
git commit -m "Add THE AMCOL WAY deployment package"
git remote add origin https://github.com/YOUR-ACCOUNT/the-amcol-way.git
git push -u origin main
```

This package contains the supplied book, book-page images and answer banks. Choose repository visibility and sharing permissions appropriate for those materials. The download contains no student records, Cloudflare credentials, or original repository history.

### 2. Create a Cloudflare D1 database

From the unpacked folder, authenticate to your own Cloudflare account and create an empty database:

```sh
npx wrangler login
npx wrangler d1 create the-amcol-way-db
```

Copy the returned `database_id`. Keep the database name `the-amcol-way-db` unless you intentionally update the configuration. The two supplied migrations create the account and submission tables; they do not import any existing cadets. Cloudflare’s [D1 getting-started guide](https://developers.cloudflare.com/d1/get-started/) explains database creation and bindings.

### 3. Add GitHub Actions configuration

In your repository, open **Settings → Secrets and variables → Actions**.

| Kind | Name | Value |
| --- | --- | --- |
| Secret | `CLOUDFLARE_API_TOKEN` | An API token for your own deployment account: Workers deployment permission and D1 edit permission |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| Variable | `D1_DATABASE_ID` | The UUID returned by `wrangler d1 create` |
| Variable | `ACCESS_TEAM_DOMAIN` | Add after the Access setup below: for example `your-college.cloudflareaccess.com`, without `https://` or a trailing slash |
| Variable | `ACCESS_AUD` | Add after the Access setup below: the exact Application Audience tag for the game’s Access application |
| Variable | `STAFF_EMAILS` | Comma-separated verified Access email addresses allowed to create and close class worlds; matching ignores case |

For the token, start with Cloudflare’s **Edit Cloudflare Workers** template, scope it to your account, and include **Account → D1 → Edit** for migrations. A `workers.dev` deployment does not need a purchased domain. See the [official GitHub Actions authentication guide](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/).

### 4. Make a closed first deployment

In GitHub, open **Actions → Deploy THE AMCOL WAY → Run workflow**. Select the `main` branch and set **bootstrap** to **true** for this first run.

The workflow installs the lockfile dependencies, runs the tests, compiles a dry run, applies the D1 migrations and deploys the Worker. Until Access is configured, the Worker responds with an **Academy setup** page and blocks game assets and accounts. Its address is shown in the deployment log and Cloudflare dashboard.

### 5. Protect the game address and finish sign-in

Use Cloudflare Access to protect the **entire production hostname**, including `/game/*` and `/api/*`. A reliable option is a **self-hosted application** in **Zero Trust → Access controls → Applications** whose application domain is your exact Worker hostname, for example `the-amcol-way.YOUR-SUBDOMAIN.workers.dev`, without limiting it to one path. Set an **Allow** policy for the cadets and staff who may sign in. Configure an identity provider or email one-time PIN as appropriate for your college.

Cloudflare also provides an **Enable Cloudflare Access** entry for a Worker’s `workers.dev` route in its dashboard. If you use this shortcut, check that it protects production traffic and the complete hostname. See [Cloudflare’s hostname protection guide](https://developers.cloudflare.com/workers/configuration/cloudflare-access/) and [the workers.dev Access shortcut](https://developers.cloudflare.com/changelog/post/2025-10-03-one-click-access-for-workers/).

Copy your Access team domain and the game application’s **Application Audience (AUD) Tag** to the two remaining GitHub Actions variables above. Cloudflare documents the AUD location under the application’s additional settings in [Validate JWTs](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).

Run **Deploy THE AMCOL WAY** again with **bootstrap=false**. The game will now accept only verified JWTs from that exact Access issuer and application. Each signed-in user gets a separate D1 account. Visiting the game address starts Cloudflare’s sign-in flow; the in-game sign-in button returns to this protected address.

### 6. Publish later updates

Push your code changes to GitHub. **Check game** runs automatically on pushes and pull requests. After checks pass, run **Deploy THE AMCOL WAY** with **bootstrap=false**. Production deployment is deliberately manual in this package; ordinary commits do not publish a new live version.

The existing D1 database and its cadets persist across deployments. Retain its ID and your Access application to keep the same account identities. See [DEPLOYMENT.md](DEPLOYMENT.md) for direct CLI deployment, troubleshooting and the storage design.

## Play rules

Values below are the defaults in `public/game/game-config.js`.

- **First day:** meet all 14 staff. Orientation sits outside the mission limits and uses no energy.
- **Study days:** five rewarded study days per real week. Each sleep ends one; the fifth sleep starts **weekly rest** until **Monday 00:00 Asia/Bangkok (UTC+7)**. During rest, cadets can explore, chat and practise, but new graded missions and XP wait. Starting a new journey does not restore used days.
- **Missions:** the Academic Office plans **four graded missions per study day** (20 per week), with at most one staff mission and a mix of places and game types. Each mission names its host NPC. Unfinished missions carry over. A new attempt uses one slot and **15 energy**, charged once; retries and reloads are free.
- **Energy:** maximum 100. Free meal +25 and rest +20 (once each per day at Loma Café, Palm Garden or the dormitory); dorm exercise costs 10; sleep refills to 100. Meters never change while a player is away.
- **XP and rank:** first completions earn XP (book games 10/12/14/16 by year; staff, safety and Loma 10). Level 2 needs 100 XP and each later level 35 more. Ranks run from New Cadet to Cadet Captain (level 18). Semesters advance by finishing the semester's book missions, not by level.
- **Gates:** Tr. Dream checks Years 1–2 and the 16 staff sign-offs before Year 3. In Year 4, Semester 2, once that semester's book missions are done, the Loma final saves a major-specific random set of 50 games. It uses the same daily and weekly slots, so it takes at least 13 study days.

Mini-games award XP and skill XP on their first completion; replaying them is practice. The avatar’s optional BMI record does not decide grades or physical fitness.

## Project layout

| Path | Purpose |
| --- | --- |
| `public/game/` | Existing browser game, visuals, book, page images and all shared mini-game/rule modules |
| `src/worker.mjs` | Authenticated static routing and `/api/academy` |
| `src/auth.mjs` | Cloudflare Access JWT verification using `jose`; explicit loopback-only development mode |
| `src/presence-room.mjs` | Hibernating Durable Object rooms, bounded snapshots, server rate limits, class-room closure |
| `lib/presence-store.mjs` | Class codes, read-only profile projection and moderation reports in D1 |
| `public/game/presence*.js`, `presence.css` | Online transport, shared protocol, play-mode controls and social UI |
| `lib/academy-store.mjs` | Existing authoritative D1 persistence, compare-and-swap revisions and atomic submission batches |
| `migrations/` | Exact source SQL migrations |
| `tests/`, `qa/`, `*-checks.mjs` | Offline export, JWT/API, database, progression and UI behavior checks |
| `.github/workflows/` | Automatic checks and manual production deployment |
| `scripts/configure.mjs` | Validates setup and writes the ignored production Wrangler configuration |
| `instructor/` | Downloaded answer catalog; outside the deployed `public/` tree |
| `source-assets.json`, `PROVENANCE.md` | Source version and asset integrity record |

Only `public/` is deployed as static content. Source files, database migrations, deployment configuration and `instructor/` are not served by the game. The gameplay JavaScript necessarily includes its objective answer banks, as in the original educational game.

## Official hosting references

- [GitHub Pages hosting model](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Cloudflare Workers deployment with GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
- [D1 getting started](https://developers.cloudflare.com/d1/get-started/) and [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Cloudflare Access for Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/) and [JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [Worker-first asset routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)
- [Cloudflare asset/platform limits](https://developers.cloudflare.com/workers/platform/limits/)

See [ATTRIBUTIONS.md](ATTRIBUTIONS.md) for the supplied course book, Three.js and dependency credits.
