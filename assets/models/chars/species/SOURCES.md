# Planet species characters: sources and licences

All files come from **Quaternius, "Cute Animated Monsters Pack" (August 2020)**.
- Pack page: https://quaternius.com/packs/cutemonsters.html
- Download (official Google Drive, `glTF` subfolder): https://drive.google.com/drive/folders/1zLLO_7ZoWgUsS4uooYnVSErQYRu1VdS0
- Author: Quaternius (https://quaternius.com)
- Licence: **CC0 1.0 Universal (public domain)**, https://creativecommons.org/publicdomain/zero/1.0/. Commercial use is allowed and no attribution is required (crediting Quaternius is still a nice touch).

How they were made: the original `.gltf` files embed their buffers and texture as base64. Each one was repacked losslessly into a single `.glb`, with no changes to geometry, animation or texture. The raw files are in `PlanetQuest-internal/chars-raw/cute_monsters_gltf/`.

Notes that apply to all files:
- Each file has 1 skinned mesh, 1 material named `Texture`, and an embedded 512x512 PNG texture.
- The material uses **KHR_materials_unlit**, so three.js loads it as `MeshBasicMaterial` and scene lights do not affect it. To retint, multiply `material.color` (baseColorFactor is 1,1,1,1).
- Every file has the same 10 clips: `Bite_Front, Bite_InPlace, Dance, Death, HitRecieve, Idle, Jump, No, Walk, Yes`. Use `Idle` for rest; `Dance`, `Jump` and `Yes` for celebrations; `Walk` for moving. `Bite_*`, `Death` and `HitRecieve` are not suitable for a friendly game.
- Bones are named `Body, Mouth, Head, Head2, Head3` (plus `Eyebrow.L/.R` on most). There is **no Hips or Neck bone**. `Body` is the root, and `Head` and the chained bones above it bend the upper body.

| File | Source model | Author | Licence | Animation clips | Materials | Head/neck/hips bones (all bones) | Size |
|---|---|---|---|---|---|---|---|
| mercury.glb | Cyclops.gltf | Quaternius | CC0 1.0 | Bite_Front, Bite_InPlace, Dance, Death, HitRecieve, Idle, Jump, No, Walk, Yes | Texture (textured PNG, unlit, factor 1,1,1,1) | Head, Head2, Head3 (7: Body, Mouth, Head, Head2, Head3, Eyebrow.R, Eyebrow.L) | 366 KB |
| venus.glb | Ghost.gltf | Quaternius | CC0 1.0 | same 10 clips | Texture (textured PNG, unlit, factor 1,1,1,1) | Head, Head2, Head3 (7: Body, Mouth, Head, Head2, Head3, Eyebrow.R, Eyebrow.L) | 282 KB |
| mars.glb | Cactus.gltf | Quaternius | CC0 1.0 | same 10 clips | Texture (textured PNG, unlit, factor 1,1,1,1) | Head, Head2, Head3 (7: Body, Mouth, Head, Head2, Head3, Eyebrow.R, Eyebrow.L) | 390 KB |
| jupiter.glb | Alien.gltf | Quaternius | CC0 1.0 | same 10 clips | Texture (textured PNG, unlit, factor 1,1,1,1) | Head, Head2, Head3 (7: Body, Mouth, Head, Head2, Head3, Eyebrow.R, Eyebrow.L) | 361 KB |
| saturn.glb | Mushroom.gltf | Quaternius | CC0 1.0 | same 10 clips | Texture (textured PNG, unlit, factor 1,1,1,1) | Head, Head2, Head3 (5: Body, Mouth, Head, Head2, Head3) | 264 KB |
| uranus.glb | Yeti.gltf | Quaternius | CC0 1.0 | same 10 clips | Texture (textured PNG, unlit, factor 1,1,1,1) | Head, Head2, Head3 (7: Body, Mouth, Head, Head2, Head3, Eyebrow.R, Eyebrow.L) | 330 KB |
| neptune.glb | Alien_Tall.gltf | Quaternius | CC0 1.0 | same 10 clips | Texture (textured PNG, unlit, factor 1,1,1,1) | Head, Head2, Head3 (5: Body, Mouth, Head, Head2, Head3) | 323 KB |
| alt1.glb | Crab.gltf | Quaternius | CC0 1.0 | same 10 clips | Texture (textured PNG, unlit, factor 1,1,1,1) | Head, Head2, Head3 (7: Body, Mouth, Head, Head2, Head3, Eyebrow.R, Eyebrow.L) | 364 KB |
| alt2.glb | Penguin.gltf | Quaternius | CC0 1.0 | same 10 clips | Texture (textured PNG, unlit, factor 1,1,1,1) | Head, Head2, Head3 (6: Body, Head, Head2, Head3, Eyebrow.R, Eyebrow.L) | 268 KB |
| alt3.glb | Chicken.gltf | Quaternius | CC0 1.0 | same 10 clips | Texture (textured PNG, unlit, factor 1,1,1,1) | Head, Head2, Head3 (6: Body, Head, Head2, Head3, Eyebrow.R, Eyebrow.L) | 340 KB |

## Looks
- **mercury**: tan one-eyed cyclops blob with small cream horns and one big shiny eye (rocky; tint it orange or red for fire).
- **venus**: white sheet-ghost blob with big shiny eyes and grey brows (puffy and cloud-like).
- **mars**: round green cactus blob with a pink flower on top, spines and little cactus arms (desert critter).
- **jupiter**: round purple alien with two antennae and small side tentacle-arms (the classic floaty alien).
- **saturn**: mushroom blob with a red-and-cream spotted cap that reads as a brim or ring (elegant hat).
- **uranus**: pale-blue furry yeti blob with an icy white hood and small horns (icy).
- **neptune**: tall teal four-eyed alien with stubby arms and a purple tuft (deep-sea or odd).
- **alt1**: red crab blob with claws.
- **alt2**: black-and-white penguin blob with a yellow beak and flippers.
- **alt3**: yellow chick blob with an orange beak and little wings.

Faces have big glossy black eyes and an open smiling mouth with small teeth. They are chibi blob bodies with no separate legs.

## Other candidates checked but not used
These are in `chars-raw/` and are all CC0 Quaternius models from poly.pizza (Ultimate Monsters Bundle: https://poly.pizza/bundle/Ultimate-Monsters-Bundle-5oyGWAmOB6). They are flat-colour, sleepy-eyed and less cute. The blob ones (Mushnub LWKmS30Xxl, Pink Slime AyP8sQmDLh, Green Blob y4kJh8EeYS, Birb gZ2ExU9OAB, and others) have Idle/Dance/Jump/Yes/Walk. The flying ones (Glub, Hywirl, Squidle, Ghost and others) have only `Yes` as a celebration clip.
