---
name: motion-video
description: Make a motion-design video (ad, launch film, explainer) for Mintmark or any brand with the code-based pipeline in media/motion-kit - scenes in canvas/three.js, frame-captured to mp4, with an original synthesized score and picture-locked sound design. Use when asked for a video, ad, promo, launch film, motion graphics or animation.
---

# Motion video workflow

The kit lives in `media/motion-kit` (read its README). A finished example is `media/ad-45s` (the Mintmark ad): reuse its scenes and techniques.

## Steps

1. **Brief.** Get the subject, length, frame size, ending (usually the brand logo) and where it will be posted. If the brief names a length, don't change it without asking.
2. **Brand.** Pull colours and fonts from the product itself (for Mintmark: `public/styles.css` tokens, Space Grotesk / DM Sans / DM Mono, lime `#d8f36b`, ink `#18221c`, paper `#f8f9f7`). Recreate the real logo exactly and compare it side by side with the site's mark before rendering.
3. **Angle.** Pick one idea a viewer wouldn't predict, and use real product data on screen (catalog counts, real contract addresses, real API output). Label anything illustrative, like the fake look-alike address.
4. **Assets.** Use public-domain or own images only (Wikimedia Commons: check the license field; send a generic User-Agent and pace requests, since it rate-limits). Run them through `prep-duotone.py`.
5. **Copy the kit** to `media/<video-name>/`, set `FILM_BPM` in `film.html` and `DURATION` in `film.js`, then build scenes in beats.
6. **Build in passes, reviewing stills.** `node render.mjs --stills` plus `contact-sheet.py` after each act. Read the sheets and fix overlaps, legibility and empty frames.
7. **First full render, then review it end to end.** Extract frames at every half beat (`ffmpeg -vf fps=…`), make contact sheets, and list every timing, spacing and legibility issue. Fix them all, then render the final with `sub=2` motion blur.
8. **Sound.** `scan.mjs` → `score.py` → `sfx.py` → `mix.py`, then mux with steady gain to -14 LUFS (no dynamic loudnorm). Sound changes don't need a video re-render: re-mux with `-c:v copy`.
9. **Deliver** the 1080p file plus a 720p copy (crf 26) so it previews on a phone. Keep videos out of git (`previews/` is ignored) and commit the source.

## What the user has asked for (follow these)

- **Pace:** 120 BPM with a new move every half beat felt too fast and hard to read. Default to **100 BPM**, with every line of text held long enough to read twice.
- **Music:** one **continuous** track. No drop-outs, breaks, tape-stops or near-silent gaps; sections change only by intensity. No repeating chime or arpeggio patterns.
- **Sound effects:** **no swooshes or whooshes**, including noise-based swipes, tape flutter, marker scratches, paper rustle and whirs. They pile up and fight the music. Use only short clean hits: soft key clicks for typed letters, odometer ticks, pops, thuds, stamps, ring clicks, small digital blips. Keep effects under the music (0.3× RMS) and don't duck the music.
- **Look:** bold light mode, clean. No beige or sepia "artsy" look and no small eyebrow labels. Paint marker elements over images; vary image sizes (small, big, several at once).
- **Text:** never leave a frame empty or static for longer than a beat. The end card keeps gentle motion (slow push, rotating guilloche, scrolling data tape).
- **Git:** commit as Nifemi0 only, with no Claude co-author or session lines.

## Known pitfalls

- Playwright can capture one layer a frame late at cuts. `render.mjs` waits two animation frames per capture; keep that.
- Text drawn into a three.js texture reads mirrored on back faces: use `Ribbon`, which flips the back print.
- `paint()` cue keys must not include animated values, or every frame logs a new marker.
- With 2-subframe motion blur, very fast zooms show as a double image. Slow the move or accept it; 4 subframes doubles render time again.
