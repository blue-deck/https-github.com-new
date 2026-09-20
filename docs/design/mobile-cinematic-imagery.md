# Mobile cinematic imagery

## Production asset

- Web asset: `public/media/bluedeck-mobile-cinematic-v1.webp`
- Preserved generated PNG: `output/imagegen/mobile-cinematic-photo.png`
- Native output: **964 × 1632 px**. The built-in tool returned these native dimensions; the requested 1560 × 2640 dimensions were not supplied.
- PNG: **2,569,321 bytes**.
- WebP: **583,550 bytes**, quality 95, effort 6.
- WebP is a format-only derivation made with Sharp. No resizing, crop, compositing, or post-generation image editing was applied.
- Generation mode: built-in `image_gen.imagegen`, local reference paths; no fallback CLI/API.
- Created: 2026-09-20.

## Origin and selection

The user-approved mockup is `/Users/sinanuymaz/bluedeck/output/imagegen/mobile-hero-concepts/02-cinematic.png`. Its underlying overhead yacht photograph was reconstructed as a standalone photo with continuous sea. Text, logo, menu, buttons, graphic footer, and curved trim were removed for separate HTML/CSS/SVG implementation.

First generated output: `/Users/sinanuymaz/.codex/generated_images/01a0bec2-bdcf-7391-ad32-eb53db3459c6/exec-25526f20-f3eb-4d04-bd30-f3ebea77ca6a.png` (963 × 1632 px). This preserved the yacht identity but positioned it too high (bow about 26%, stern about 78%).

Selected second output: `/Users/sinanuymaz/.codex/generated_images/01a0bec2-bdcf-7391-ad32-eb53db3459c6/exec-ab7b5cb8-dc21-428a-be49-3659130279cf.png` (964 × 1632 px). It used the first output as its sole edit target to correct vertical framing. Visually inspected: one centered white/tan yacht, attached white wake, continuous blue sea at every edge, no text/UI/curve. Approximate final geometry: centerline x=50%, bow hull y=36.7% (tip about 35.5%), stern y=89.3%, hull width 26%, hull height 53%. This is the closest selected output to the requested bow y=38% / stern y=90% composition. Yacht identity and deck layout are preserved visually; generated reconstruction is not a pixel-exact extraction.

## Exact initial prompt

```text
Use case: precise-object-edit.
Asset type: production mobile website background PHOTO only.
Input image 1 is the edit target: the approved BlueDeck mobile cinematic hero mockup. Extract and faithfully reconstruct its underlying aerial yacht photograph. Remove ALL graphic design and interface: logo, menu icon, headline, paragraph, buttons, arrows, text, curved border, navy graphic footer, gradients used only for buttons. Restore realistic continuous ocean wherever those elements were, with seawater to all four edges.
Canvas: portrait 390:660 aspect ratio, ideally 1560 x 2640 native pixels. The output framing reproduces only the PHOTO REGION from source y=0 to approximately y=1450 before the buttons; do not reproduce the source's full tall UI canvas.
Preserve this exact single yacht's identity, white hull shape, tan teak decks, dark glazing, radar equipment, deck arrangement, stern platform, and orientation. Directly overhead view, bow straight upward, stern downward. Yacht centerline precisely x=50%. Bow tip at y=38% of output and stern at y=90%; boat occupies about 52% output height and 26% output width. Preserve the attached white foamy wake and bright blue stirred seawater extending off the bottom. Do not make the yacht smaller or move it higher.
Scene and color: full-frame photorealistic sea, darkest navy upper third with natural visible fine waves, transitioning smoothly to rich cobalt and blue below, matching the reference. Preserve wave texture and lighting, yacht crispness and photographic realism.
Critical constraints: exactly one yacht, identical to reference; no UI, no words, no letters, no logo, no watermark, no border, no curve, no footer, no graphic panel, no land, no horizon, no extra boats. The entire canvas is an uninterrupted photograph.
```

## Exact framing correction prompt

```text
Use case: precise-object-edit. Edit target is the provided clean yacht photo, which is nearly perfect except its vertical framing.
Keep the exact same portrait aspect ratio 390:660, same yacht identity, exact yacht size, same centerline x=50%, same camera angle, all deck furniture, radar, hull geometry, sea detail and white foamy wake.
Change ONLY the vertical framing: TRANSLATE THE ENTIRE ORIGINAL PHOTO DOWNWARD by 12 percent of canvas height. Outpaint the newly exposed TOP 12 percent with seamlessly matching dark navy sea. Crop away the BOTTOM 12 percent of the original wake. Do not scale the image or the yacht. This is a downward translation and top outpaint, not a zoom.
The current bow is at y=26% and stern at y=78%. Required output bow is at y=38% and stern at y=90%. The yacht remains ~52 percent of canvas height and ~26 percent of canvas width. Exactly one yacht only. The top 38 percent must be uninterrupted dark navy natural seawater, empty of yacht or wake, and the bottom 10 percent must show attached foamy wake going off the bottom edge.
Darken the top-third water naturally toward navy matching the approved cinematic mood while maintaining photographic ocean texture. Continuous sea at all four edges. No letters, no text, no logo, no buttons, no footer, no border or graphic curve, no land, no horizon.
Request native high resolution ideally 1560 x 2640, preserving this exact aspect ratio and framing.
```

