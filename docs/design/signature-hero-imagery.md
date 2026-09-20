# BlueDeck signature panorama

Generated with the built-in imagegen tool, using the existing yacht source as an edit target. Two passes: ocean/framing extension, followed by yacht scale/position correction. Source yacht: `public/media/bluedeck-yacht-hero-v2.webp`.

Final native dimensions: 1774×887 (2:1). The tool returned this resolution despite a request for a larger native output; this is not a 4K image and was not upscaled. Final yacht center is approximately 72% of width with hull about 83% of image height. Ocean covers all edges without a straight seam. This is an AI-recomposed derivative, not an untouched original photograph.

## Initial prompt

Use case: precise-object-edit.
Asset type: high-resolution production website hero photograph, with no user interface.
Input image 1 is the edit target and definitive visual identity reference.
Primary request: recompose and extend ONLY the ocean/framing around the same white luxury motor yacht into a panoramic 2:1 landscape photo. Produce the highest native resolution available, preferably 3840 x 1920 pixels or at least 3200 x 1600. This is a source photograph, not a website mockup.
Composition: strictly overhead/top-down camera. Keep the yacht upright, bow pointing to the top edge and stern to the bottom edge, no rotation. The yacht center must be at exactly 75% of canvas width and 49% of canvas height. Yacht hull spans approximately 82% of canvas height and 14% of canvas width; leave clear water above its bow and some bright white wake below its stern. The yacht is the single subject in the right quarter; the left two-thirds is uninterrupted natural blue sea. Blue sea must cover the ENTIRE image from left edge to right edge with no straight joins, no black/navy graphic fills, no empty borders, and no fade.
Preserve invariants: preserve the same vessel identity and proportions as the input: long white luxury yacht, tan teak decks, white tiered roof sections, dark windscreen and black satellite/radar equipment, pale turquoise square pool/jacuzzi detail, deck furniture in the same positions, and white foamy wake. Preserve realistic midday illumination, rich cobalt/deep blue ocean at top, gently brighter turquoise blue toward bottom/right, crisp natural wave texture.
Only extend/reframe sea and reposition the reference yacht as one unchanged subject; no design reinterpretation, no new deck structures, no dramatic angle changes, no exaggerated sharpening.
Avoid: all text, letters, logos, watermarks, UI, navigation, headings, buttons, metallic or colored curves, dividers, gradients as graphic overlays, other boats, coastline, clouds, people added to sea, artificial repeated water patterns.

## Final composition prompt

Use case: precise-object-edit.
Input image 1 is the edit target. Keep its clean photographic sea, color, lighting, and exact white yacht identity unchanged.
Make one precise composition correction: enlarge the yacht and its attached wake by about 28% and move their center to the RIGHT. On the full panoramic canvas the yacht's centerline MUST be at x=75% of width, not x=67%; its bow MUST begin at y=7% and its stern MUST end at y=89%. The yacht must occupy 82% of canvas height. Keep it perfectly vertical, viewed directly overhead, bow pointing straight up. This is the same boat, with its exact same deck, equipment, tan wood, pool, and white hull. Fill remaining space naturally with the same continuous blue ocean, no seams. No other changes.
Keep a 2:1 wide aspect ratio. Produce the maximum available native image resolution. Prefer 3840x1920 or 3200x1600 if supported; do not merely interpolate a small image. Detailed fine natural wave texture.
Absolutely no text, logos, graphic curves, overlays, user-interface elements, borders, land, or additional boats.

## Shipped asset and rendering

The production derivative is `public/media/bluedeck-signature-panorama-v1.webp`, encoded from the native PNG at WebP quality 95 (591,898 bytes). The original centered image remains the mobile source and is also used by the existing closing section. Next.js responsive image optimization serves the selected source at quality 90 through a native `picture` element; only the viewport-appropriate source is requested. The curve, typography and controls remain real SVG/HTML, independent of bitmap resolution.

The display font is locally hosted Michroma, licensed under the SIL Open Font License. Its license and pinned upstream provenance are in `app/fonts/michroma/`.
