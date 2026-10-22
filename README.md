# Tesla Night Shift

An original, playable night-highway arcade game built with **TypeScript, Vite, and Three.js**. Drive a detailed white Tesla-inspired roadster through dense traffic, launch upward by hitting other cars, jump over hurdles, perform airborne rolls, collect energy cells, and boost toward a personal record. This is an independent fan game with original procedural assets, not an official Tesla product.

The live Roadster Dash website could not be accessed from this environment. The implementation follows the user-supplied interface and fallback gameplay brief. See [REFERENCE.md](REFERENCE.md) for the exact evidence boundary.

## Run locally

Requires **Node.js 22.12+** and npm.

```sh
npm ci
npm run dev
```

Open the local address printed by Vite (port 8001). For a production preview:

```sh
npm test
npm run build
npm run preview
```

`npm run build` type-checks the source and creates the complete deployable static site in **public/**, including the third-party license. Vercel is already configured to publish this directory; no Python server, backend, or environment variables are required for offline-record gameplay. Deploy the latest `main` commit, rather than retrying an older deployment that predates these changes.

## How to play

Forward movement is automatic. Each press changes one lane; holding a direction crosses additional lanes. A first-run panel explains the controls before play starts.

| Control | Action |
| --- | --- |
| A / D or Left / Right | Change lanes |
| Space | Play from menu; jump during a run |
| Shift (hold) | Boost |
| Q / E | Left / right barrel roll while airborne |
| S / Down | Brake |
| B (hold) | Horn |
| Escape / P | Pause / resume |
| M | Mute / unmute |
| R | Restart after a crash |

Mobile has two steering pads, Jump, Roll, and a hold-to-Boost button. Pointer capture handles releases outside buttons and interruptions. Page scrolling is disabled during play. No swipe gestures are needed.

Hitting a traffic car launches your car upward and earns **200 points once per car**. Rolls earn 250 points, close passes 100, and gold energy cells 75 plus 30 energy. Distance contributes to score with a gradual survival multiplier. Boost consumes limited energy, locks until 25% after depletion, and recharges automatically. Hitting an orange road hurdle ends the run and shows **Try Again**; traffic-car collisions keep the run going. Restarting resets the simulation and pools without reloading the page. Pause, focus loss, and hidden tabs freeze the simulation and silence driving audio.

## Settings and saved data

Settings include graphics quality, effects volume, mute, reduced motion, and camera shake. Reduced motion disables camera shake, banking, bob, and boost field-of-view changes. English and Spanish are implemented; the selector changes menus, controls, settings, ranking messages, and results.

Pilot name, voluntarily selected region, settings, score records, and distance records use local storage. Storage failures do not prevent play; the results screen explains when saving is unavailable. No analytics, remote fonts, location requests, music downloads, or proprietary reference assets are used.

All audio is generated with Web Audio after a play/resume gesture: speed-responsive motor, road/wind, brake/skid, horn, jet vapor/turbine, boost, jump, landing, pickup, roll, close-pass, start, and impact sounds. Muting and pausing silence the mix. There is no music, so one effects-volume control is provided.

## Optional online rankings

Without a backend, the ranking panel explicitly displays **“Online rankings unavailable.”** No demo users are presented as live players. Personal records and the whole game remain available.

A separate adapter in `src/leaderboard.ts` supports top 100, all-time/weekly, global/regional, and score/distance filters. Set the public service URL in `.env.local` using [.env.example](.env.example), then rebuild:

```dotenv
VITE_LEADERBOARD_URL=https://your-ranking-service.example
```

An optional reference service is included in [server/leaderboard.mjs](server/leaderboard.mjs). Run it on a persistent Node host, separately from the static Vercel frontend:

```sh
ALLOWED_ORIGIN=https://your-game.example LEADERBOARD_SECRET=your-server-only-secret npm run leaderboard
```

It defaults to port 8787 and `.leaderboard/scores.json` for storage. Configure the exact allowed frontend origin. Never put a secret in a `VITE_` variable. Terminate HTTPS at the host/proxy. The service issues signed one-use run tickets, validates plausible timing/distance/bonuses, computes scores server-side, sanitizes names, rate-limits reads and submissions, limits bodies, and writes records atomically. Weekly rankings reset **Monday at 00:00 UTC**. Only records that can affect the current top 100 in each supported dimension are retained.

This is a small **single-process, persistent-disk** example. It has no account authentication; pilot names are display identities. Client-reported statistics can still be forged within plausibility bounds. Competitive production rankings need authenticated identities, shared durable storage/rate limits for multiple instances, server-authoritative run verification, and operational monitoring. Do not deploy the example as a stateless filesystem-only serverless function.

Optional backend failures time out after 6.5 seconds and never block game loading or play. Submission status is shown on the results screen. The frontend has no required remote assets, so there are no asset-download waits to stall loading.

## Project structure

| File | Responsibility |
| --- | --- |
| `src/main.ts` | Fixed-step loop and game orchestration |
| `src/state.ts` | Explicit BOOT / LOADING / MENU / PLAYING / PAUSED / GAME_OVER / ERROR transitions |
| `src/simulation.ts` | Frame-independent driving, jumping, rolls, boost, scoring |
| `src/traffic.ts` | Seeded pooled rows and a connected safe corridor |
| `src/collisions.ts` | Continuous swept 3D collision volumes |
| `src/input.ts` | Keyboard and mobile pointer controls |
| `src/world.ts` | Renderer, vehicle pools, camera, shadows and skyline |
| `src/road.ts` | Recycled highway segments and instanced trees/markings |
| `src/effects.ts` | Fixed-size particle pool |
| `src/ui.ts`, `src/i18n.ts` | Accessible menus, HUD, panels and translations |
| `src/storage.ts` | Defensive local persistence |
| `src/leaderboard.ts` | Optional backend adapter |
| `src/audio.js` | Original synthesized vehicle audio |
| `src/vehicles.js`, `src/textures.js` | Original procedural geometry/textures |
| `src/config.ts` | Game name, logo, attribution, support/contact links and public service URL |

The simulation uses 120 Hz fixed steps and a bounded frame accumulator. AABB sweeps include changing jump height to prevent high-speed tunneling. Cosmetic roll rotation is independent of the collision shape. Five initial rows carry at least two traffic cars each; later rows carry two or three occupied lanes and retain an adjacent reserved escape lane. Traffic rows have at least 1.95 seconds between them at maximum relative boost speed. Stationary orange hurdles are limited to one every third row. Density and cruise speed increase gradually within limits. Each traffic car can award its launch bonus only once; reusing a pooled car resets that flag. Hurdles remain collidable while launching unless the car actually clears their height.

The renderer caps pixel ratio, offers low-quality mode without shadows, uses instancing, and recycles road/traffic/pickup/particle pools. Resize and orientation changes preserve a run. The graphics context is checked early; failures and context loss offer an explicit Retry action that rebuilds resources on a fresh canvas. Menus have keyboard focus handling and modal focus containment.

## Standalone export

```sh
npm run build
npm run export:html -- /path/to/tesla-night-shift.html
```

The exporter inlines the Vite script, CSS, and license into one HTML file for offline play. No CDN is required. The default export path in the cloud workspace is `/workspace/library-files/tesla-night-shift.html`. Online rankings still require a configured network service.

## Verification

`npm test` runs simulation, collision, fair-generation, state-transition, persistence, audio-mix, standalone-export, and actual optional-backend HTTP tests. Build performs strict TypeScript checking. Browser verification results and limitations are recorded in [VERIFICATION.md](VERIFICATION.md).

Add `?debug=1` to expose `window.__nightshift` for deterministic simulation stepping, audio meter readings, and renderer diagnostics. `?noWebGL` deliberately exercises the graphics-error screen. Both are opt-in diagnostic query parameters; no debug controls are shown in normal play.

Three.js is MIT licensed; see [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt). All game geometry, textures, effects, and synthesized sounds are generated locally. `assets/reference-car.avif` is the earlier user-supplied photo and is retained as source reference; the new game does not need to download it.
