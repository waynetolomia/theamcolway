# THE AMCOL WAY

A mobile-friendly seafarer learning RPG: create a cadet, explore AMCOL and its separate dormitory, complete eight semesters, develop skills and traits, and prepare for sea training.

This is the **GitHub deployment export of game version 11**, source commit `3d7019d22655fb3b681f29e2eb0a977d040330c1`. It includes the existing 3D game, the full supplied course book, mini-game content, server-owned progress rules, database migrations, tests, and deployment workflows.

**GitHub stores the repository and runs deployment Actions. Cloudflare Workers hosts the game, D1 stores each cadet’s progress, and Cloudflare Access provides individual sign-in.** A custom domain is optional: you can protect the Worker’s `workers.dev` address. GitHub Pages is a static host and does not run this game’s account API or database. [Hosting references](#official-hosting-references)

## What is included

| Area | Included behavior |
| --- | --- |
| Character and world | Male/female cadets; DECK/ENGINE majors; campus, two four-storey academic buildings, Atlantic simulator rooms, separate dormitory; mobile joystick, walking/running and rotating camera |
| Staff and first day | Fourteen NPC introductions, staff role dialogue, 27 staff missions, Tr. Dream’s end-of-Year-2 sea-training review |
| Book course | 381 required mini-games and 1,624 individual tasks across four years/eight semesters; 248 book-page images and original PDF |
| Safety and fitness | Eight rotating lifeboat safety mini-games; PT, running and football; workshop suit and immersion-suit entry requirements |
| Final assessment | A saved random set of 50 Loma Lounge mini-games drawn from 273 candidates: 20 major-specific and 30 shared; at most five new final completions per game day |
| Progression | Academic Office mission board, daily release of assignments, required dorm fitness before sleep, five successful sleeps per real week |
| RPG | Character XP, nine skills, starter traits, earned traits, care meters, optional fictional height/weight/BMI record; rewards recorded in the account ledger |
| Answer catalog | [Complete catalog](instructor/CONTENTS.md) and answer files in `instructor/`; these are outside the deployed asset directory |

The authoritative content and rules remain in `public/game/`. `source-assets.json` records the original tracked assets and SHA-256 hashes. The only frontend change in this export replaces the former hosting-specific sign-in URL with `/auth/login`.

## Quick start on your computer

Install **Node.js 24 LTS** (minimum supported version: 22.13). Unzip the download, then open a terminal **inside `THE_AMCOL_WAY_GitHub`** so `package.json` is in the current directory.

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

## Play rules retained by this export

All cadets first speak to the 14 NPCs. Required book missions release per location/day and unfinished work remains available. At the dorm, complete one PT, run or football game before sleeping. The server permits **five successful sleeps per real week**, refreshing at **Monday 00:00 Asia/Bangkok (UTC+7)**. A real-week refresh restores the allowance; the cadet still sleeps to advance the game day. Starting a new journey does not replenish used weekly sleeps.

Tr. Dream checks the first four semesters and the 16 required staff sign-offs before approving sea training. In Year 4, Semester 2, the Loma final saves a major-specific random set of 50 games, with up to five new passes per game day. The Academic Office checks the full semester requirements before advancement and graduation.

Mini-games award XP and skill XP on their first completion; replaying them is practice. Daily care and exercise use server-recorded reward keys. The avatar’s optional BMI record does not decide grades or physical fitness. The existing course distinguishes exact-answer work from writing, speaking and presentation tasks that use explicit self-review criteria.

## Project layout

| Path | Purpose |
| --- | --- |
| `public/game/` | Existing browser game, visuals, book, page images and all shared mini-game/rule modules |
| `src/worker.mjs` | Authenticated static routing and `/api/academy` |
| `src/auth.mjs` | Cloudflare Access JWT verification using `jose`; explicit loopback-only development mode |
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
