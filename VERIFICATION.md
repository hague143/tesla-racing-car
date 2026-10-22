# Verification results

## Installation, build, and logic

- Clean `npm ci --no-audit --no-fund`: passed, Node 24.19.0 / npm 11.9.0.
- `npm test`: **20 passed, 0 failed, 0 skipped**.
- Strict TypeScript check and `npm run build`: passed.
- Deployable `public/index.html`, hashed CSS/JS, and license were generated. JavaScript is approximately 561 KB / 150 KB gzip.
- Vite development server startup and transpiled TypeScript entry returned HTTP 200.
- `npm run export:html`: generated the self-contained playable HTML.
- `git diff --check`: passed.

Tests cover frame-independent automatic driving, lane settling, jump gravity/landing, roll completion, boost depletion/lock/recharge, swept high-speed collisions and airborne clearance, one-time +200 traffic launches, fatal hurdles during launches, pickups/near misses, 1,000 denser fair generated rows, bounded difficulty, state transitions, defensive record persistence, sound mixing, export replacement-token preservation, and the actual optional leaderboard HTTP service. Backend checks include score validation, Monday-UTC reset calculation, real submissions, filters, one-use tickets, origin restrictions, and rate limiting.

## Browser gameplay

Tested the production build in Chromium with actual WebGL 2 rendering using SwiftShader. Playwright checks exercised real keyboard and touch events, plus opt-in deterministic simulation stepping for extended gameplay and repeatable collision setup.

Verified:

- Loading reaches a rendered 3D menu; audio remains uninitialized before a gesture.
- First-run controls explain automatic movement and actions.
- Real keyboard steering, jump, airborne roll, and landing.
- Boost acceleration, depletion, lockout and recharge; horn and brake sound reactions.
- Web Audio context is running after Play, with a nonzero measured waveform.
- Pause freezes elapsed time and silences sound; resume preserves the run.
- Mute produces a silent measured waveform.
- Traffic-car hits launch the white player car, award +200 once per car, and keep PLAYING active. Landing and pause/resume during a launch work.
- Orange hurdle collisions show **Try Again** and preserve the final score. A nearby hurdle remains lethal during launch until physically cleared. Three repeated restarts reset traffic-hit counters and per-car hit flags.
- Runs begin with at least ten traffic cars; generated rows retain a free lane and include at most one stationary hurdle.
- Score records, pilot identity, volume, and settings survive reload.
- English/Spanish selection, settings, and ranking dimension controls work.
- Unconfigured rankings are explicitly unavailable and never block starting a run.
- Early unsupported-graphics errors give useful guidance and Retry works.
- Actual `WEBGL_lose_context` loss enters ERROR; Retry rebuilds on a fresh canvas.
- Mobile touchscreen steering, jump, roll, held boost, and Try Again work without page scrolling; rolls also complete during traffic-hit launches.
- Portrait/landscape resizing preserves the run. Screens at 390 × 844, 320 × 568, and 844 × 390 were inspected.
- Portrait camera checks keep the full car visible across all four lanes at 390px and 320px widths.
- Touch action targets are at least 44px high; the small-screen title stays on two lines.
- Standalone HTML reaches the menu and starts audio with the browser offline, with zero external asset requests.
- **No uncaught application errors** in the browser checks.

Selected screenshots are in [docs/screenshots](docs/screenshots).

## Evidence limits

The reference site itself was blocked by the environment proxy; no live reference gameplay was observed. [REFERENCE.md](REFERENCE.md) separates supplied observations from fallback design.

The managed Chromium policy blocks `file://` navigation. The standalone artifact was therefore served over local HTTP, then tested with network access disabled. Direct opening of the file in a normal user's browser was not independently tested here.

Touch input was tested through Chromium mobile emulation, not a physical phone. Software rendering does not establish hardware frame rates; no claim of measured 60 FPS on physical devices is made. Graphics quality, shadows, and pixel-ratio caps are adjustable.

The optional backend was tested locally. No public ranking service was configured or deployed. Production anti-cheat/account/distributed-storage limitations are documented in README.md. No new public Vercel deployment was created; the user can redeploy the pushed `main` commit.
