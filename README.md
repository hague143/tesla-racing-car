# Tesla Night Flight

A nighttime endless-driving game with a graphite jetpack roadster inspired by the uploaded rear-view car photo. The 3D model recreates its large rear wing, continuous red taillight and four lift nozzles. It is a procedural recreation, not an extracted or exact 3D model of the photograph. The original image appears in the garage preview.

The scene includes a black night sky, moon and stars, textured asphalt, detailed tree silhouettes, streetlights, headlights, and reflective sedan/SUV traffic. Trees use detailed crossed foliage cutouts with three-dimensional trunks; the scene does not require remote model or texture downloads. No affiliation with Tesla.

## Play

Serve this directory with Python 3:

```sh
python3 -m http.server 8001 --bind 0.0.0.0
```

Open the served page in a WebGL 2-capable browser. The prebuilt `game.js` contains Three.js, so playing needs no dependency installation. A standalone HTML export includes the source photo and all styles and scripts for offline play.

Click **Start Driving**, then use:

| Control | Action |
| --- | --- |
| W / Up | Accelerate |
| A / D or Left / Right | Steer |
| S / Down | Brake; keep holding to reverse |
| Space + accelerator | Power boost |
| G / Vapor Jets button | Toggle white vapor exhaust |
| F / Flight Mode button | Take off / land |
| R | Return to the road and disable jets and flight |
| C / camera button | Chase / hood camera |
| P / Escape / pause button | Pause / resume |
| H / assist button | Toggle steering assist |
| Headlights button | Switch player headlights on / off |

Flight automatically activates the four jets and smoothly lifts the car about 2.5 meters above the road. Steering, acceleration, braking and cameras remain available while flying. You can pass over traffic at full flight altitude. F lands while leaving vapor enabled; G can turn the vapor off and also lands a flying car. Scenery obstacles still obstruct the car when tall enough to reach it. There is no finish line.

The onscreen jets and flight buttons work on phones, alongside touch steering, throttle, brake and boost. Best trip distance is saved locally when pausing, starting another drive, or leaving the page. Losing focus pauses automatically.

## Development

Requires Node.js 18+ and npm. Dependency versions are pinned in `package-lock.json`.

```sh
npm ci --no-audit --no-fund
npm test
npm run build
npm run export:html
```

- `src/game.js`: world, interface, lighting, collisions and cameras
- `src/physics.js`: driving and spring-based takeoff/landing
- `src/vehicles.js`: roadster, wing, jets and detailed traffic cars
- `src/textures.js`: generated asphalt, foliage, moon, reflection and smoke textures
- `src/effects.js`: pooled vapor particles
- `scripts/export-html.mjs`: standalone HTML, defaulting to `/workspace/library-files/tesla-night-flight.html`; accepts an output path argument

`npm run build` regenerates the prebuilt `game.js`. Export again after source, style, or markup changes. Physics tests cover driving, reverse, steering, boost, recovery, safe frame steps, hover and landing. Add `?debug=1` to expose deterministic stepping, particle counts and renderer diagnostics through `window.__drive`.

## Deploy to Vercel

Import this repository with its root directory set to the repository root (`.`). The committed `vercel.json` configures a static site: it installs with `npm ci`, builds with `npm run build`, and publishes `public/`, matching Vercel's default static output folder. No Python server or environment variables are needed on Vercel.

The build creates `public/index.html`, `public/style.css`, `public/game.js`, and the car image under `public/assets/`, together with the third-party license. It also retains the root `game.js` for local play and standalone exports. Generated `public/` files do not need to be committed.

To deploy an updated fix, create a deployment from the latest `main` branch or its new commit SHA. Check the cloning line in the build log to confirm that SHA. Redeploying an existing deployment can rebuild its original commit, even when the build cache is disabled. The original `f7ee3ee` commit predates the deployment configuration and cannot produce the required output folder.

Three.js is MIT licensed; see `THIRD_PARTY_LICENSES.txt`. The reference photo was supplied by the user. All scenery textures and vehicle geometry are generated in the game.
