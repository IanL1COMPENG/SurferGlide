# Surfer Glide

**Make some waves!**

An original, colorful 3D wakeboarding arcade game with models and skeletal animations authored in Blender through MCP, rendered with Three.js, and powered by a Node.js multiplayer server. Carve behind a boat, launch off its wake, combine tricks, and turn your best runs into a collection of boards and riders.

## Play locally

Install [Node.js 22.12+](https://nodejs.org/), then run:

```sh
npm install
npm run dev
```

Open **http://localhost:3000** (or **http://127.0.0.1:3000**). The same process serves the game and multiplayer. No accounts, API keys, paid services, or external game assets are required.

## On the water

You have **90 seconds** to set a high score. The boat handles forward motion. Carve through a white wake line with speed to launch automatically, or charge and release a jump. Combine spins, flips, and grabs, then release rotation controls before touchdown to straighten your board.

| Action                    | Keyboard                     | Xbox-style gamepad | Touch                |
| ------------------------- | ---------------------------- | ------------------ | -------------------- |
| Carve                     | A / D or left / right arrows | Left stick         | Left / right buttons |
| Charge jump, then release | Space                        | A                  | Hold / release Jump  |
| Spin in the air           | X                            | X                  | Spin                 |
| Indy grab                 | Z                            | B                  | Grab                 |
| Backflip                  | C                            | Y                  | Flip                 |
| Pause solo / match menu   | Escape                       | —                  | Pause icon           |

Clean landings build a **1×–5× flow multiplier**. Gold flow rings award 100 points. Jump over coral buoys; hitting one or landing an unfinished rotation causes a wipeout and resets the multiplier. Recovery is automatic.

Completed runs bank **1 Glide credit per 10 points**, **15 extra credits per ring**, and **100 bonus credits for at least five clean landings**. Points also become lifetime rank XP. Gear never changes performance.

## Features

- Rolling ocean swells with surface normals, layered wake ridges, animated foam, sunlight, and board spray. Riders follow the same water surface drawn by the shader.
- Four original Blender characters with distinct faces, hair, outfits, and a 13-bone skeleton. Nine animation clips cover cruising, carving, jumps, grabs, landings, wipeouts, and celebrations.
- Six original Blender boards with shaped rocker decks, graphics, bindings, fins, and individual cosmetic particle trails.
- Colorful cartoon menus, a sticker-style HUD, Blender-rendered thumbnails, interactive 3D previews, and purchase celebrations with animated models and confetti.
- Palm Lagoon, Sunset Cove, and Glacier Bay, each with a distinct palette and seeded ring / buoy placement.
- Six boards and four riders, with purchases, equip states, and previews in the locker.
- Six lifetime ranks, a personal best, and a logbook of the last 40 sessions.
- Private six-character multiplayer rooms for 2–6 riders, synchronized countdowns, live crew scores, rematches, and automatic host handoff.
- Keyboard, touch, and standard gamepad support. Mobile layouts and a graphics quality setting.
- Original procedural sound effects, ocean ambience, and music, with volume and music controls.
- Reduced camera motion, solo pause on focus loss, accessible HTML menus, and keyboard focus states.

## Ride with friends

1. Open **Ride with friends**, enter a rider name, and create a room.
2. Share the code or the invite link. Everyone must connect to **the same running server**.
3. The captain starts the session once at least two riders have joined.
4. After the session, return to the crew for a rematch. If the captain disconnects, the next rider becomes captain.

On a shared network, friends can open `http://YOUR-COMPUTER-LAN-IP:3000`. The server listens on all interfaces. A localhost invite only works on the host computer; use the LAN or deployed URL before copying an invite. Internet play requires deploying this server to a Node host with WebSocket support. A static-only host cannot run multiplayer.

Multiplayer scoring runs on the server using the same deterministic fixed-step simulation as solo play. Clients submit controls, never score values. Idle or disconnected inputs expire, rooms are limited to six riders, websocket payloads and message rates are bounded, and empty rooms are cleaned up.

## Production

```sh
npm ci
npm test
npm run build
npm start
```

`PORT` defaults to 3000. `NODE_ENV=production` or the start script serves the built `dist/` directory. `/healthz` returns a health response. Deploy behind HTTPS; browsers automatically use secure WebSockets on HTTPS pages.

### Render

The included `render.yaml` declares a single **Free** Node web service. Connect this repository in Render and create a Blueprint deployment. The build installs development dependencies needed by Vite and TypeScript before compiling. Rooms live in memory, so keep one instance.

### Vercel + free multiplayer backend

Follow the [exact GitHub, Vercel, and Render deployment guide](docs/vercel-deployment.md). Vercel serves `dist/` using the included `vercel.json`; the existing Node simulation runs on the owner's public `surferglide.onrender.com` service by default and trusts the verified `https://surfer-glide.vercel.app` frontend. The optional public `VITE_MULTIPLAYER_URL` overrides the backend address; `ALLOWED_ORIGINS` adds exact custom or preview origins. Local development and direct Node deployments keep using same-origin `/ws` when the endpoint is empty.

The normal production build passes. Deployment changes preserve the game and design, disable public source maps, and add an output/private-file check. Vercel Hobby is for personal, non-commercial projects; Render Free can sleep and restart. See the guide for limits, cold starts, preview origins, account setup, and verification. The game requires no API keys.

### Docker

```sh
docker build -t surfer-glide .
docker run --rm -p 3000:3000 surfer-glide
```

Run one server instance: rooms live in memory. Multiple independent instances do not share room codes; a production cluster would need shared room coordination.

## Progress and scope

Credits, owned gear, ranks, and the logbook are stored in this browser’s `localStorage`. Clearing browser data clears that profile. They are not cloud accounts or a global competitive leaderboard, and local save files are not cheat-proof. Multiplayer sessions have server-calculated scores; persistent, account-backed competition would need an identity and database service.

The game ships original Blender models and animations in `public/models/`, and creates water, environment geometry, effects, and audio locally. The optional Google Fonts stylesheet falls back to system fonts if unavailable. No Nintendo characters, models, music, or extracted assets are included. Players do not need Blender or MCP installed.

## Blender asset pipeline

The remake was authored in Blender 5.2.2 LTS via the installed [MCP for Blender](https://github.com/ahujasid/mcp-for-blender) server using the standard MCP Python client. Exported GLBs and PNG previews are included. See [the asset authoring guide](assets/blender/README.md) for the reproducible scripts and animation contract.

## Development

```sh
npm run check       # Strict TypeScript checks
npm run format      # Format source and documentation with Prettier
npm test            # Gameplay, economy, progression, and real WebSocket integration tests
npm run build       # Type check and production bundle
npm run verify:deploy  # Check that only intended game files are public
node scripts/smoke.mjs  # Check a running production server (optional URL argument)
```

| Path                       | Responsibility                                                    |
| -------------------------- | ----------------------------------------------------------------- |
| `src/core/game.ts`         | Fixed-step simulation, physics, tricks, scoring, pickups, rewards |
| `src/core/catalog.ts`      | Boards, riders, courses, rank thresholds                          |
| `src/core/profile.ts`      | Save validation, purchases, and idempotent run settlement         |
| `src/core/protocol.ts`     | Shared multiplayer message types                                  |
| `src/graphics/world.ts`    | World, environment, camera, towboat, and multiplayer riders       |
| `src/graphics/water.ts`    | Wave and foam shaders with matching CPU surface sampling          |
| `src/graphics/assets.ts`   | Blender loading, skeleton cloning, animation blending             |
| `src/graphics/effects.ts`  | Board trails, spray, and landing bursts                           |
| `src/graphics/showcase.ts` | Interactive 3D cosmetic previews and unlock animations            |
| `src/ui/views.ts`          | Colorful home screen and cosmetic shop                            |
| `src/arcade.css`           | Responsive cartoon UI and purchase celebrations                   |
| `src/audio.ts`             | Original Web Audio sound design and soundtrack                    |
| `src/input.ts`             | Keyboard, gamepad, and multitouch input                           |
| `src/main.ts`              | Menus, locker, HUD, results, and gameplay lifecycle               |
| `src/network.ts`           | Browser WebSocket client                                          |
| `server/rooms.ts`          | Authoritative room simulation and lifecycle                       |
| `server/index.ts`          | Development / production HTTP and WebSocket server                |

Read-only diagnostics are available at `window.__SURFER_GLIDE__` for local browser testing. They return cloned state and provide no score or currency mutation commands.

## Development skills

The requested [Three.js audio](https://github.com/alton47/threejs-skills/tree/main/skills/threejs-audio) and [Three.js animation](https://github.com/alton47/threejs-skills/tree/main/skills/threejs-animation) skills were installed into the developer’s Codex skills directory. They are development guidance, not runtime dependencies. See [docs/skills.md](docs/skills.md) for provenance and reinstall instructions.

## License

MIT. See [LICENSE](LICENSE).
