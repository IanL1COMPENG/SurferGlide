# Surfer Glide · Blender art source

All six boards and four characters were created in Blender 5.2.2 LTS through **MCP for Blender** (protocol 13, addon 1.8). The standard MCP Python client in `tools/blender/mcp_client.py` talks to `mcp-for-blender` over stdio; that server connects to the installed Blender addon on `localhost:9876`.

The selected game assets ship as self-contained GLBs in `public/models/`, retaining materials, vertex weights, skeletons, and animation clips. They can be imported into Blender for editing. Transparent rendered thumbnails are under `public/previews/`. No paid generation APIs or external model libraries are used.

## Rebuild

Open Blender with its installed MCP addon running on localhost. The scripts create a new **Surfer Glide Asset Studio** scene alongside existing scenes; they do not remove unrelated scenes or purge their data. Use a fresh task-owned Blender session when rebuilding to avoid duplicate generated names. Set the `PROJECT` constant in the scripts to your checkout’s absolute path.

```sh
uvx --from mcp-for-blender python tools/blender/mcp_client.py call get_addon_status
uvx --from mcp-for-blender python tools/blender/mcp_client.py code tools/blender/build_assets.py
uvx --from mcp-for-blender python tools/blender/mcp_client.py code tools/blender/polish_models.py
uvx --from mcp-for-blender python tools/blender/mcp_client.py code tools/blender/fix_animation_axes.py
uvx --from mcp-for-blender python tools/blender/mcp_client.py code tools/blender/render_previews.py
```

`start_bridge.py` enables the already-installed addon for an authoring session without saving preference changes. The client enables MCP safe mode. Scripts use permitted Blender modeling, rendering, saving, and export APIs.

A local studio copy is saved to `artifacts/surfer-glide-studio.blend`, preserving the original scene alongside the new game assets. It is ignored by Git and excluded from publication because it may contain pre-existing Blender content. Only selected Surfer Glide models and previews are published.

## Runtime contract

- Board assets: `board-{daybreak,coral,tidal,orchid,sunset,stealth}.glb`.
- Rider assets: `rider-{kai,luna,reef,sol}.glb`.
- Blender axes: X across the board, Y toward the towboat, Z up. glTF converts to Y-up.
- Skeleton: 13 bones, rigidly weighted rounded body parts, and a shared rest pose.
- Clips: `Cruise`, `CarveLeft`, `CarveRight`, `Air`, `IndyGrab`, `Pop`, `Land`, `Wipeout`, `Victory`.
- Runtime: `SkeletonUtils` clones, `AnimationMixer` crossfades, and root motion driven by the existing fixed-step simulation.
- Trails: `src/graphics/effects.ts` and `BOARD_EFFECTS` in `src/graphics/assets.ts`. They do not change scoring or board handling.

`tests/assets.test.ts` checks GLB integrity, model budgets, all nine clips, weighted skeletons, transparent previews, and effect coverage.
