# Reference evidence and design decisions

Target URL supplied by the user: https://roadsterdash.com/

## Directly verified by this implementation session

The cloud environment's outbound proxy rejects access to this domain with HTTP 403 at the CONNECT stage. No reference page, loading animation, menu, or live gameplay could be independently inspected. This is an environment access restriction and is not evidence that the reference website is broken.

## Supplied by the user's brief

The attached specification identifies these interface details as verified: a large two-line title; pilot identity; personal best and distance; Play with a Space hint; Rankings, Settings, and Controls buttons; sound/M shortcut; Global Top 100; all-time/weekly, global/regional, distance/score filters; language selector; privacy/terms/about links. It describes a black loading screen, widely spaced small lettering, an orange-to-red progress bar, and a restricted-browser initialization failure near 90%.

These are user-provided observations, not direct observations by the implementation agent. The brief advertises jumps, rolls, boost, traffic, and leaderboard competition but explicitly permits fallback mechanics when gameplay cannot be verified.

## Implemented fallback and original design

- Original red Tesla-inspired winged roadster, using earlier photo-inspired procedural geometry recolored red.
- A black night sky, moon, stars, forest roadside, distant city skyline, textured four-lane highway, reflectors, barriers, streetlights, headlights, and sedan/SUV/construction traffic.
- Automatic endless driving; responsive lane changes; ballistic jumps; complete airborne rolls; limited boost energy; gold energy pickups; gradual difficulty; swept collisions; immediate restart.
- Original dark interface, white typography, restrained warm accents, compact HUD and panels. No reference logos, code, assets, account systems, or proprietary audio are copied.
- New scoring values, physics constants, camera positions, traffic timing, animations, and effects are design choices, not claims about reference behavior.
- Real local records. Optional top-100 service adapter and reference backend. No fabricated online rankings.
- Early WebGL2 detection, real work milestones, Retry, and optional-service timeouts; no simulated 90% loading gate.

Branding and optional links live in `src/config.ts`; physics/constants in `src/config.ts` and `src/simulation.ts`; camera/environment in `src/world.ts`; interface styling in `style.css`. These details can be adjusted once actual reference screenshots or gameplay recordings are available.
