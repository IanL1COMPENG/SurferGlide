# Installed development skills

These skills were requested for Surfer Glide, inspected, and installed from the open-source [`alton47/threejs-skills`](https://github.com/alton47/threejs-skills) repository:

| Skill               | Source                     | Local installation                  |
| ------------------- | -------------------------- | ----------------------------------- |
| `threejs-audio`     | `skills/threejs-audio`     | `~/.codex/skills/threejs-audio`     |
| `threejs-animation` | `skills/threejs-animation` | `~/.codex/skills/threejs-animation` |

The repository is licensed under MIT, copyright 2026 Allan Alton. Its skills document user-gesture audio unlock, Web Audio integration, animation updates, keyframes, and animation state transitions. Surfer Glide uses original procedural geometry, pose animations, and synthesized audio; it does not require third-party audio service credentials.

They will be available to Codex on the next turn. To install on a different computer, use Codex’s skill-installer with the GitHub paths above, or its bundled helper:

```sh
python ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py \
  --repo alton47/threejs-skills \
  --path skills/threejs-audio skills/threejs-animation
```

Skills are intentionally installed outside this repository. The shipped game works without them.
