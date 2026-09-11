---
summary: Where scene assets come from, what the CC0 libraries actually cover, and the vegetation gap that constrains how context scatter can be authored.
updated: 2026-09-11
---

# Assets

All assets are **CC0**. Raw downloads are committed; anything large is gitignored
(`assets-src/**/*_4k.*`), so the 1k and 2k variants live in git and 4k does not.

## Sources, with real inventory

| Source | Licence | Inventory (checked 2026-09-11) | Use |
|---|---|---|---|
| [Poly Haven](https://polyhaven.com) | CC0 site-wide | 995 HDRIs · 859 textures · 521 models, **native glTF at 1k/2k/4k** | The anchor — the only source serving glTF directly |
| [ambientCG](https://ambientcg.com) | CC0 site-wide | ~2 890 assets, ~2 009 PBR materials, ~425 HDRIs | Material depth Poly Haven lacks |
| [cgbookcase](https://cgbookcase.com) | CC0 | Small, hand-authored | Architectural surfaces |
| [Sketchfab](https://sketchfab.com) / [BlendSwap](https://blendswap.com) | **per-asset** | Large, mixed CC0 / CC-BY | Gap-filling only — check every licence |

## Why solar time works so well here

Of Poly Haven's 995 HDRIs: **703 outdoor, 820 natural-light, 331
morning-afternoon, 223 sunrise-sunset, 206 midday, 299 pure skies.** That is dense
enough to *match an HDRI to a time of day* rather than tint a procedural sky, which
is what makes [solar time](./glossary.md) a real lighting change instead of a
colour shift.

## The vegetation gap — a live constraint, not a nice-to-have

**Poly Haven has 20 tree models, and most are wrong for a temperate European
site.** The catalogue skews arid and southern-African: `quiver_tree_01`,
`quiver_tree_02`, `searsia_burchellii`, `searsia_lucida`, `othonna_cerarioides`,
`jacaranda_tree`, `island_tree_01..03`. What is usable for a Romanian plot is
roughly three models — `pine_tree_01`, `fir_tree_01`, `tree_small_02` — plus
saplings (`fir_sapling`, `pine_sapling_medium`, `pine_sapling_small`) and stumps.

Two consequences:

1. **A forest is 3–5 species, varied by scale and rotation**, not 20. This is
   already how `ScatterField` works (`scaleRange`, `seed`), and it is now the
   reason, not a convenience.
2. **Invented slugs are a real failure mode.** Three tree ids in the first draft of
   `villa-carpathia` were plausible and did not exist (`birch_tree_02`,
   `oak_tree_01`). The `asset-resolves` lint rule exists for exactly this, but it
   only fires once a manifest is supplied — so until the manifest lands, **verify
   slugs against `https://api.polyhaven.com/info/<slug>` before committing them.**

Furniture is thin for the same reason: 85 models, skewed vintage and industrial
(a gothic armchair, a barber's chair, barrels). Materials and lighting are solved;
**models are not**.
