# Credits

- **Track world** (`assets/monaco.glb`): "gt racing motor academy - monaco" by amogusstrikesback2
  (https://sketchfab.com/3d-models/gt-racing-motor-academy-monaco-be2b0fc454a74464975ce4504d5bbf43), licensed CC-BY-4.0.
  The centre line (`src/track6data.js`) was extracted from this model's road mesh (mesh `11400`).
  (The previous track, `assets/track6.glb` "car racing simulator 2015 - track 6" by the same author, is kept as a backup.)
- **Desert circuit** (`assets/registan.glb`): "fast racing 3d - desert" by amogusstrikesback2
  (https://sketchfab.com/3d-models/fast-racing-3d-desert-10dd603bd0a14b359b853b86ae8f9efc), licensed CC-BY-4.0.
  The centre line and per-point road width (`src/desertdata.js`) were extracted from this model's road mesh (`lu2`); its own sky box is not used (the game paints the desert sky).
- **Lotus Sports GT** (`assets/red_sports_car.glb`, the fourth car you sent): Lotus Elise taken from "CCity Building Set 1" by **Neberkenezer** (https://sketchfab.com/3d-models/ccity-building-set-1-a2d5c7bfcc2148fb8994864c43dfcc97), licensed **CC-BY-4.0** — credit required.
  Re-prepared with `work/prep_car.py elise`: nose re-oriented, 4.55 m long, its own `Wheel_*` nodes turned into spinning wheels, paint atlas kept so the body still takes the player colour.
- **Bugatti Chiron** (`assets/bugatti_chiron.glb`): "Bugatti Chiron" (https://sketchfab.com/3d-models/bugatti-chiron-d86ef28f23534e6b8de97afe4077965d) by **Racing Carz U3D** (https://sketchfab.com/jsa201022), licensed **CC-BY-4.0** — credit required.
  Prepared with `work/prep_car.py chiron`: 10,070 triangles, textures embedded, wheels split from the `Wheel_*` nodes (brake calipers stay put), 4.58 m long.
- **Lamborghini Essenza SCV12** (`assets/lamborghini_essenza.glb`): "Lamborghini Essenza SCV12" by **kevin**, licensed **CC-BY-4.0** — credit required.
  Prepared with `work/prep_car.py essenza`: simplified to 59,292 triangles, the four tyre meshes turned into spinning wheels, 4.62 m long.
  (The fourth car you sent, the 2021 Countach LPI 800-4, is **CC-BY-NC-4.0** (non-commercial), so it is deliberately not included.)
- **Bugatti Divo** (`assets/bugatti_divo.glb`): "Bugatti Divo" by **Jonrss** (https://sketchfab.com/3d-models/bugatti-divo), licensed **CC-BY-4.0** — credit required.
  Prepared for the game with `work/make_bugatti.py`: simplified from 331,900 to 26,536 triangles (meshopt `gltfpack`, UVs/textures kept),
  re-oriented (+X front, wheels on y = 0, 4.58 m long), and the two axle meshes split into four `Wheel_*` spin nodes.
- **One car only (v24):** the game ships this single body — the earlier studio-built bodies (Revuelto, Rosso GT, Civic, Trail Pickup) have been removed from `src/` and from the bundle. The three rivals use the same model in different colours.

- **Lotus fix (v29):** the Lotus model's nose actually pointed the opposite way to its `Wheel_F*` nodes, so it drove backwards. The GLB was rebuilt rotated 180° (nose on +X, front/rear wheel nodes swapped) and the headlamps (`HEAD_0`), indicator lamps (`IND_0`), tail lamps (`LIGHTS_TAIL`) and reverse lamps (`INT_REV`) were split out of the paint mesh so they keep their own colours instead of the body colour.
