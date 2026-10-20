# Publish Surfer Glide with GitHub and Vercel

The existing app is **Vite + TypeScript + Three.js**, with a separate **Node.js + `ws`** multiplayer server. It is not a Next.js or React app. The Vite build produces `dist/`; Vercel serves that directory. The design, game assets, rules, cosmetics, saves, and room protocol are unchanged by this deployment setup.

## Hosting layout and free plans

- **Vercel Hobby:** hosts the game, JavaScript, CSS, Blender models, and preview images.
- **One Render Free Node web service:** runs the existing authoritative multiplayer simulation and `/healthz`. Keep one instance so all players share the same room map.

Vercel now has WebSocket support in beta, but connections can end at the Function duration limit and different connections can reach different instances. Its documentation recommends external state coordination for rooms. Moving this game's in-memory rooms directly into a Function would make room codes unreliable. This setup keeps the existing server implementation instead of changing the multiplayer architecture. See [Vercel WebSockets](https://vercel.com/docs/functions/websockets).

[Vercel Hobby](https://vercel.com/docs/plans/hobby) is for personal, non-commercial projects and has usage limits. [Render Free](https://render.com/docs/free) sleeps after 15 minutes without inbound traffic and can take about a minute to wake. The client now warms the server only when you create or join a room. Render can restart a service; active rooms then disappear, as they do whenever this Node server restarts. Persistent profiles remain in each player's browser.

Choose **Hobby**, **Free**, and the supplied subdomains. Do not choose a Pro trial, paid instance, database, or paid domain. Check both services' usage dashboards; free hosting is not unlimited. Render's free-hour allowance is shared with other services in the workspace. If Render requires a card and you add one, review its spending settings because some usage overages can be billed.

## 1. GitHub source

Use the existing repository: [IanL1COMPENG/SurferGlide](https://github.com/IanL1COMPENG/SurferGlide), branch **main**. Do not upload your whole Desktop folder or the local Blender studio file.

The deployment changes include `vercel.json`, an endpoint setting, explicit backend origin checks, private-file exclusions, and deployment validation. For future changes from a clean local checkout:

```sh
npm ci --include=dev
npm test
npm run build
npm run verify:deploy
git status --short
```

Review the changed files, stage only intended source/configuration files, commit, then `git push origin main`. GitHub and Vercel do not need a token stored in this repository. Use their normal GitHub connection flow.

## 2. Deploy the multiplayer backend on Render

1. Sign in to [Render](https://dashboard.render.com/) and choose **New > Web Service**.
2. Connect GitHub and select **IanL1COMPENG/SurferGlide**. Limit repository access to this repository when offered.
3. Use these settings:

| Setting            | Value                                   |
| ------------------ | --------------------------------------- |
| Branch             | `main`                                  |
| Root Directory     | Leave empty (repository root)           |
| Language / Runtime | Node                                    |
| Build Command      | `npm ci --include=dev && npm run build` |
| Start Command      | `npm start`                             |
| Instance Type      | **Free**                                |
| Health Check Path  | `/healthz`                              |

4. Set `NODE_ENV=production` and `NODE_VERSION=22`. Leave `ALLOWED_ORIGINS` unset until you know the Vercel domain. Render supplies `PORT`; do not set it to 3000.
5. Create the service. After it becomes live, copy its actual HTTPS URL, for example `https://YOUR-SERVICE.onrender.com`.
6. Open `https://YOUR-SERVICE.onrender.com/healthz`; it must return `{"ok":true,"game":"Surfer Glide"}`.

The included `render.yaml` describes the same service with `plan: free`. If you use **New > Blueprint** instead, review that it creates only one Free web service. Supply `ALLOWED_ORIGINS` when prompted, or add the final value after the Vercel deployment. See the [Render Blueprint reference](https://render.com/docs/blueprint-spec).

## 3. Import the game into Vercel

1. Sign in to [Vercel](https://vercel.com/) using the GitHub account that owns the repository. Use a **Hobby** workspace.
2. Choose **Add New > Project**, find **SurferGlide**, and choose **Import**.
3. Confirm these settings (also declared in `vercel.json`):

| Setting           | Value                                    |
| ----------------- | ---------------------------------------- |
| Framework Preset  | **Vite**                                 |
| Root Directory    | `./` (repository root)                   |
| Install Command   | `npm ci --include=dev`                   |
| Build Command     | `npm run build && npm run verify:deploy` |
| Output Directory  | `dist`                                   |
| Node.js Version   | **22.x**, pinned by `package.json`       |
| Production Branch | `main`                                   |

4. This project now defaults to the owner's verified public backend at `https://surferglide.onrender.com`. **No Vercel environment variable is required for that service.** To use a different backend, optionally set this public build-time override:

```text
VITE_MULTIPLAYER_URL=wss://YOUR-SERVICE.onrender.com/ws
```

Use your actual Render service name. Select the **Production** environment. You can also set Preview if you want preview builds, but the backend must separately allow each preview origin. This value is a public address, not an API key.

5. Click **Deploy**. Copy the final production origin, such as `https://YOUR-PROJECT.vercel.app`. The exact project name may differ if your preferred name is taken.
6. In **Settings > Deployment Protection**, ensure visitors can access the **Production** domain publicly. Preview deployments may remain protected. Keep the free `vercel.app` domain; no custom domain purchase is required.

`VITE_` variables are bundled at build time. Changing them requires a new deployment: **Deployments > latest deployment > Redeploy**. The build and deployment check share the same endpoint resolver. An unset or blank override uses the verified Render service on Vercel; an explicit override takes precedence. Insecure addresses and URLs containing credentials still fail validation.

The game uses `/` and query-string room invites such as `/?room=A1B2C3`. It has no path-based client router, so no catch-all rewrite is needed. Missing private files and nonexistent assets should stay missing.

See [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite) and [GitHub integration](https://vercel.com/docs/git/vercel-for-github).

## 4. Allow the public game to connect to the backend

The owner's verified production origin `https://surfer-glide.vercel.app` is now explicitly trusted by the backend. That site requires no additional Render origin setting after deploying the current source. For a different public domain or an additional preview domain, set this in the Render service's **Environment** settings:

```text
ALLOWED_ORIGINS=https://YOUR-PROJECT.vercel.app
```

Use the exact additional origin: scheme and hostname, with no path, query, or wildcard. Save and redeploy the backend. You can allow additional domains using a comma-separated list, for example a custom domain and an exact preview deployment URL. Never use `*` or allow every `vercel.app` project. A fork of this project should replace the built-in production origin in `server/origins.ts` and the Vercel backend default in `src/core/deployment.ts` with its own verified addresses.

No `ALLOWED_ORIGINS` value is needed in Vercel. No `VITE_MULTIPLAYER_URL` value is needed on Render. Local development and an all-in-one Node deployment continue to use same-origin `/ws` when the Vite variable is empty. The built-in Render address applies only when `VERCEL=1` during the build.

## 5. Verify the public deployment

1. Open the Vercel **production** URL. Confirm the homepage, water, models, and locker previews appear.
2. Finish a solo run and check that credits and purchases save on reload.
3. Open the same Vercel URL in two browsers or devices. Create a room, join by code, and start a session. The first connection after Render sleeps can take about a minute.
4. Run the existing smoke check with both actual URLs:

```sh
node scripts/smoke.mjs https://YOUR-PROJECT.vercel.app https://YOUR-SERVICE.onrender.com
```

It checks backend health and CORS, production HTML/JavaScript, GLB model delivery, thumbnails, and a real WebSocket room handshake.

The deployment creates a new browser origin. A profile saved at `localhost:3000` stays at localhost; it is not automatically copied to the public site. Profiles at the stable Vercel production domain persist there. The game does not have cloud accounts.

## Private files and secrets

- Only `dist/` is served publicly by Vercel. It contains the game and intentionally public assets, not the Node server, tools, Blender studio, or repository metadata.
- `.gitignore` excludes local environment files, `.vercel/`, credentials, local agent configuration, and `artifacts/`. The committed `.env.example` contains empty values and examples only.
- `.vercelignore` limits CLI uploads to necessary build inputs. GitHub imports use the tracked repository; it is not a substitute for keeping secrets out of Git.
- Production source maps are disabled. `npm run verify:deploy` checks the public output against the game's asset list and recognizable credential patterns, and runs in GitHub CI and the Vercel build.
- No API keys are required for this game. Never put private values in a `VITE_` variable, GitHub source, `public/`, screenshots, or build logs. Future server secrets belong in the backend host's environment dashboard.
- If a credential was ever committed elsewhere, ignoring it later does not remove its history; rotate it and handle that history separately.

## Troubleshooting

| Symptom                                          | Check                                                                                                                                                             |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel build cannot find TypeScript or Vite      | Use `npm ci --include=dev`; build tools are development dependencies.                                                                                             |
| An older deployment asks for the multiplayer URL | Deploy the latest `main` commit. The initial `de03406` commit required a variable; the corrected build includes the owner's Render service as its Vercel default. |
| Solo works, multiplayer does not                 | Backend `/healthz` must work; `ALLOWED_ORIGINS` must exactly match the frontend URL you opened.                                                                   |
| Browser reports a mixed-content connection       | The public endpoint must use `wss://`, not `ws://`.                                                                                                               |
| A preview cannot join rooms                      | Allow that exact preview origin on the backend, or use the production URL.                                                                                        |
| Connecting takes time after inactivity           | Render Free is waking. Keep the connection attempt open, then retry if necessary.                                                                                 |
| A room code disappeared                          | Server restart/redeploy or another backend instance. Keep one server; create a new room after restarts.                                                           |
| A new endpoint value has no effect               | Redeploy Vercel; Vite reads this variable during the build.                                                                                                       |
| Models or styles fail to load                    | Output Directory must be `dist`, not the repository root or `public`.                                                                                             |

No public deployment is created just by committing this configuration. Complete the account-side steps above and verify the returned public URL.
