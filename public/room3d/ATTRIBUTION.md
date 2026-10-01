# 3D preview asset

`casual.gltf`: Casual character, **Ultimate Modular Women Pack**, Quaternius (2022).

- Creator and license: https://quaternius.com/packs/ultimatemodularwomen.html
- License: CC0 1.0 Universal — https://creativecommons.org/publicdomain/zero/1.0/
- Distribution mirror: https://github.com/agentkaerf/FreeModels
- Pinned mirror revision: db3df04d1e4714298a09510b26fb6de6645138a2
- Original path: Ultimate Modular Women - April 2022/Individual Characters/glTF/Casual.gltf

The embedded asset is used for a **local 3D movement/interaction preview**, not as the final TimoTalk avatar system. No Sims assets, characters, animations or branding are included.

## VRM avatars (spike)

`avatars/female.vrm` and `avatars/male.vrm`: **Sendagaya Shino** and **Sakurada Fumiriya**, official VRoid sample models by pixiv (VRoid Project), exported with VRoid Studio 0.8.1. Embedded VRM meta: `licenseName: CC0`, commercial use allowed.

- Official pages: https://hub.vroid.com/en/characters/5860098757548846785/models/648876553405728395 and https://hub.vroid.com/en/characters/6912965120285194650/models/2261505926203110716
- Distribution mirror used: https://github.com/madjin/vrm-samples (`vroid/beta/*.vrm`), pinned revision e16eb187100149a315ad92c3c9968f1d5baa6c7d
- Modification: textures resized with `scripts/room3d/vrm-shrink.mjs` (VRM data unchanged).

## Humanoid animations (spike)

`humanoid-clips.json`: clips from the **Universal Animation Library** 1 and 2 [Standard], Quaternius — CC0 1.0 (https://quaternius.com/packs/universalanimationlibrary.html, https://quaternius.com/packs/universalanimationlibrary2.html), converted to the VRM humanoid with `scripts/room3d/ual-to-vrm.mjs`.

Furniture geometry, procedural materials and the room scene are original repository code. No external image services or runtime asset CDNs are required.
